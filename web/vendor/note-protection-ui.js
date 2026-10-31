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
    <section aria-label="저장된 표현"><select class="settings-select" name="representation" aria-label="저장된 표현"></select><button type="button" class="secondary-btn" data-action="read">열람</button><button type="button" class="secondary-btn" data-action="edit">현재 편집</button><button type="button" class="secondary-btn" data-action="transcript-edit">전사문 편집</button></section>
    <div class="history-actions"><button type="button" class="secondary-btn" data-action="create">현재 메모 생성</button><button type="button" class="secondary-btn" data-action="restore">선택 이력 복원</button><button type="button" class="secondary-btn danger" data-action="delete">메모 삭제</button></div>
    <div class="history-actions"><button type="button" class="secondary-btn" data-action="compare">미전송 내용 비교</button></div>
    <section class="protection-comparison hidden" aria-label="미전송 내용 비교"></section>
    <pre class="protection-plain" tabindex="0" aria-label="보호 메모 원문"></pre>
    <section class="protection-transcript hidden" aria-label="전사문 편집"><h3>전사문</h3><label>내용<textarea class="settings-input protection-transcript-draft" rows="8" aria-label="전사문 내용" spellcheck="false"></textarea></label><label><input type="checkbox" name="transcript-null">전사문 없음으로 저장</label><button type="button" class="primary-btn" data-action="transcript-save">전사문 저장</button></section>
    <section class="protection-editor hidden" aria-label="보호 메모 편집"><label>제목<input class="settings-input protection-title" aria-label="보호 메모 제목"></label><div class="history-actions" role="group" aria-label="본문 보기"><button type="button" class="secondary-btn" data-action="editor-source" aria-pressed="true">원문 편집</button><button type="button" class="secondary-btn" data-action="editor-preview" aria-pressed="false">서식 보기</button></div><label class="protection-source-label">본문<textarea class="settings-input protection-draft" aria-label="보호 메모 본문" spellcheck="false"></textarea></label><article class="markdown-preview protection-preview hidden" aria-label="보호 메모 서식 보기" tabindex="0"></article><button type="button" class="primary-btn" data-action="save">서버 저장</button></section>
    <section aria-label="보호 메모 분석"><h3>AI 분석</h3><select class="settings-select" name="analysis-operation" aria-label="분석 실행"></select><div class="history-actions"><button type="button" class="secondary-btn" data-action="analysis-prepare">분석 준비</button><button type="button" class="secondary-btn" data-action="analysis-resume">실행 상태 확인</button></div><div class="protection-analysis hidden"><label>제공업체<input class="settings-input" name="analysis-provider" readonly></label><label>전송 주소<input class="settings-input" name="analysis-endpoint"></label><label>모델<input class="settings-input" name="analysis-model"></label><label>전송할 입력<textarea class="settings-input" name="analysis-input" readonly></textarea></label><label><input type="checkbox" name="analysis-confirm">입력과 전송 대상을 확인했습니다</label><button type="button" class="primary-btn" data-action="analysis-run">분석 실행</button></div><pre class="protection-analysis-result" tabindex="0" aria-label="분석 결과"></pre></section>
    <div class="history-actions"><button type="button" class="secondary-btn" data-action="analysis-publish">서버에 결과 보관</button><button type="button" class="secondary-btn" data-action="analysis-replan">결과 보관 재계획</button></div>
    <div class="protection-replan hidden"><p class="protection-replan-context"></p><label><input type="checkbox" name="analysis-reuse-confirm">원 분석 결과를 그대로 재사용합니다</label><button type="button" class="primary-btn" data-action="analysis-replan-confirm">확인한 대상으로 보관</button></div>
    <section class="protection-copies" aria-label="귀속 확인할 옛 사본"></section>
    <div class="history-actions"><button type="button" class="secondary-btn" data-action="imports">미전송 이력 조회</button></div>
    <section class="protection-imports hidden" aria-label="가져올 원 이력"><div class="protection-import-rows protection-copies"></div><button type="button" class="primary-btn" data-action="import-selected">선택 이력 가져오기</button></section>
    <div class="history-actions"><button type="button" class="secondary-btn" data-action="confirm">선택 사본 귀속 확인</button><button type="button" class="primary-btn" data-action="conversion">전체 보호</button><button type="button" class="secondary-btn" data-action="current_plain_transition">현재만 평문</button><button type="button" class="secondary-btn" data-action="mixed_conversion">재암호화</button><button type="button" class="primary-btn" data-action="resume">전환 재개</button></div>`;
  document.body.append(dialog);
  const $ = s => dialog.querySelector(s);
  const state = {bound:'',run:0,busy:false,info:null,copies:[],importRows:[],previous:null,editorNote:null,composing:false,compared:null,editorSelection:null,analysis:null,replan:null,transcript:null,transcriptComposing:false};
  const keys = new Map();
  const analysisLabels={analysis_claiming:'실행 접수 확인 필요',analysis_claimed:'전송 확인 대기',analysis_dispatching:'전송 상태 확인 필요',analysis_running:'응답 확인 필요',analysis_terminal:'결과 보관 중',analysis_settling:'영수증 확인 필요',analysis_settled:'이 기기에 결과 보관됨',analysis_write_preparing:'서버 보관 준비 확인 필요',analysis_write_prepared:'암호문 전송 재개 필요',analysis_write_staged:'서버 보관 준비됨',analysis_write_committing:'게시 영수증 확인 필요',analysis_write_committed:'서버 저장됨 · 이 기기 검증 필요'};
  let askCancel = null;
  const replanLabels={analysis_replan_preparing:'원 결과 보관 계획 확인 필요',analysis_replan_allocated:'새 저장 대상 확인됨',analysis_replan_stored:'기존 저장 결과 확인 필요',analysis_replan_prepared:'재계획 암호문 전송 대기',analysis_replan_staged:'재계획 게시 준비됨',analysis_replan_committing:'재계획 영수증 확인 필요',analysis_replan_committed:'재계획 저장됨 · 출처 확인 필요'};
  function resetReplan() {
    state.replan=null;$('.protection-replan').classList.add('hidden');$('.protection-replan-context').textContent='';$('[name="analysis-reuse-confirm"]').checked=false;
  }
  const status = text => { $('.protection-status').textContent=text; };
  function resetTranscript() {
    state.transcript=null;state.transcriptInitialText='';state.transcriptComposing=false;$('.protection-transcript').classList.add('hidden');
    $('[name="transcript-null"]').checked=false;
    const old=$('.protection-transcript-draft');old.value='';old.defaultValue='';const next=old.cloneNode(false);old.readOnly=true;old.replaceWith(next);next.disabled=false;next.readOnly=false;bindTranscript();
  }
  function wipe() {
    keys.clear(); $('.protection-plain').textContent='';
    resetTranscript();
    resetReplan();
    state.analysis=null;$('.protection-analysis').classList.add('hidden');$('.protection-analysis-result').textContent='';
    for(const field of ['provider','endpoint','model','input'])$('[name="analysis-'+field+'"]').value='';
    $('[name="analysis-confirm"]').checked=false;
    state.compared=null;$('.protection-comparison').replaceChildren();$('.protection-comparison').classList.add('hidden');
    state.editorNote=null;state.composing=false;state.editorSelection=null;
    // Replacing cleared inputs also discards the browser's native Undo history.
    for(const selector of ['.protection-title','.protection-draft']) {
      const old=$(selector);old.value='';old.defaultValue='';const next=old.cloneNode(false);old.readOnly=true;old.replaceWith(next);
    }
    bindEditors();editorView(false);$('.protection-editor').classList.add('hidden');$('.protection-plain').classList.remove('hidden');
    state.importRows=[];$('.protection-import-rows').replaceChildren();$('.protection-imports').classList.add('hidden');
    askCancel?.(); api.lock();
  }
  function valid(token) {
    if (dialog.open && state.bound===api.contextKey() && state.run===token) return true;
    wipe(); return false;
  }
  function editorView(preview) {
    const editor=$('.protection-draft'),view=$('.protection-preview');
    if(preview) {
      state.editorSelection=[editor.selectionStart,editor.selectionEnd,editor.selectionDirection,editor.scrollTop];
      view.innerHTML=NowMarkdown.render(editor.value,{sections:true,images:false});
    } else view.replaceChildren();
    view.classList.toggle('hidden',!preview);$('.protection-source-label').classList.toggle('hidden',preview);
    $('[data-action="editor-source"]').setAttribute('aria-pressed',String(!preview));
    $('[data-action="editor-preview"]').setAttribute('aria-pressed',String(preview));
    if(!preview && state.editorNote && state.editorSelection) {
      const [start,end,direction,top]=state.editorSelection;editor.focus();editor.setSelectionRange(start,end,direction);editor.scrollTop=top;
    }
  }
  function controls() {
    const unlocked = api.canMutate(), info=state.info;
    for (const b of dialog.querySelectorAll('button:not([data-action="close"]):not([data-action="lock"])')) b.disabled=state.busy;
    $('[name="target"]').disabled=state.busy;
    $('[name="representation"]').disabled=state.busy;
    for (const purpose of ['conversion','current_plain_transition','mixed_conversion','confirm','resume','edit','compare','save','restore','delete','create','imports','import-selected','transcript-edit','transcript-save']) {
      const b=$(`[data-action="${purpose}"]`);
      b.disabled=state.busy || !unlocked || !info;
      b.title=unlocked?'':'전체 보호 검증 전에는 변경할 수 없습니다.';
    }
    if (!info) {$('[data-action="analysis-replan"]').disabled=true;$('[data-action="analysis-replan-confirm"]').disabled=true;return;}
    const analysisId=$('[name="analysis-operation"]').value;
    $('[data-action="analysis-prepare"]').disabled=state.busy||!unlocked||!api.analysisPrepare||(!analysisId&&(!info.catalog||Boolean(info.pending)));
    $('[data-action="analysis-resume"]').disabled=state.busy||!unlocked||!analysisId;
    $('[data-action="analysis-run"]').disabled=state.busy||!unlocked||!state.analysis||!$('[name="analysis-confirm"]').checked
      ||Boolean(state.analysis?.operation_id&&state.analysis.execution?.state!=='client_pending');
    $('[data-action="analysis-publish"]').disabled=state.busy||!unlocked||!api.analysisPublish||!(info.analysisOperations||[]).some(r=>r.id===analysisId&&r.phase==='analysis_settled');
    $('[data-action="analysis-replan"]').disabled=state.busy||!unlocked||!api.analysisReplanPrepare||!(info.analysisOperations||[]).some(r=>r.id===analysisId&&(r.phase==='analysis_settled'||r.phase.startsWith('analysis_write_')||r.phase.startsWith('analysis_replan_')));
    $('[data-action="analysis-replan-confirm"]').disabled=state.busy||!unlocked||!api.analysisReplanBegin||!state.replan||!$('[name="analysis-reuse-confirm"]').checked;
    $('[name="analysis-reuse-confirm"]').disabled=state.busy;
    $('[name="analysis-operation"]').disabled=state.busy;
    $('[data-action="imports"]').disabled=state.busy || !unlocked || Boolean(info.pending) || !info.catalog;
    $('[data-action="import-selected"]').disabled=state.busy || !unlocked || Boolean(info.pending)
      || !state.importRows.length || !$('.protection-import-rows input:checked');
    $('[data-action="edit"]').disabled=state.busy || !unlocked || Boolean(info.pending) || !info.catalog?.context.base.current_exists;
    $('[data-action="compare"]').disabled=state.busy || !unlocked || Boolean(info.pending) || !info.catalog?.context.base.current_exists;
    for(const choice of ['local','server']){
      const button=$('[data-action="resolve-'+choice+'"]');
      if(button)button.disabled=state.busy || !unlocked || Boolean(info.pending) || !state.compared;
    }
    $('[data-action="save"]').disabled=state.busy || !unlocked || Boolean(info.pending) || !state.editorNote || state.composing;
    for(const mode of ['source','preview'])$('[data-action="editor-'+mode+'"]').disabled=state.busy || !state.editorNote || state.composing;
    const row=info.rows[Number($('[name="representation"]').value)],d=row?.descriptor;
    $('[data-action="transcript-edit"]').disabled=state.busy||!unlocked||!api.transcriptEdit||Boolean(info.pending)||row?.kind!=='typed'||d?.key.kind!=='recording_transcript';
    $('[data-action="transcript-save"]').disabled=state.busy||!unlocked||!api.transcriptSave||Boolean(info.pending)||!state.transcript||state.transcriptComposing;
    $('.protection-transcript-draft').readOnly=state.busy;
    $('.protection-transcript-draft').disabled=$('[name="transcript-null"]').checked;
    $('[name="transcript-null"]').disabled=state.busy;
    $('[data-action="restore"]').disabled=state.busy || !unlocked || Boolean(info.pending) || !info.catalog
      || row?.kind!=='typed' || !['revision_snapshot','offline_snapshot'].includes(d?.key.kind) || d.is_null || !d.revision_ref;
    $('[data-action="delete"]').disabled=state.busy || !unlocked || Boolean(info.pending) || !info.catalog?.context.base.current_exists;
    $('[data-action="create"]').hidden=!info.catalog || info.catalog.context.base.current_exists;
    $('[data-action="create"]').disabled=state.busy || !unlocked || Boolean(info.pending) || !info.catalog || info.catalog.context.base.current_exists;
    $('.protection-draft').readOnly=state.busy;
    $('.protection-title').readOnly=state.busy;
    $('[data-action="conversion"]').hidden=info.status.crypto_epoch!==0;
    $('[data-action="current_plain_transition"]').hidden=info.catalog?.context.current_mode!=='protected';
    $('[data-action="mixed_conversion"]').hidden=info.status.crypto_epoch<1;
    $('[data-action="resume"]').hidden=!info.pending||info.pending.phase.startsWith('analysis_');
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
      const label=document.createElement('label'); label.textContent=String(epoch).startsWith('analysis-')?(epoch==='analysis-output'?'분석 결과를 보관할 비밀번호':'보관된 분석 결과의 비밀번호'):(epoch==='resolve-local-bundle'?'내 변경으로 저장 확인 · 저장 비밀번호':epoch==='resolve-server-bundle'?'서버 현재본으로 저장 확인 · 저장 비밀번호':epoch==='import-bundle'?'이력 가져오기 확인 · 저장 비밀번호':epoch==='write-bundle'?'저장 비밀번호':epoch==='delete-bundle'?'메모 삭제 확인 · 저장 비밀번호':epoch==='restore-bundle'?'선택 이력 복원 확인 · 저장 비밀번호':epoch==='local:new'?'이 기기 저장 비밀번호':output?'전환 비밀번호':'이전 비밀번호')+' · epoch '+epoch;
      const input=document.createElement('input'); input.type='password'; input.autocomplete='off'; input.className='settings-input'; input.required=true; label.append(input);
      if(epoch==='transcript-bundle')label.firstChild.textContent='전사문 저장 확인 · 저장 비밀번호';
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
    $('.protection-scope').replaceChildren();
    const token=++state.run;
    status('보호 상태 조회 중');
    const targets=$('[name="target"]');targets.replaceChildren();
    const ids=await api.targets();if(!valid(token))return;
    if(!ids.length)throw Error('현재 계정의 보호 대상이 없습니다.');
    for(const id of ids) {const o=document.createElement('option');o.value=id;o.textContent=api.targetLabel?.(id)||id;targets.append(o);}
    const chosen=ids.includes(api.target())?api.target():ids[0];
    if(chosen!==api.target()){api.selectTarget(chosen);state.bound=api.contextKey();}
    targets.value=chosen;
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
    const executions=$('[name="analysis-operation"]');executions.replaceChildren(new Option('새 분석',''));
    for(const row of info.analysisOperations||[])executions.append(new Option((analysisLabels[row.phase]||replanLabels[row.phase]||'분석 상태 확인')+' · '+row.id.slice(0,8),row.id));
    if(info.pending?.phase.startsWith('analysis_'))executions.value=info.pending.id;
    status(info.pending ? analysisLabels[info.pending.phase]||replanLabels[info.pending.phase]||api.phaseLabel(info.pending.phase) : state.copies.length ? '옛 사본 '+state.copies.length+'개 · 귀속 미확인' : api.canMutate()?'전환 준비 가능':'전체 보호 검증 전 · 변경 잠김');
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
        if(name==='transcript-edit') {
          const row=state.info?.rows[Number($('[name="representation"]').value)];
          resetTranscript();const edit=await api.transcriptEdit(state.info,row,resolveKey(token));
          if(!valid(token))return;
          state.transcript=edit;$('.protection-transcript-draft').value=edit.value??'';state.transcriptInitialText=$('.protection-transcript-draft').value;$('[name="transcript-null"]').checked=edit.value===null;
          $('.protection-transcript').classList.remove('hidden');$('.protection-editor').classList.add('hidden');$('.protection-plain').textContent='';status('전사문 편집 중');
        } else if(name==='transcript-save') {
          if(!state.transcript||state.transcriptComposing)throw Error('입력을 마친 뒤 저장하세요.');
          const edit=structuredClone(state.transcript),draft=$('.protection-transcript-draft').value;
          const value=$('[name="transcript-null"]').checked?null:edit.value!==null&&draft===state.transcriptInitialText?edit.value:draft;
          let password=await ask('transcript-bundle',true,token);if(!password||!valid(token))return;
          try{await api.transcriptSave(state.info,edit,value,password,resolveKey(token));if(valid(token)){await load();if(state.run===token+1&&valid(state.run))status('전사문 저장됨');}}finally{password=null;keys.clear();}
        } else if(name==='analysis-prepare') {
          resetReplan();
          const plan=await api.analysisPrepare(state.info,$('[name="analysis-operation"]').value||null,resolveKey(token));
          if(!valid(token))return;state.analysis=plan;
          for(const field of ['provider','endpoint','model'])$('[name="analysis-'+field+'"]').value=plan.route[field];
          for(const field of ['endpoint','model'])$('[name="analysis-'+field+'"]').readOnly=Boolean(plan.operation_id)||!['omniroute','ollama'].includes(plan.route.provider);
          $('[name="analysis-input"]').value=plan.input;$('[name="analysis-confirm"]').checked=false;
          $('.protection-analysis').classList.remove('hidden');$('.protection-analysis-result').textContent='';status('입력과 전송 대상을 확인하세요.');
        } else if(name==='analysis-run') {
          if(!state.analysis||!$('[name="analysis-confirm"]').checked)throw Error('입력과 전송 대상을 확인하세요.');
          const plan=state.analysis,route={provider:plan.route.provider,endpoint:$('[name="analysis-endpoint"]').value,model:$('[name="analysis-model"]').value};
          let password=await ask('analysis-bundle',true,token),handoff,observation;
          if(!password||!valid(token))return;
          try{
            handoff=await api.analysisBegin(plan,route,password);password=null;keys.clear();state.analysis=null;
            if(handoff.provider_state!=='ready'){if(valid(token)){await load();status('원 dispatch를 확인했습니다. 분석을 재호출하지 않았습니다. 실행 상태를 확인하세요.');}return;}
            $('.protection-analysis').classList.add('hidden');$('[name="analysis-input"]').value='';
            if(!valid(token))return;status('분석 응답 대기 중');
            observation=await api.analysisInvoke(handoff);
            if(!valid(token)){await api.analysisUnavailable(handoff,'key_unavailable');return;}
            password=await ask('analysis-output',true,token);
            if(!password||!valid(token)){await api.analysisUnavailable(handoff,'key_unavailable');return;}
            await api.analysisRecord(handoff,observation,password);observation=null;
            const result=await api.analysisFinish(handoff.operation_id,password);
            if(valid(token)){await load();if(valid(state.run)){$('.protection-analysis-result').textContent=result;status('분석 결과 암호화 보관됨 · 현재 메모 미적용');}}
          }finally{password=null;observation=null;keys.clear();}
        } else if(name==='analysis-publish') {
          const id=$('[name="analysis-operation"]').value;
          let password=await ask('analysis-publication',true,token);if(!password||!valid(token))return;
          try{const result=await api.analysisPublish(id,password);if(valid(token)){await load();if(valid(state.run)){$('.protection-analysis-result').textContent=result;status('서버 분석 결과 저장됨 · 현재 메모 미적용');}}}finally{password=null;keys.clear();}
        } else if(name==='analysis-replan') {
          resetReplan();state.analysis=null;$('.protection-analysis').classList.add('hidden');$('[name="analysis-input"]').value='';$('[name="analysis-confirm"]').checked=false;
          const id=$('[name="analysis-operation"]').value,password=await ask('analysis-bundle',true,token);if(!password||!valid(token))return;
          const plan=await api.analysisReplanPrepare(state.info,id,password);if(!valid(token))return;
          state.replan=plan;const originalBase=plan.original_source_context.base,source=originalBase.base||originalBase,target=plan.catalog.context.base;
          $('.protection-replan-context').textContent='원 분석: 보호 세대 '+source.crypto_epoch+' · 이력 '+source.history_generation+' / 저장 대상: 보호 세대 '+target.crypto_epoch+' · 이력 '+target.history_generation;
          $('.protection-replan').classList.remove('hidden');status('원 결과와 저장 대상을 확인하세요.');
        } else if(name==='analysis-replan-confirm') {
          const plan=state.replan;if(!plan||!$('[name="analysis-reuse-confirm"]').checked||$('[name="analysis-operation"]').value!==plan.operation_id)throw Error('원 결과 재사용과 저장 대상을 다시 확인하세요.');
          let password=await ask('analysis-bundle',true,token);if(!password||!valid(token))return;
          try{
            status('원 분석 결과 보관 중');
            const result=await api.analysisReplanBegin(plan,password,{confirmed_reuse_original_result:true,target_epoch:plan.catalog.context.base.crypto_epoch},resolveKey(token));
            if(valid(token)){await load();if(valid(state.run)){$('.protection-analysis-result').textContent=result;status('원 분석 결과 서버 보관됨 · 현재 메모 미적용');}}
          }finally{password=null;keys.clear();}
        } else if(name==='analysis-resume') {
          const id=$('[name="analysis-operation"]').value;
          let password=await ask('analysis-bundle',true,token);if(!password||!valid(token))return;
          try{const result=await api.analysisResume(id,password,resolveKey(token));if(valid(token)){await load();if(valid(state.run)){$('.protection-analysis-result').textContent=result;status('원 실행 상태 확인됨');}}}finally{password=null;keys.clear();}
        } else if(name==='imports') {
          const rows=await api.imports(state.info,resolveKey(token));
          if(!valid(token))return;
          state.importRows=rows;const list=$('.protection-import-rows');list.replaceChildren();
          for(const row of rows) {
            const label=document.createElement('label'),input=document.createElement('input'),text=document.createElement('span');
            input.type='checkbox';input.value=row.revision_id;input.checked=true;
            text.textContent=[row.title,row.created_at,row.origin_device_id,row.revision_id].filter(Boolean).join(' · ');
            label.append(input,text);list.append(label);
          }
          $('.protection-imports').classList.toggle('hidden',!rows.length);
          status(rows.length?'미전송 이력 '+rows.length+'개':'가져올 미전송 이력이 없습니다.');
        } else if(name==='import-selected') {
          const ids=[...dialog.querySelectorAll('.protection-import-rows input:checked')].map(e=>e.value);
          const password=await ask('import-bundle',true,token);
          if(!password || !valid(token))return;
          status('선택 이력 가져오는 중');await api.importSelected(state.info,ids,password,resolveKey(token));
          if(valid(token))await load();
        } else if(name==='compare') {
          state.compared=null;
          $('.protection-comparison').replaceChildren();
          const value=await api.compare(state.info,resolveKey(token));
          if(!valid(token))return;
          const panel=$('.protection-comparison');
          for(const [choice,label,note]of [['local','이 기기 미전송 초안',value.local],['server','서버 현재본',value.remote]]) {
            const section=document.createElement('section'),heading=document.createElement('h3'),pre=document.createElement('pre');
            heading.textContent=label;pre.textContent=note.title+'\n\n'+note.content;pre.tabIndex=0;
            const button=document.createElement('button');button.type='button';button.className='secondary-btn';button.dataset.action='resolve-'+choice;
            button.textContent=choice==='local'?'내 변경으로 저장':'서버 현재본으로 저장';
            section.append(heading,pre,button);panel.append(section);
          }
          state.compared=value;
          panel.classList.remove('hidden');status('읽기 전용 비교 · 미전송 '+value.pending+'건'+(value.conflict?' · 충돌 있음':''));
        } else if(name==='resolve-local'||name==='resolve-server') {
          if(!state.compared)throw Error('비교 내용을 다시 확인하세요.');
          const choice=name==='resolve-local'?'local':'server',compared=structuredClone(state.compared);
          const password=await ask(name+'-bundle',true,token);
          if(!password || !valid(token))return;
          status('선택한 내용 저장 중');await api.resolvePending(state.info,choice,compared,password,resolveKey(token));
          if(valid(token))await load();
        } else if(name==='editor-source'||name==='editor-preview') {
          if(!state.editorNote || state.composing)throw Error('입력을 마친 뒤 보기를 전환하세요.');
          editorView(name==='editor-preview');
        } else if(name==='edit'||name==='create') {
          const note=await api[name](state.info,resolveKey(token));
          if(valid(token)){state.editorNote=note;state.editorSelection=null;$('.protection-title').value=note.title;$('.protection-draft').value=note.content;editorView(false);$('.protection-editor').classList.remove('hidden');$('.protection-plain').classList.add('hidden');status('편집 중');}
        } else if(name==='save') {
          if(!state.editorNote || state.composing)throw Error('입력을 마친 뒤 저장하세요.');
          const note=structuredClone(state.editorNote),password=await ask('write-bundle',true,token);
          if(!password || !valid(token))return;
          status('보호 메모 저장 중');await api.write(state.info,note,password,resolveKey(token));
          if(valid(token))await load();
        } else if(name==='delete'||name==='restore') {
          const row=state.info?.rows[Number($('[name="representation"]').value)];
          const password=await ask(name+'-bundle',true,token);
          if(!password || !valid(token))return;
          status(name==='delete'?'보호 메모 삭제 중':'선택 이력 복원 중');
          await api.mutate(state.info,name,row,password,resolveKey(token));
          if(valid(token))await load();
        } else if (name==='confirm') {
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
    } catch(error) {if (valid(state.run)) {keys.clear();$('.protection-plain').textContent='';
      if(['compare','resolve-local','resolve-server'].includes(name)){state.compared=null;$('.protection-comparison').replaceChildren();$('.protection-comparison').classList.add('hidden');}
      if(name==='imports'||name==='import-selected'){wipe();state.info=null;}
      status(error.message || '보호 작업 실패 · 원본은 보존됩니다.');}}
    finally {state.busy=false;controls();}
  }
  dialog.addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(b)void action(b.dataset.action);});
  function draftInput(event) {
    if(!state.editorNote || state.busy || state.composing || event?.isComposing)return;
    state.editorNote.content=$('.protection-draft').value;
    state.editorNote.title=$('.protection-title').value;
    const token=state.run;status('초안 저장 중');
    void api.draft(state.info,structuredClone(state.editorNote)).then(()=>{if(valid(token))status('초안 저장됨');},error=>{if(valid(token))status(error.message||'초안 저장 실패');});
  }
  function bindEditors() {for(const editor of [$('.protection-draft'),$('.protection-title')]){
    editor.addEventListener('input',draftInput);
    editor.addEventListener('compositionstart',()=>{state.composing=true;controls();});
    editor.addEventListener('compositionend',()=>{state.composing=false;draftInput();controls();});
  }}
  bindEditors();
  $('.protection-preview').addEventListener('click',e=>{
    if(!valid(state.run))return;
    const file=e.target.closest('[data-local-path]');
    if(file){e.preventDefault();void api.openFile?.(file.dataset.localPath);return;}
    const wiki=e.target.closest('[data-wiki-link]');
    if(wiki){e.preventDefault();void api.openWiki?.(wiki.dataset.wikiLink);return;}
    const anchor=e.target.closest('a[href^="#"]');
    if(anchor){e.preventDefault();$('.protection-preview').querySelector('#'+CSS.escape(anchor.getAttribute('href').slice(1)))?.scrollIntoView({block:'nearest'});}
  });
  $('[name="target"]').addEventListener('change',()=>{api.selectTarget($('[name="target"]').value);state.bound=api.contextKey();void action('refresh');});
  $('[name="representation"]').addEventListener('change',()=>{resetTranscript();controls();});
  function bindTranscript() {
    const editor=$('.protection-transcript-draft');
    editor.addEventListener('compositionstart',()=>{state.transcriptComposing=true;controls();});
    editor.addEventListener('compositionend',()=>{state.transcriptComposing=false;controls();});
  }
  bindTranscript();$('[name="transcript-null"]').addEventListener('change',controls);
  $('[name="analysis-confirm"]').addEventListener('change',controls);
  $('[name="analysis-reuse-confirm"]').addEventListener('change',controls);
  $('[name="analysis-operation"]').addEventListener('change',()=>{resetReplan();state.analysis=null;$('.protection-analysis').classList.add('hidden');$('.protection-analysis-result').textContent='';controls();});
  $('.protection-import-rows').addEventListener('change',controls);
  dialog.addEventListener('close',()=>{if(dialog.open)return;++state.run;wipe();state.info=null;state.copies=[];$('.protection-copies').replaceChildren();$('[name="representation"]').replaceChildren();state.previous?.focus();});
  return {
    async open() {if(dialog.open)dialog.close();state.bound=api.contextKey();state.previous=document.activeElement;dialog.showModal();await action('refresh');},
    lock() {++state.run;wipe();if(dialog.open)status('잠김');},
    check() {if(dialog.open && state.bound!==api.contextKey())dialog.close();},
    invalidate() {++state.run;wipe();if(dialog.open)dialog.close();},
  };
};
