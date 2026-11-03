/* Status inspection never materializes the complete history journal. */
(() => {
  'use strict';
  function rows(store){
    return store?.issues?.()||[];
  }
  function responseError(status,result){
    const code=typeof result?.detail?.code==='string'&&/^[a-z0-9_]{1,100}$/.test(result.detail.code)?result.detail.code:null;
    const details=Array.isArray(result?.detail)?result.detail.slice(0,3).map(item=>{
      const path=Array.isArray(item.loc)?item.loc.filter(value=>Number.isInteger(value)||typeof value==='string'&&/^[A-Za-z_][A-Za-z0-9_]{0,50}$/.test(value)).join('.'):'request';
      const reason=String(item.msg||'').includes('timezone required')?'시간대가 없는 날짜':/^[a-z0-9_]{1,60}$/.test(item.type||'')?item.type:'형식 오류';
      return path+': '+reason;
    }).join(' · '):'';
    return Object.assign(new Error(code||'HTTP '+status+(details?' · '+details:'')),{status,code});
  }
  function mount(api){
    const dialog=document.createElement('dialog');dialog.id='syncStatusDialog';dialog.className='library-dialog sync-status-dialog';dialog.setAttribute('aria-label','동기화 상태');
    const header=document.createElement('header');header.className='library-header';
    const title=document.createElement('h2');title.textContent='동기화 상태';
    const close=document.createElement('button');close.type='button';close.className='ghost-btn';close.textContent='닫기';close.onclick=()=>dialog.close();header.append(title,close);
    const summary=document.createElement('p');summary.setAttribute('role','status');summary.setAttribute('aria-live','polite');
    const list=document.createElement('section');list.setAttribute('aria-label','문서별 동기화 문제');
    const refresh=document.createElement('button');refresh.type='button';refresh.className='secondary-btn';refresh.textContent='새로고침';refresh.onclick=render;
    const settings=document.createElement('button');settings.type='button';settings.className='secondary-btn';settings.textContent='연결 설정';settings.onclick=()=>{dialog.close();api.settings();};
    dialog.append(header,summary,list,refresh,settings);document.body.append(dialog);
    let bound='',focus=null;
    function check(){if(dialog.open&&bound!==api.contextKey()){dialog.close();list.replaceChildren();summary.textContent='';}}
    function render(){
      check();if(!dialog.open)return;
      const items=rows(api.store()),message=api.message(),active=items.filter(item=>item.active);
      summary.textContent=(active.length?'확인 필요 '+active.length+'건 · ':'')+(message||'저장된 동기화 오류가 없습니다.');
      list.replaceChildren();
      for(const item of items){
        const row=document.createElement('section');row.className='server-conflict-item';
        const text=document.createElement('span'),name=document.createElement('strong'),detail=document.createElement('span');
        name.textContent=item.title;
        const category=item.excluded?'PC 보관 · 동기화 제외':!item.active?'과거 오류 기록':item.conflicted?'충돌 확인 필요':'전송 오류';
        const reason={invalid_note_parent:'부모 메모를 확인할 수 없음',baseline_selection_required:'PC본·서버본 비교 필요',import_failed:'이력 전송 실패'}[item.code]||item.code;
        detail.textContent=' · '+category+(item.deleted?' · 삭제 보관함':'')+(reason?' · '+reason:'')+(item.message&&item.message!==item.code?' · '+item.message:'');
        text.append(name,detail);row.append(text);
        const history=document.createElement('button');history.type='button';history.className='secondary-btn';history.textContent='메모 이력';
        history.onclick=()=>{check();if(!dialog.open)return;dialog.close();Promise.resolve(api.history(item.id)).catch(error=>api.notice(error.message));};row.append(history);list.append(row);
      }
      if(!items.length){const empty=document.createElement('p');empty.textContent='문서별 충돌·오류 기록이 없습니다.';list.append(empty);}
    }
    dialog.addEventListener('close',()=>{list.replaceChildren();summary.textContent='';focus?.focus();});
    return {open(){if(dialog.open){render();return;}focus=document.activeElement;bound=api.contextKey();dialog.showModal();render();},check,
      close(){if(dialog.open)dialog.close();}};
  }
  const api={rows,mount,responseError};globalThis.NowSyncStatus=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})();
