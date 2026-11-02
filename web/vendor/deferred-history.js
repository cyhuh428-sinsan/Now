/* A current projection never authorizes a journal write or a complete export. */
(() => {
  'use strict';
  const copy=value=>structuredClone(value);
  function create({initial,context,contextKey,accountKey,load,build,select=null,saveNote=null,readPage=null,request=null,ready=()=>{},change=()=>{}}){
    let full=null,preview=null,bound='',epoch=0,loading=null,failed=null,suspended=false,selectedTail=Promise.resolve(),selectedView=null;
    const stale=()=>Error('이력을 읽는 중 계정 또는 저장 기준이 변경되었습니다. 편집본을 보존했으며 다시 확인하세요.');
    const visible=()=>!suspended&&bound===contextKey()&&context().enabled;
    function reset(initial){
      const next=initial.preview;
      if(next&&(next.projection!=='journal_current_v1'||next.supported!==true||typeof next.stamp!=='string'||next.account!==accountKey()))throw stale();
      full?.suspend();epoch++;bound=contextKey();loading=null;failed=null;suspended=false;selectedView=null;selectedTail=Promise.resolve();
      preview=next?copy(next):null;full=next?null:build(initial.snapshot);
    }
    reset(initial);
    const canSelect=id=>Boolean(select&&saveNote&&preview&&Object.hasOwn(preview.notes,id)&&!preview.notes[id].conflicted);
    function selected(id,action){
      const generation=epoch,key=bound,active=()=>generation===epoch&&key===contextKey()&&!suspended&&context().enabled;
      const run=selectedTail.catch(()=>{}).then(async()=>{
        if(!active()||failed)throw failed||stale();
        if(full)return action(full);
        const account=accountKey(),stamp=preview.stamp;
        try{
          const opened=await select({account,id,stamp},{active});
          if(!active()||opened.stamp!==stamp)throw stale();
          let baseline=copy(opened.entry),revision=opened.revision;
          const initial={schema_version:1,contexts:{[account]:{notes:{[id]:baseline}}}};
          if(!NowJournalWrites.eligible(initial,account,id,baseline))throw stale();
          const persist=async(value,guard)=>{
            if(!active()||guard?.active&&!guard.active())throw stale();
            if(Object.keys(value).sort().join(',')!=='contexts,schema_version'||Object.keys(value.contexts).length!==1||!Object.hasOwn(value.contexts,account)
              ||Object.keys(value.contexts[account]).join()!=='notes'||Object.keys(value.contexts[account].notes).length!==1||!Object.hasOwn(value.contexts[account].notes,id))throw stale();
            const next=value.contexts[account].notes[id];
            if(!NowJournalWrites.eligible(initial,account,id,next))throw stale();
            const receipt=await saveNote({account,id,expected:baseline,next,revision},{active});
            if(!active())throw Object.assign(stale(),{committed:true});
            if(typeof receipt?.stamp!=='string'||typeof receipt.revision!=='string')throw Object.assign(stale(),{committed:true});
            baseline=copy(next);revision=receipt.revision;preview.stamp=receipt.stamp;
          };
          const store=NowNoteHistory.create({initial,context,request:async(...args)=>{
            if(!request||!active())throw stale();const result=await request(...args);if(!active())throw stale();return result;
          },write:persist});
          if(store.status().unsupported)throw stale();
          const result=await action(store);await store.idle();
          if(!active())throw stale();
          preview.notes[id]={...store.currentView(id),conflicted:store.status().conflicts>0};selectedView={id,store};return result;
        }catch(error){if(active()){failed=error;change(error);}throw error;}
      });
      selectedTail=run;return run;
    }
    async function ensure(id=null){
      if(id!==null&&canSelect(id)&&!loading)return selected(id,store=>store);
      if(!visible())throw stale();
      if(failed)throw failed;
      if(full)return full;
      if(loading)return loading;
      const generation=epoch,key=bound,active=()=>generation===epoch&&key===contextKey()&&!suspended;
      const attempt=(async()=>{
        try{
          await selectedTail;
          if(!active()||failed)throw failed||stale();
          const stamp=preview.stamp;
          const snapshot=await load({active});
          if(!active())throw stale();
          if(snapshot.stamp!==stamp)throw stale();
          const candidate=build(snapshot);
          if(candidate.status().unsupported)throw Error('전체 이력을 확인하지 못했습니다. 원본과 편집본을 보존했습니다.');
          if(!active()){candidate.suspend();throw stale();}
          full=candidate;preview=null;selectedView=null;ready();return full;
        }catch(error){if(active()){failed=error;change(error);}throw error;}
      })();
      loading=attempt;
      try{return await attempt;}finally{if(loading===attempt)loading=null;}
    }
    const current=(id)=>visible()?copy(preview?.notes[id]||null):null;
    const api={
      ensure,reset,matches:()=>bound===contextKey(),deferred:()=>Boolean(preview),selectable:id=>visible()&&canSelect(id),
      wikiIndex:()=>visible()&&preview&&preview.wikiIndexSupported!==false&&!failed?{projection:'wiki_index_v1',stamp:preview.stamp,ids:copy(preview.wikiIds||[])}:null,
      page(id,cursor=null,limit=50){
        if(!readPage||!canSelect(id)||full||loading)return Promise.resolve(null);
        const generation=epoch,key=bound,account=accountKey(),active=()=>generation===epoch&&key===contextKey()&&visible();
        const run=selectedTail.catch(()=>{}).then(async()=>{
          if(!active()||failed)throw failed||stale();if(full||loading)return null;
          const stamp=preview.stamp,result=await readPage({account,id,stamp,cursor,limit},{active});
          if(!active()||result.projection!=='history_page_v1'||result.account!==account||result.id!==id||result.stamp!==stamp)throw stale();
          return result;
        });
        selectedTail=run.then(()=>{},error=>{if(active()){failed=error;change(error);}});return run;
      },
      archive(read){
        if(!preview||full||loading)return Promise.resolve(null);
        const generation=epoch,key=bound,active=()=>generation===epoch&&key===contextKey()&&visible();
        const run=selectedTail.catch(()=>{}).then(async()=>{
          if(!active()||failed)throw failed||stale();
          if(full||loading)return null;
          const value=await read({stamp:preview.stamp,guard:{active}});if(!active())throw stale();return value;
        });
        selectedTail=run.then(()=>{},()=>{});return run;
      },
      currentView:id=>!visible()?null:full?full.currentView(id):current(id),
      currentEntries:options=>!visible()?{}:full?full.currentEntries(options):copy(preview?.notes||{}),
      entryIds:options=>!visible()?[]:full?full.entryIds(options):Object.keys(preview?.notes||{}),
      manages:id=>visible()&&(full?full.manages(id):Boolean(preview?.notes[id])),
      blocked:id=>!visible()||Boolean(full?.blocked(id)),
      legacyPending:()=>visible()&&full?full.legacyPending():null,
      protectionOperations:()=>visible()&&full?full.protectionOperations():{},
      failure:()=>failed?.message||full?.failure()||'',
      status(){
        if(!visible())return {pending:0,conflicts:0,revisions:null,failed:Boolean(failed),unsupported:!suspended&&bound!==contextKey()};
        if(full)return full.status();
        const notes=visible()?Object.values(preview?.notes||{}):[];
        return {pending:notes.filter(n=>!n.localOnly&&(n.dirty||n.pending)).length,
          dirty:notes.filter(n=>n.dirty||n.pending).length,conflicts:notes.filter(n=>n.conflicted).length,revisions:null,deferred:Boolean(preview),
          failed:Boolean(failed),unsupported:!suspended&&bound!==contextKey()};
      },
      idle:()=>full?full.idle():loading?loading.then(store=>store.idle()):selectedTail.then(()=>{}),
      suspend(){epoch++;suspended=true;full?.suspend();full=null;preview=null;selectedView=null;loading=null;failed=null;selectedTail=Promise.resolve();},
      suspended:()=>suspended,
      invalidate(){epoch++;full?.invalidate();loading=null;},
    };
    for(const name of ['view','entries','export','validateImport'])api[name]=(...args)=>{
      if(name==='view'&&visible()&&!full&&selectedView?.id===args[0])return selectedView.store.view(args[0]);
      if(!full||!visible())throw Error('전체 이력을 먼저 불러와 확인하세요. 현재본만 내보내거나 변경하지 않았습니다.');
      return full[name](...args);
    };
    for(const name of ['track','edit','seal','sync','compare','importPending','restore','restoreLocal','bindBaseline','saveProtection',
      'replaceProtectionStore','beginLegacy','completeLegacy','selectReplica','localOnly','import'])api[name]=async(...args)=>{
      if(name==='sync'&&(!context().enabled||suspended))return;
      if(name==='sync'&&!full&&preview&&request&&!loading&&args[0]?.onlyIds!==undefined){
        const ids=args[0]?.onlyIds;
        if(ids!==undefined&&(!Array.isArray(ids)||ids.length>30||ids.some(id=>typeof id!=='string')||new Set(ids).size!==ids.length))throw Error('동기화할 메모 ID를 확인하세요.');
        const targets=ids?[...ids]:Object.keys(preview.notes).filter(id=>!preview.notes[id].localOnly&&(preview.notes[id].dirty||preview.notes[id].pending));
        if(targets.every(canSelect)){
          const generation=epoch,key=bound;
          for(const id of targets){if(generation!==epoch||key!==contextKey()||!visible())throw stale();await selected(id,store=>store.sync({onlyIds:[id]}));}
          return;
        }
      }
      const id=name==='edit'?args[0]?.local_id:args[0];
      if(['edit','seal','localOnly'].includes(name)&&canSelect(id)&&!loading){const captured=copy(args);return selected(id,store=>store[name](...captured));}
      const generation=epoch,store=await ensure();if(generation!==epoch||!visible())throw stale();return store[name](...args);
    };
    return api;
  }
  globalThis.NowDeferredHistory={create};
  if(typeof module!=='undefined'&&module.exports)module.exports=globalThis.NowDeferredHistory;
})();
