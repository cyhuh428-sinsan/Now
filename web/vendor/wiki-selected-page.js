/* Local-only detail proofs retain a selected graph, never a writable partial journal. */
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
        const account=NowNoteHistory.key(ctx),ids=new Set(await set.ids()),notes={},operations={},blocked=new Set();check();
        for(const operationId of await set.operationIds()){
          const value=await set.operation(operationId);check();
          if(!value.found||!api.inspectOperations)throw unsupported();
          for(const local of api.inspectOperations({[operationId]:value.value}))blocked.add(local);
          Object.defineProperty(operations,operationId,{value:value.value,enumerable:true});
        }
        const lifecycle=NowWikiLifecycle.validateMap(await set.lifecycle());check();
        if(blocked.has('wiki:'+id)||lifecycle['wiki:'+id]?.deleted_at||lifecycle['wiki:'+id]?.pending)throw unsupported();
        const queue=[],queued=new Set(),parsed=new Set();
        const add=local=>{if(!queued.has(local)){queued.add(local);queue.push(local);}};
        const addWiki=wikiId=>{
          add('wiki:'+wikiId);
          for(const local of ids)if(local.startsWith('wiki-proposal:')&&local.endsWith(':'+wikiId))add(local);
        };
        const addRef=ref=>{if(ref.origin!=='local')throw unsupported();if(ref.kind==='wiki')addWiki(ref.wiki_id);else add(ref.note_ref.local_id);};
        addWiki(id);
        while(queue.length){
          const local=queue.shift();
          if(!wiki(local)&&!local.startsWith('wiki-proposal:')&&!local.startsWith('wiki-source:')&&api.source(local)?.origin==='server')throw unsupported();
          if(!ids.has(local)){if(wiki(local)||local.startsWith('wiki-source:')||local.startsWith('wiki-proposal:'))throw unsupported();continue;}
          const selected=await set.entry(local);check();if(!selected.found||selected.value.localOnly!==true)throw unsupported();
          const entry=selected.value;Object.defineProperty(notes,local,{value:entry,enumerable:true});
          if(!wiki(local)&&!local.startsWith('wiki-proposal:'))continue;
          const expected=wiki(local)?local.slice(5):local.slice(-36);
          for(const input of [entry.draft,entry.raw,...entry.revisions.map(row=>row.snapshot.note)]){
            let document;try{document=await W.validateDocument(input.content,ctx);}catch(error){if(input!==entry.draft)throw unsupported();throw error;}
            check();if(document.wiki_id!==expected)throw unsupported();
            const content=P.canonicalJson(document);if(parsed.has(content))continue;parsed.add(content);
            for(const draft of document.drafts)for(const ref of W.evidenceOf(draft))addRef(ref.kind?ref:{...ref,kind:'note'});
          }
          for(const operation of Object.values(operations))if(operation.documents.some(value=>value.wiki_id===expected)){
            if(operation.remote)throw unsupported();
            for(const ref of operation.inputs)addRef(ref);
            for(const output of operation.documents)addWiki(output.wiki_id);
          }
        }
        check();const root={schema_version:1,contexts:{[account]:{notes,wiki_lifecycle:lifecycle,wiki_ingest_operations:operations}}};
        const get=local=>{check();if(ids.has(local)&&!Object.hasOwn(notes,local))throw unsupported();return notes[local]||null;},view=local=>copy(get(local));
        const history={readOnlySnapshot:()=>{check();return {projection:'wiki_readset_v1',stamp:set.stamp,account,data:root};},
          status:()=>({unsupported:false}),suspended:()=>!active(),view,
          manages:local=>Boolean(get(local)),blocked:local=>blocked.has(local),
          currentView:local=>{const item=get(local);return item?copy({projection:'current_v1',raw:item.raw,draft:item.draft,base:{crypto_epoch:item.base.crypto_epoch,head_revision_id:item.base.head_revision_id},localOnly:item.localOnly,pending:item.outbox.length,dirty:item.dirty}):null;}};
        const localContext=()=>({...ctx,online:false});
        const source=local=>{
          const item=get(local);
          if(local.startsWith('wiki-source:'))return item?{owner:ctx.owner,localId:local,status:'ok',origin:'local',title:item.draft.title,content:item.draft.content,protected:false,revisionId:null,headVersion:0}:null;
          const value=api.source(local);return value?.origin==='local'&&(!item||item.draft.content===value.content)?value:null;
        };
        const selectedApi={...api,selected:undefined,readOnly:true,selectedWikiId:id,context:localContext,history:()=>history,source,
          lifecycle:{state:local=>copy(lifecycle[local]||null),blocked:local=>Boolean(lifecycle[local]?.deleted_at||lifecycle[local]?.pending)},
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
