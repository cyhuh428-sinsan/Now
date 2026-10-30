/* Protected plaintext belongs only to this inspection dialog's live memory/DOM. */
globalThis.mountNoteProtection = function mountNoteProtection(api) {
  const dialog = document.createElement('dialog');
  dialog.id = 'noteProtectionDialog'; dialog.className = 'library-dialog note-protection-dialog';
  dialog.setAttribute('aria-labelledby','noteProtectionTitle');
  dialog.innerHTML = `<header class="library-header"><h2 id="noteProtectionTitle">메모 보호</h2><button type="button" class="ghost-btn" data-action="close">닫기</button></header>
    <p role="status" aria-live="polite" class="protection-status"></p>
    <label>보호 대상<select class="settings-select" name="target" aria-label="보호 대상"></select></label>
    <dl class="protection-scope"></dl>
    <div class="history-actions"><button type="button" class="secondary-btn" data-action="refresh">새로고침</button><button type="button" class="secondary-btn" data-action="lock">잠금</button></div>
    <section aria-label="저장된 표현"><select class="settings-select" name="representation" aria-label="저장된 표현"></select><button type="button" class="secondary-btn" data-action="read">열람</button></section>
    <pre class="protection-plain" tabindex="0" aria-label="보호 메모 원문"></pre>
    <section class="protection-copies" aria-label="귀속 확인할 옛 사본"></section>
    <div class="history-actions"><button type="button" class="secondary-btn" data-action="confirm">선택 사본 귀속 확인</button><button type="button" class="primary-btn" data-action="conversion">전체 보호</button><button type="button" class="secondary-btn" data-action="current_plain_transition">현재만 평문</button><button type="button" class="secondary-btn" data-action="mixed_conversion">재암호화</button><button type="button" class="primary-btn" data-action="resume">전환 재개</button></div>`;
  document.body.append(dialog);
  const $ = s => dialog.querySelector(s);
  const state = {bound:'',run:0,busy:false,info:null,copies:[],previous:null};
  const keys = new Map();
  let askCancel = null;
  const status = text => { $('.protection-status').textContent=text; };
  function wipe() {
    keys.clear(); $('.protection-plain').textContent='';
    askCancel?.(); api.lock();
  }
  function valid(token) {
    if (dialog.open && state.bound===api.contextKey() && state.run===token) return true;
    wipe(); return false;
  }
  function controls() {
    const unlocked = api.canMutate(), info=state.info;
    for (const b of dialog.querySelectorAll('button:not([data-action="close"]):not([data-action="lock"])')) b.disabled=state.busy;
    $('[name="target"]').disabled=state.busy;
    for (const purpose of ['conversion','current_plain_transition','mixed_conversion','confirm','resume']) {
      const b=$(`[data-action="${purpose}"]`);
      b.disabled=state.busy || !unlocked || !info;
      b.title=unlocked?'':'전체 보호 검증 전에는 변경할 수 없습니다.';
    }
    if (!info) return;
    $('[data-action="conversion"]').hidden=info.status.crypto_epoch!==0;
    $('[data-action="current_plain_transition"]').hidden=info.catalog?.context.current_mode!=='protected';
    $('[data-action="mixed_conversion"]').hidden=info.status.crypto_epoch<1;
    $('[data-action="resume"]').hidden=!info.pending;
    $('[data-action="confirm"]').hidden=!state.copies.length;
  }
  function requireAction(token) {
    if (!dialog.open || state.bound!==api.contextKey() || state.run!==token) throw Error('잠금 또는 대상 변경으로 이전 키 요청이 취소되었습니다.');
  }
  function ask(epoch,output=false,token=state.run) {
    requireAction(token);
    const slot=(output?'new:':'old:')+epoch;
    if (keys.has(slot)) return Promise.resolve(keys.get(slot));
    return new Promise(resolve=>{
      let finished=false;
      const section=document.createElement('form'); section.className='library-confirm';
      const label=document.createElement('label'); label.textContent=(output?'전환 비밀번호':'이전 비밀번호')+' · epoch '+epoch;
      const input=document.createElement('input'); input.type='password'; input.autocomplete='off'; input.className='settings-input'; input.required=true; label.append(input);
      const cancel=document.createElement('button'), submit=document.createElement('button');
      cancel.type='button';submit.type='submit';cancel.className=submit.className='secondary-btn';cancel.textContent='취소';submit.textContent='확인';
      const finish=value=>{if(finished)return;finished=true;input.value='';section.remove();askCancel=null;resolve(value);};
      askCancel=()=>finish(null);cancel.addEventListener('click',()=>finish(null));
      section.addEventListener('submit',e=>{e.preventDefault();if(finished)return;try{requireAction(token);}catch{finish(null);return;}const key=input.value;if(!key)return;keys.set(slot,key);finish(key);});
      section.append(label,cancel,submit);dialog.append(section);input.focus();
    });
  }
  const resolveKey = token => async d => {
    requireAction(token);
    const key=await ask(d.representation_epoch,d.output===true,token);
    requireAction(token);
    if (!key) throw Error('키 입력이 취소되었습니다.');
    return key;
  };
  async function load() {
    wipe(); state.info=null; state.copies=[];
    const token=++state.run;
    status('보호 상태 조회 중');
    const targets=$('[name="target"]');targets.replaceChildren();
    for(const id of api.targets()) {const o=document.createElement('option');o.value=id;o.textContent=id;targets.append(o);}
    targets.value=api.target();
    const info=await api.inspect(); if (!valid(token)) return;
    state.info=info;
    const dl=$('.protection-scope');dl.replaceChildren();
    for(const [name,value] of [['서버',info.scope.url],['계정',info.scope.owner],['메모',info.scope.local_id],['서버 식별',info.scope.instance]]) {
      const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=name;dd.textContent=value;dl.append(dt,dd);
    }
    const select=$('[name="representation"]');select.replaceChildren();
    for(const [index,row] of info.rows.entries()) {const o=document.createElement('option');o.value=index;o.textContent=row.label;select.append(o);}
    if (!info.pending) state.copies=await api.copies(info.scope);
    if (!valid(token)) return;
    const list=$('.protection-copies');list.replaceChildren();
    for(const item of state.copies) {
      const label=document.createElement('label'),box=document.createElement('input'),text=document.createElement('span');
      box.type='checkbox';box.value=item.id;
      text.textContent=[item.store,item.path.join(' / '),item.title,item.updated_at].filter(Boolean).join(' · ');
      label.append(box,text);list.append(label);
    }
    status(info.pending ? api.phaseLabel(info.pending.phase) : state.copies.length ? '옛 사본 '+state.copies.length+'개 · 귀속 미확인' : api.canMutate()?'전환 준비 가능':'전체 보호 검증 전 · 변경 잠김');
  }
  async function action(name) {
    if (name==='close') {dialog.close();return;}
    if (name==='lock') {++state.run;wipe();status('잠김');return;}
    if (state.busy) return;
    state.busy=true;controls();const token=state.run;
    try {
      if (!valid(token)) throw Error('인증 또는 메모가 변경되었습니다. 다시 여세요.');
      if (name==='refresh') await load();
      else if (name==='read') {
        const row=state.info?.rows[Number($('[name="representation"]').value)];
        if (!row) throw Error('열람할 표현이 없습니다.');
        $('.protection-plain').textContent='';
        const value=await api.read(state.info,row,resolveKey(token));
        if (valid(token)) { $('.protection-plain').textContent=value;status('읽기 전용 · 잠금 해제됨'); }
      } else {
        if (!api.canMutate()) throw Error('전체 보호 검증 전에는 변경할 수 없습니다.');
        if (name==='confirm') {
          await api.confirm(state.info.scope,state.copies,[...dialog.querySelectorAll('.protection-copies input:checked')].map(e=>e.value));
          if (valid(token)) await load();
        } else {
          if (!state.info) throw Error('보호 상태를 다시 조회하세요.');
          $('.protection-plain').textContent='';
          const epoch=name==='resume'?'bundle':name==='current_plain_transition'?state.info.status.crypto_epoch:state.info.status.crypto_epoch+1;
          const password=await ask(epoch,true,token);
          if (!password || !valid(token)) return;
          status('전환 처리 중');
          if (name==='resume') await api.resume(state.info,password,resolveKey(token));
          else await api.convert(state.info,name,password,resolveKey(token));
          if (valid(token)) await load();
        }
      }
    } catch(error) {if (valid(state.run)) {keys.clear();$('.protection-plain').textContent='';status(error.message || '보호 작업 실패 · 원본은 보존됩니다.');}}
    finally {state.busy=false;controls();}
  }
  dialog.addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(b)void action(b.dataset.action);});
  $('[name="target"]').addEventListener('change',()=>{api.selectTarget($('[name="target"]').value);state.bound=api.contextKey();void action('refresh');});
  dialog.addEventListener('close',()=>{if(dialog.open)return;++state.run;wipe();state.info=null;state.copies=[];$('.protection-copies').replaceChildren();$('[name="representation"]').replaceChildren();state.previous?.focus();});
  return {
    async open() {if(dialog.open)dialog.close();state.bound=api.contextKey();state.previous=document.activeElement;dialog.showModal();await action('refresh');},
    lock() {++state.run;wipe();if(dialog.open)status('잠김');},
    check() {if(dialog.open && state.bound!==api.contextKey())dialog.close();},
    invalidate() {++state.run;wipe();if(dialog.open)dialog.close();},
  };
};
