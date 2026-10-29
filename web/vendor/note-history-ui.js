/* History is a plain-text inspection surface, never a Markdown execution surface. */
globalThis.mountNoteHistory = function mountNoteHistory(api) {
  const dialog = document.createElement('dialog');
  dialog.id = 'noteHistoryDialog'; dialog.className = 'library-dialog note-history-dialog';
  dialog.setAttribute('aria-labelledby', 'noteHistoryTitle');
  dialog.innerHTML = `<header class="library-header"><h2 id="noteHistoryTitle">메모 이력</h2><button type="button" data-action="close" class="ghost-btn">닫기</button></header>
    <p class="history-status" role="status" aria-live="polite"></p>
    <div class="history-controls"><label>기준 시점<select class="settings-select" name="before"></select></label><label>비교 시점<select class="settings-select" name="after"></select></label>
    <button class="secondary-btn" data-action="refresh" type="button">새로고침</button><button class="secondary-btn" data-action="more" type="button">더 보기</button></div>
    <div class="history-actions"><button class="secondary-btn" data-action="decrypt" type="button">잠금 해제 후 비교</button><button class="primary-btn" data-action="restore" type="button">선택 시점 복원</button><button class="secondary-btn" data-action="replica" type="button">현재 대표만 저장</button></div>
    <section class="history-metadata" aria-label="메타데이터 차이"></section><pre class="history-diff" tabindex="0" aria-label="본문 차이"></pre>`;
  document.body.append(dialog);
  const $ = selector => dialog.querySelector(selector);
  let id = '', rows = [], cursor = null, current = null, busy = false, run = 0, bound = '', previousFocus = null, confirmation = null;
  const cache = new Map(), plain = new Map();
  const reasons = { baseline: '이력 기록 시작', write: '저장', edit: '편집', delete: '삭제', restore: '복원', before_restore: '복원 직전', offline_import: '오프라인 분기' };
  const status = value => { $('.history-status').textContent = value; };
  const valid = token => dialog.open && token === run && bound === api.contextKey();
  const refKey = ref => JSON.stringify(ref);
  const option = (key, text) => { const node = document.createElement('option'); node.value = key; node.textContent = text; return node; };
  function ask(message, secret = false) {
    return new Promise(resolve => {
      const siblings = [...dialog.children], focus = document.activeElement;
      siblings.forEach(node => { node.inert = true; });
      const prompt = document.createElement('section'); prompt.className = 'library-confirm';
      prompt.setAttribute('role', 'alertdialog'); prompt.setAttribute('aria-label', message);
      const text = document.createElement('p'); text.textContent = message;
      const input = document.createElement('input'); input.type = 'password'; input.autocomplete = 'off'; input.className = 'settings-input'; input.setAttribute('aria-label', '과거 암호화 메모 비밀번호');
      const cancel = document.createElement('button'), ok = document.createElement('button');
      cancel.type = ok.type = 'button'; cancel.className = ok.className = 'secondary-btn';
      cancel.textContent = '취소'; ok.textContent = secret ? '잠금 해제' : '복원';
      confirmation = value => { const result = secret ? (value ? input.value : null) : value; input.value = ''; siblings.forEach(node => { node.inert = false; }); prompt.remove(); confirmation = null; focus?.focus(); resolve(result); };
      cancel.addEventListener('click', () => confirmation?.(false)); ok.addEventListener('click', () => confirmation?.(true));
      prompt.append(text); if (secret) prompt.append(input); prompt.append(cancel, ok); dialog.append(prompt); (secret ? input : cancel).focus();
    });
  }
  function updateOptions() {
    for (const name of ['before', 'after']) {
      const select = $(`[name="${name}"]`), selected = select.value;
      select.replaceChildren(...rows.map(row => option(row.key, row.label)));
      if (rows.some(row => row.key === selected)) select.value = selected;
      else select.selectedIndex = name === 'before' ? 0 : Math.min(1, rows.length - 1);
    }
    $('[data-action="more"]').disabled = !cursor;
    $('[data-action="replica"]').hidden = !(current?.replica_count > 1);
  }
  async function snapshot(key) {
    if (!dialog.open || bound !== api.contextKey()) return null;
    if (cache.has(key)) return cache.get(key);
    const row = rows.find(item => item.key === key);
    if (!row?.ref) return null;
    const token = run;
    const result = await api.request('revision', 'GET', { local_id: id, revision_kind: row.ref.kind, revision_id: row.ref.id });
    if (!valid(token)) return null;
    cache.set(key, result.snapshot);
    return result.snapshot;
  }
  async function showDiff() {
    const token = ++run, leftKey = $('[name="before"]').value, rightKey = $('[name="after"]').value;
    const left = await snapshot(leftKey), right = await snapshot(rightKey);
    if (!valid(token) || !left || !right) return;
    const metadata = $('.history-metadata'); metadata.replaceChildren();
    for (const field of ['title', 'note_type', 'parent_local_id', 'level', 'tags', 'source', 'deleted_at']) {
      if (left.note[field] === right.note[field]) continue;
      const row = document.createElement('p'); row.textContent = `${field}: ${JSON.stringify(left.note[field])} → ${JSON.stringify(right.note[field])}`; metadata.append(row);
    }
    const encrypted = value => String(value || '').startsWith('NOW_ENCRYPTED_V1:');
    const a = encrypted(left.note.content) ? plain.get(leftKey) : left.note.content;
    const b = encrypted(right.note.content) ? plain.get(rightKey) : right.note.content;
    const output = $('.history-diff'); output.replaceChildren();
    $('[data-action="decrypt"]').hidden = !(encrypted(left.note.content) || encrypted(right.note.content));
    if (a === undefined || b === undefined) { output.textContent = '암호화된 본문입니다.'; return; }
    const changes = Diff.diffLines(a, b, { timeout: 1500 });
    if (!changes) { output.textContent = '비교 시간이 초과되었습니다. 원문은 보존되어 있습니다.'; return; }
    for (const part of changes) {
      const node = document.createElement(part.added ? 'ins' : part.removed ? 'del' : 'span');
      node.textContent = part.value; output.append(node);
    }
    if (a === b) status('두 시점의 본문이 같습니다.');
    else if (a.endsWith('\n') !== b.endsWith('\n')) status('마지막 줄바꿈이 다릅니다.');
  }
  async function load(more = false) {
    if (busy) return;
    busy = true; const token = ++run;
    try {
      status('이력 조회 중…');
      if (!more) {
        rows = []; cache.clear(); plain.clear(); cursor = null;
        const item = api.store.view(id);
        if (!item) throw new Error('현재 계정에서 사용할 수 없는 메모입니다.');
        rows.push({ key: 'draft', label: '현재 로컬 편집본' }); cache.set('draft', { schema_version: 1, note: item.draft });
        for (const revision of [...item.revisions].reverse()) {
          const key = 'local:' + revision.revision_id;
          rows.push({ key, ref: { kind: 'offline_branch', id: revision.revision_id }, local: true,
            label: `${revision.created_at} · ${reasons[revision.reason] || revision.reason} · 로컬` });
          cache.set(key, revision.snapshot);
        }
        if (!api.online(id)) {
          current = null; updateOptions(); status('오프라인 · 복원은 로컬 분기로 보존됩니다.'); return;
        }
        try { current = (await api.store.compare(id)).remote; }
        catch (error) { if (error.code !== 'ambiguous_note_identity') throw error; current = null; }
        if (!valid(token)) return;
      }
      const page = await api.request('revisions', 'GET', { local_id: id, limit: 50, ...(cursor ? { cursor } : {}) });
      if (!valid(token)) return;
      for (const row of page.items) {
        const key = refKey(row.revision_ref);
        if (rows.some(item => item.key === key)) continue;
        rows.push({ key, ref: row.revision_ref, label: `${row.captured_at} · ${reasons[row.reason] || row.reason} · ${row.revision_ref.kind === 'offline_branch' ? '분기' : '서버'}` });
      }
      cursor = page.next_cursor; updateOptions();
      const item = api.store.view(id);
      const bytes = new TextEncoder().encode(JSON.stringify(item)).length;
      status(item?.conflict ? '충돌 · 로컬 편집본과 서버 이력을 보존했습니다.' : `${rows.length}개 시점 · ${current?.replica_count || 0}개 물리 복제본 · 로컬 ${(bytes / 1024).toFixed(1)} KiB`);
    } finally { busy = false; }
    await showDiff();
  }
  async function execute(action) {
    if (action === 'close') { dialog.close(); return; }
    if (busy) return;
    if (action === 'refresh') return load();
    if (action === 'more') return load(true);
    busy = true;
    try {
      if (action === 'replica') {
        await api.store.selectReplica(id, (await api.store.compare(id)).remote);
        await api.store.sync(); status('현재 대표만 저장 대상으로 선택했습니다. 다른 복제본은 보존됩니다.');
      } else if (action === 'decrypt') {
        const token = run;
        for (const name of ['before', 'after']) {
          const key = $(`[name="${name}"]`).value, value = await snapshot(key);
          if (String(value?.note.content || '').startsWith('NOW_ENCRYPTED_V1:')) {
            let password = await ask('이 시점의 메모 비밀번호를 입력하세요.', true);
            if (!password || !valid(token)) return;
            const text = await api.decrypt(value.note.content, password);
            password = '';
            if (text == null || !valid(token)) return;
            plain.set(key, text);
          }
        }
        await showDiff();
      } else if (action === 'restore') {
        const token = run;
        const row = rows.find(item => item.key === $('[name="after"]').value), target = await snapshot(row?.key);
        if (!target || !row?.ref) throw new Error('복원할 과거 시점을 선택하세요.');
        if (!await ask('현재 편집본을 보존하고 선택한 시점으로 복원할까요?' + (current?.replica_count > 1 ? ' 현재 대표만 바꾸고 나머지 복제본은 그대로 보존합니다.' : ''))) return;
        if (!valid(token)) return;
        if (api.online(id)) {
          if (!current) throw new Error('현재 기준을 다시 조회하세요.');
          const receipt = await api.store.restore(id, row.ref, current);
          if (!valid(token)) return;
          const item = api.store.view(id);
          if (!receipt || item.conflict || item.outbox.length) throw new Error(item.conflict?.code || item.error?.message || '복원 결과를 확인하지 못했습니다. 재연결하세요.');
          const latest = await api.request('current', 'GET', { local_id: id });
          if (!valid(token)) return;
          if (latest.head_revision_id !== receipt.result_revision_id) throw new Error('복원 뒤 다른 변경이 도착했습니다. 최신본과 다시 비교하세요.');
          const pending = api.store.view(id);
          await api.apply(pending.dirty ? pending.draft : latest.snapshot.note);
          status('서버 복원 완료 · 복원 직전본은 이력에 보존했습니다.' + (pending.dirty ? ' 이후 편집본은 별도로 보존했습니다.' : ''));
        } else {
          await api.store.restoreLocal(id, target); await api.apply(target.note);
          status('로컬 복원 분기 보존 완료 · 서버 채택 전입니다.');
        }
      }
    } finally { busy = false; }
  }
  dialog.addEventListener('click', event => {
    const button = event.target.closest('[data-action]');
    if (button) execute(button.dataset.action).catch(error => status(error.message));
  });
  dialog.addEventListener('change', event => {
    if (event.target.matches('select[name=before],select[name=after]')) showDiff().catch(error => status(error.message));
  });
  dialog.addEventListener('cancel', event => { if (confirmation) { event.preventDefault(); confirmation(false); } });
  dialog.addEventListener('close', () => { confirmation?.(false); run++; plain.clear(); cache.clear(); rows = []; $('.history-diff').replaceChildren(); $('.history-metadata').replaceChildren(); previousFocus?.focus(); });
  return {
    async open(localId) { id = localId; bound = api.contextKey(); previousFocus = document.activeElement; dialog.showModal(); await load().catch(error => status(error.message)); },
    close() { if (dialog.open) dialog.close(); plain.clear(); cache.clear(); },
  };
};
