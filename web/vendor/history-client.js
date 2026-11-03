/* Shared history initialization; workspace UI and authentication remain with the host. */
(() => {
  'use strict';
  async function create({backend,context,request,ready,change,storeChange,legacyStrings=false}){
    const contextKey=()=>{const ctx=context();return JSON.stringify([NowNoteHistory.key(ctx),ctx.auth,ctx.device,ctx.enabled]);};
    const accountKey=()=>NowNoteHistory.key(context());
    const normalize=snapshot=>{
      if(!legacyStrings||typeof snapshot.value!=='string')return snapshot;
      try{return {...snapshot,value:JSON.parse(snapshot.value),scoped:false};}
      catch{return {...snapshot,value:{schema_version:'unreadable',raw:snapshot.value},scoped:false};}
    };
    const readInitial=async()=>{
      const bound=contextKey(),guard={active:()=>bound===contextKey()};
      if(backend.current){
        try{
          const preview=await backend.current(accountKey(),guard);
          if(!guard.active())throw Error('저장 계정이 변경되었습니다.');
          if(preview.supported&&typeof preview.stamp==='string')return {preview};
        }catch(error){if(!guard.active())throw error;}
      }
      const snapshot=normalize(await backend.open(guard));
      if(!guard.active())throw Error('저장 계정이 변경되었습니다.');return {snapshot};
    };
    const history=NowDeferredHistory.create({initial:await readInitial(),context,contextKey,accountKey,
      select:backend.select,saveNote:backend.note,readPage:backend.page,request,ready,change,
      load:async guard=>normalize(await backend.open(guard)),
      build:opened=>{
        const writer=NowJournalWrites.create({initial:opened.value,revision:opened.revision,scoped:opened.scoped,contextKey,full:backend.full,note:backend.note});
        return NowNoteHistory.create({initial:opened.value,context,request,change:storeChange,
          write:(value,guard)=>writer.write(value,guard),writeNote:(ctx,id,value,guard)=>writer.writeNote(ctx,id,value,guard)});
      }});
    return {history,contextKey,accountKey,readInitial,normalize};
  }
  globalThis.NowHistoryClient={create};
})();
