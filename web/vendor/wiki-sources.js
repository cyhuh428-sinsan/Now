/* File snapshots live in the account's existing Note journal, never a second store. */
(() => {
  'use strict';
  const copy=structuredClone,P=globalThis.NowNoteProtectionProtocol,I=globalThis.NowNoteWikiIngest;
  const kind='wiki-source-snapshot';
  const exact=(value,names)=>{if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==names.length||names.some(k=>!Object.hasOwn(value,k)))throw Error('wiki_source_metadata');};
  const localContext=ctx=>({url:ctx.url,owner:ctx.owner,device:ctx.device,serverInstance:'local-file-snapshot',viewGeneration:0});
  async function inspect(item,ctx){
    const meta=item?.wiki_source_snapshot;
    exact(meta,['schema_version','id','manifest','extraction']);
    if(meta.schema_version!==1||item.localOnly!==true||item.raw?.source!==kind||item.draft?.source!==kind
      ||item.raw.owner_id!==ctx.owner||item.draft.owner_id!==ctx.owner||item.raw.local_id!==meta.manifest?.note_ref?.local_id
      ||item.draft.local_id!==item.raw.local_id||item.raw.content!==item.draft.content
      ||item.revisions.some(r=>r.snapshot?.note?.owner_id!==ctx.owner||r.snapshot.note.local_id!==item.raw.local_id||r.snapshot.note.content!==item.draft.content))throw Error('wiki_source_binding');
    const source={id:meta.id,source_kind:'file',title:item.draft.title,content:item.draft.content,manifest:copy(meta.manifest),
      extraction:copy(meta.extraction),safety:{status:'ok',epoch:0,lineage:false,fence:false}};
    await I.verifySnapshot({scope:{url:String(ctx.url).replace(/\/+$/,''),owner:ctx.owner},sources:[source]},localContext(ctx));
    return source;
  }
  function create(api){
    let busy=false;
    function action(){
      const ctx={...api.context()},key=api.contextKey(),h=api.history();
      if(!ctx.enabled||!ctx.owner||!h||h.status().unsupported)throw Error('본인 계정과 원본 이력을 확인하세요.');
      const check=()=>{if(key!==api.contextKey()||!api.context().enabled||h!==api.history())throw Error('계정·서버가 변경되었습니다. 원본 파일은 변경하지 않았습니다.');return true;};
      return {ctx,h,check};
    }
    async function list(){
      if(!api.context().enabled)return [];
      const a=action(),data=a.h.export(),notes=data.contexts?.[NowNoteHistory.key(a.ctx)]?.notes||{},result=[];
      for(const [local,item] of Object.entries(notes)){
        if(!local.startsWith('wiki-source:'))continue;
        if(a.h.blocked(local)||item.protectionScope||item.base?.crypto_epoch!==0){result.push({id:local,protected:true});continue;}
        const source=await inspect(item,a.ctx);a.check();result.push(source);
      }
      return result;
    }
    async function captureFiles(files){
      if(busy)throw Error('원본 저장을 먼저 완료하세요.');busy=true;
      try{
        const a=action();
        if(!Array.isArray(files)||!files.length||files.length>30)throw Error('파일은 1개부터 30개까지 선택하세요.');
        const before=a.h.export(),existing=await list();a.check();const selections=[];
        for(const file of files){
          if(typeof file?.name!=='string'||!(/\.(md|txt)$/i.test(file.name))||/[\\/]/.test(file.name))throw Error('지원하지 않는 파일입니다. UTF-8 MD 또는 TXT 파일을 선택하세요.');
          if(typeof file.size==='number'&&(!Number.isSafeInteger(file.size)||file.size<0||file.size>524288))throw Error('원본 텍스트 합계는 512KiB를 넘을 수 없습니다.');
          const raw=await file.arrayBuffer();a.check();
          selections.push({kind:'file',id:'file-'+crypto.randomUUID(),name:file.name,localId:'wiki-source:'+crypto.randomUUID(),
            bytes:new Uint8Array(raw),safety:{status:'ok',epoch:0,lineage:false,fence:false}});
        }
        const snapshot=await I.captureWikiSources(selections,localContext(a.ctx));a.check();
        const fingerprints=new Set(),fresh=snapshot.sources.filter(source=>{
          const key=P.canonicalJson([source.title,source.extraction]);
          if(fingerprints.has(key))return false;fingerprints.add(key);
          return !existing.some(old=>!old.protected&&old.title===source.title&&P.canonicalJson(old.extraction)===P.canonicalJson(source.extraction));
        });
        if(!fresh.length)return {created:0,unchanged:snapshot.sources.length};
        const next=copy(before),account=NowNoteHistory.key(a.ctx);next.contexts[account]||={notes:{}};
        for(const s of fresh){
          const now=new Date().toISOString().replace(/Z$/,'000Z'),note={id:null,owner_id:a.ctx.owner,local_id:s.manifest.note_ref.local_id,device_id:a.ctx.device,
            note_type:'tree',title:s.title,content:s.content,source:kind,parent_local_id:null,level:1,tags:null,
            deleted_at:null,created_at:now,updated_at:now,client_updated_at:now};
          const prepared=await NowNoteHistory.prepareExternalEdit(next,a.ctx,note,{newNote:true,localOnly:true});a.check();
          const item=prepared.next;
          item.wiki_source_snapshot={schema_version:1,id:s.id,manifest:copy(s.manifest),extraction:copy(s.extraction)};
          await inspect(item,a.ctx);a.check();next.contexts[account].notes[note.local_id]=item;
        }
        await a.h.replaceProtectionStore(before,next,{active:a.check});a.check();
        if(P.canonicalJson(a.h.export())!==P.canonicalJson(next))throw Error('원본 저장 확인에 실패했습니다. 다시 생성하지 말고 저장본을 확인하세요.');
        return {created:fresh.length,unchanged:snapshot.sources.length-fresh.length};
      }finally{busy=false;}
    }
    return {list,captureFiles};
  }
  globalThis.NowNoteWikiSources=Object.freeze({create,inspect});
})();
