/* The same revision-bound backend is used by memo and Wiki workspaces. */
(() => {
  'use strict';
  async function create({native:storage=null,browser,readLegacy,key}){
    let stamp=null;
    const remember=(result,web=false)=>{stamp=typeof result?.stamp==='string'?result.stamp:web&&typeof result?.revision==='string'?result.revision:null;return result;};
    if(!storage)return {
      stamp:()=>stamp,open:async guard=>remember(await browser().readSnapshot(guard),true),page:(request,guard)=>browser().readHistoryPage(request,guard),
      select:async(request,guard)=>remember(await browser().selectNote(request,guard),true),current:(account,guard)=>browser().readCurrent(account,guard),
      full:async(request,guard)=>remember(await browser().writeSnapshot(request.expected,request.next,guard),true),note:async(request,guard)=>remember(await browser().replaceNote(request,guard),true)};
    const info=await storage.info();let expected;
    const check=guard=>{if(guard?.active&&!guard.active())throw Error('저장 계정이 변경되었습니다.');};
    const required=guard=>{if(typeof guard?.active!=='function')throw Error('저장 인증 상태를 확인하세요.');check(guard);};
    const unwrap=result=>{if(!result?.ok)throw Object.assign(Error(result?.message||'이력 저장 기준을 확인하세요.'),{committed:result?.committed===true});return result;};
    const read=async(method,input,guard)=>{if(['select','page'].includes(method))required(guard);check(guard);const result=unwrap(await storage.history[method](input));check(guard);return ['open','select'].includes(method)?remember(result):result;};
    if(info.historySessions&&storage.history)return {
      stamp:()=>stamp,
      open:guard=>read('open',undefined,guard),
      ...(storage.history.select?{select:(request,guard)=>read('select',request,guard)}:{}),
      ...(storage.history.current?{current:(account,guard)=>read('current',account,guard)}:{}),
      ...(storage.history.page?{page:(request,guard)=>read('page',request,guard)}:{}),
      full:async(request,guard)=>{required(guard);return remember(unwrap(await storage.history.full({revision:request.revision,next:request.next})));},
      note:async(request,guard)=>{required(guard);return remember(unwrap(await storage.history.note(request)));}};
    return {
      stamp:()=>null,
      open:async()=>{expected=await readLegacy();return {value:expected,revision:null,scoped:false};},
      full:async(request,guard)=>{
        required(guard);const result=await storage.write(key,request.next,{expectedValue:expected});
        if(!result?.ok||JSON.stringify(await storage.read(key))!==JSON.stringify(request.next))throw Error('이력 저장 재조회 실패');
        expected=request.next;return {revision:null,scoped:false};}};
  }
  globalThis.NowHistoryPersistence={create};
})();
