/* A current projection never authorizes a journal write or a complete export. */
(() => {
  'use strict';
  const copy=value=>structuredClone(value);
  function create({initial,context,contextKey,accountKey,load,build,ready=()=>{},change=()=>{}}){
    let full=null,preview=null,bound='',epoch=0,loading=null,failed=null,suspended=false;
    const stale=()=>Error('이력을 읽는 중 계정 또는 저장 기준이 변경되었습니다. 편집본을 보존했으며 다시 확인하세요.');
    const visible=()=>!suspended&&bound===contextKey()&&context().enabled;
    function reset(initial){
      const next=initial.preview;
      if(next&&(next.projection!=='journal_current_v1'||next.supported!==true||typeof next.stamp!=='string'||next.account!==accountKey()))throw stale();
      full?.suspend();epoch++;bound=contextKey();loading=null;failed=null;suspended=false;
      preview=next?copy(next):null;full=next?null:build(initial.snapshot);
    }
    reset(initial);
    async function ensure(){
      if(!visible())throw stale();
      if(failed)throw failed;
      if(full)return full;
      if(loading)return loading;
      const generation=epoch,key=bound,stamp=preview.stamp,active=()=>generation===epoch&&key===contextKey()&&!suspended;
      const attempt=(async()=>{
        try{
          const snapshot=await load({active});
          if(!active())throw stale();
          if(snapshot.stamp!==stamp)throw stale();
          const candidate=build(snapshot);
          if(candidate.status().unsupported)throw Error('전체 이력을 확인하지 못했습니다. 원본과 편집본을 보존했습니다.');
          if(!active()){candidate.suspend();throw stale();}
          full=candidate;preview=null;ready();return full;
        }catch(error){if(active()){failed=error;change(error);}throw error;}
      })();
      loading=attempt;
      try{return await attempt;}finally{if(loading===attempt)loading=null;}
    }
    const current=(id)=>visible()?copy(preview?.notes[id]||null):null;
    const api={
      ensure,reset,matches:()=>bound===contextKey(),deferred:()=>Boolean(preview),
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
          dirty:notes.filter(n=>n.dirty||n.pending).length,conflicts:0,revisions:null,deferred:Boolean(preview),
          failed:Boolean(failed),unsupported:!suspended&&bound!==contextKey()};
      },
      idle:()=>full?full.idle():loading?loading.then(store=>store.idle()):Promise.resolve(),
      suspend(){epoch++;suspended=true;full?.suspend();full=null;preview=null;loading=null;failed=null;},
      suspended:()=>suspended,
      invalidate(){epoch++;full?.invalidate();loading=null;},
    };
    for(const name of ['view','entries','export','validateImport'])api[name]=(...args)=>{
      if(!full||!visible())throw Error('전체 이력을 먼저 불러와 확인하세요. 현재본만 내보내거나 변경하지 않았습니다.');
      return full[name](...args);
    };
    for(const name of ['track','edit','seal','sync','compare','importPending','restore','restoreLocal','bindBaseline','saveProtection',
      'replaceProtectionStore','beginLegacy','completeLegacy','selectReplica','localOnly','import'])api[name]=async(...args)=>{
      if(name==='sync'&&(!context().enabled||suspended))return;
      const generation=epoch,store=await ensure();if(generation!==epoch||!visible())throw stale();return store[name](...args);
    };
    return api;
  }
  globalThis.NowDeferredHistory={create};
  if(typeof module!=='undefined'&&module.exports)module.exports=globalThis.NowDeferredHistory;
})();
