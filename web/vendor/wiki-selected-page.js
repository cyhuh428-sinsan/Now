/* Detail proofs retain a selected graph, never a writable partial journal. */
(() => {
  'use strict';
  const copy=value=>structuredClone(value),wiki=id=>/^wiki:[0-9a-f-]{36}$/.test(id);
  function create(api){
    const P=NowNoteProtectionProtocol,W=NowNoteWiki;let generation=0,session=null;
    const unsupported=()=>Object.assign(Error('위키의 전체 출처 검증이 필요합니다.'),{code:'wiki_readset_unsupported'});
    const stale=()=>Error('위키를 읽는 중 계정 또는 저장 기준이 변경되었습니다. 원본은 보존했습니다.');
    function release(){generation++;session?.set.close();session=null;}
    const deferred=()=>api.history()?.deferred?.()===true;
    function proof(doc){
      if(!deferred()){release();return null;}
      if(!session)return null;
      if(!session.active()){release();return null;}
      if(!doc||P.canonicalJson(doc)!==session.document)return null;
      return session;
    }
    async function read(id){
      if(!deferred()){release();return null;}
      release();const token=generation,key=api.contextKey(),h=api.history(),ctx={...api.context()};let set=null,kept=false;
      const active=()=>token===generation&&key===api.contextKey()&&ctx.enabled&&api.context().enabled&&api.history()===h&&h.deferred?.()
        &&(!set||h.wikiIndex?.()?.stamp===set.stamp);
      const check=()=>{if(!active())throw stale();};
      try{
        if(!wiki('wiki:'+id))throw unsupported();
        set=await api.openSet({active});check();if(!set)return null;
        const account=NowNoteHistory.key(ctx),ids=new Set(await set.ids()),notes={},operations={},blocked=new Set(),remote=new Map();let remoteUsed=false;check();
        for(const operationId of await set.operationIds()){
          const value=await set.operation(operationId);check();
          if(!value.found||!api.inspectOperations)throw unsupported();
          for(const local of api.inspectOperations({[operationId]:value.value}))blocked.add(local);
          Object.defineProperty(operations,operationId,{value:value.value,enumerable:true});
        }
        const lifecycle=NowWikiLifecycle.validateMap(await set.lifecycle());check();
        const observe=async resources=>{
          if(!api.inspectLifecycle)throw unsupported();const next=await api.inspectLifecycle(resources,lifecycle);check();
          Object.assign(lifecycle,next);
        };
        const readRemote=async wikiId=>{
          if(remote.has(wikiId))return remote.get(wikiId);
          if(!ctx.online||!api.readRemote)throw unsupported();remoteUsed=true;
          const value=await api.readRemote(wikiId);check();await observe([value.resource]);
          if(value.artifact?.protected!==false||!value.artifact.document)throw unsupported();
          remote.set(wikiId,value);return value;
        };
        const serverEntry=async local=>{
          if(!ctx.online||!api.readCurrent)throw unsupported();remoteUsed=true;
          const resource=wiki(local)?await readRemote(local.slice(5)):null,current=await api.readCurrent(local);check();P.validateSnapshot(current?.snapshot);
          const note=current.snapshot.note;
          if(note.owner_id!==ctx.owner||note.local_id!==local)throw Error('위키 원본의 계정·문서 연결이 다릅니다.');
          if(current.crypto_epoch!==0||current.protection_state!=='legacy'||current.identity_state!=='coherent'||current.crypto_transition
            ||current.replica_count!==1||note.content.startsWith('NOW_ENCRYPTED_'))throw unsupported();
          if(resource&&(resource.artifact.head_revision_id!==current.head_revision_id||note.source!=='wiki-artifact'
            ||P.canonicalJson(resource.artifact.document)!==P.canonicalJson(await W.validateDocument(note.content,ctx))))throw Error('위키 판본이 변경되었습니다. 다시 확인하세요.');
          check();return {raw:copy(note),draft:copy(note),base:copy(current),revisions:[],outbox:[],receipts:[],localOnly:false,replicaSelected:true,dirty:false};
        };
        if(blocked.has('wiki:'+id)||lifecycle['wiki:'+id]?.deleted_at||lifecycle['wiki:'+id]?.pending)throw unsupported();
        const queue=[],queued=new Set(),parsed=new Set(),origins=new Map();
        const add=local=>{if(!queued.has(local)){queued.add(local);queue.push(local);}};
        const addWiki=wikiId=>{
          add('wiki:'+wikiId);
          for(const local of ids)if(local.startsWith('wiki-proposal:')&&local.endsWith(':'+wikiId))add(local);
        };
        const addRef=ref=>{const local=ref.kind==='wiki'?'wiki:'+ref.wiki_id:ref.note_ref.local_id;
          if(ref.origin==='server'){if(!ctx.online||!api.server)throw unsupported();remoteUsed=true;origins.set(local,'server');}
          if(ref.kind==='wiki')addWiki(ref.wiki_id);else add(local);};
        addWiki(id);
        while(queue.length){
          const local=queue.shift();
          let entry;
          if(!ids.has(local)){
            if((local==='wiki:'+id||origins.get(local)==='server')&&!local.startsWith('wiki-proposal:'))entry=await serverEntry(local);
            else{if(wiki(local)||local.startsWith('wiki-source:')||local.startsWith('wiki-proposal:'))throw unsupported();continue;}
          }else{const selected=await set.entry(local);check();if(!selected.found)throw unsupported();entry=selected.value;}
          if(entry.localOnly!==true){
            if(!ctx.online||!api.server||entry.dirty||entry.outbox.length||entry.conflict||entry.needsBaseline||entry.replicaSelected===false)throw unsupported();
            remoteUsed=true;if(wiki(local))await readRemote(local.slice(5));
          }else if(wiki(local)&&origins.get(local)==='server')await readRemote(local.slice(5));
          if(!wiki(local)&&!local.startsWith('wiki-proposal:')&&!local.startsWith('wiki-source:')){
            const value=api.source(local);if(value&&value.content!==entry.draft.content)throw unsupported();
          }
          check();Object.defineProperty(notes,local,{value:entry,enumerable:true});
          if(!wiki(local)&&!local.startsWith('wiki-proposal:'))continue;
          const expected=wiki(local)?local.slice(5):local.slice(-36);
          for(const input of [entry.draft,entry.raw,...entry.revisions.map(row=>row.snapshot.note)]){
            let document;try{document=await W.validateDocument(input.content,ctx);}catch(error){if(input!==entry.draft)throw unsupported();throw error;}
            check();if(document.wiki_id!==expected)throw unsupported();
            const content=P.canonicalJson(document);if(parsed.has(content))continue;parsed.add(content);
            for(const draft of document.drafts)for(const ref of W.evidenceOf(draft))addRef(ref.kind?ref:{...ref,kind:'note'});
          }
          for(const operation of Object.values(operations))if(operation.documents.some(value=>value.wiki_id===expected)){
            for(const ref of operation.inputs)addRef(ref);
            for(const output of operation.documents)if(!operation.remote||ids.has('wiki:'+output.wiki_id))addWiki(output.wiki_id);
          }
        }
        check();const root={schema_version:1,contexts:{[account]:{notes,wiki_lifecycle:lifecycle,wiki_ingest_operations:operations}}};
        const get=local=>{check();if(ids.has(local)&&!Object.hasOwn(notes,local))throw unsupported();return notes[local]||null;},view=local=>copy(get(local));
        const history={readOnlySnapshot:()=>{check();return {projection:'wiki_readset_v1',stamp:set.stamp,account,data:root};},
          status:()=>({unsupported:false}),suspended:()=>!active(),view,
          manages:local=>Boolean(get(local)),blocked:local=>blocked.has(local),
          currentView:local=>{const item=get(local);return item?copy({projection:'current_v1',raw:item.raw,draft:item.draft,base:{crypto_epoch:item.base.crypto_epoch,head_revision_id:item.base.head_revision_id},localOnly:item.localOnly,pending:item.outbox.length,dirty:item.dirty}):null;}};
        const selectedContext=()=>({...ctx,online:remoteUsed?ctx.online:false});
        const source=local=>{
          const item=get(local);
          if(local.startsWith('wiki-source:'))return item?{owner:ctx.owner,localId:local,status:'ok',origin:item.localOnly?'local':'server',title:item.draft.title,content:item.draft.content,protected:false,revisionId:null,headVersion:0}:null;
          const value=api.source(local);return !item||item.draft.content===value?.content?value:null;
        };
        const selectedApi={...api,selected:undefined,readOnly:true,selectedWikiId:id,context:selectedContext,history:()=>history,source,
          lifecycle:{state:local=>copy(lifecycle[local]||null),blocked:local=>Boolean(lifecycle[local]?.deleted_at||lifecycle[local]?.pending),observe},
          listRemote:async()=>{check();return remote.has(id)?[remote.get(id).resource]:[];},
          readOperations:async()=>copy(Object.values(operations)),retainedRoots:undefined};
        const book=createWikiNotebook(selectedApi),row=await book.readPage(id);check();
        if(!row.document)return row;
        const status=await book.sourceStatus(row.document.drafts.at(-1),row.document);check();await set.ids();check();
        if(status.available!==true)return {id,unavailable:true,error:'출처·보호 상태 확인 필요'};
        session={set,active,book,document:P.canonicalJson(row.document)};kept=true;return row;
      }catch(error){if(error.code==='wiki_readset_unsupported')return null;throw error;}
      finally{if(!kept)set?.close();}
    }
    return {read,release,canRead(doc){if(!deferred()){release();return undefined;}try{return Boolean(proof(doc)?.book.canRead(doc));}catch{return false;}},
      async sourceStatus(draft,doc){
        if(!deferred()){release();return undefined;}const current=proof(doc);
        if(!current||!doc.drafts.some(value=>P.canonicalJson(value)===P.canonicalJson(draft)))return {available:false,stale:true,sources:[]};
        const result=await current.book.sourceStatus(draft,doc);await current.set.ids();
        if(!current.active())throw stale();return result;
      }};
  }
  globalThis.NowWikiSelectedPage={create};
})();
