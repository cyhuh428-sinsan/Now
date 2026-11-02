/* 공통 Web/Electron 관리 화면. 인증·메모 접근은 호출자가 제공한다. */
globalThis.mountNowLibrary = function mountNowLibrary(api) {
  const dialog = document.createElement('dialog');
  dialog.id = 'libraryDialog'; dialog.className = 'library-dialog';
  dialog.setAttribute('aria-labelledby', 'libraryTitle');
  dialog.innerHTML = `<header class="library-header"><h2 id="libraryTitle">템플릿·저장조건</h2><button type="button" data-action="close" class="ghost-btn">닫기</button></header>
    <div class="library-tabs" role="tablist" aria-label="자료 종류"><button type="button" role="tab" data-kind="templates">문서 템플릿</button><button type="button" role="tab" data-kind="saved-queries">저장조건</button></div>
    <div class="library-toolbar"><button type="button" data-action="new" class="secondary-btn">새로 만들기</button><button type="button" data-action="capture" class="secondary-btn">현재 메모로 만들기</button><button type="button" data-action="sync" class="secondary-btn">동기화</button></div>
    <p id="libraryStatus" role="status" aria-live="polite"></p>
    <div class="library-layout"><nav id="libraryList" aria-label="저장 자료"></nav><section id="libraryDetail" role="tabpanel" aria-label="선택 자료"></section></div>
    <section id="libraryConflicts" aria-label="충돌 비교"></section>`;
  document.body.append(dialog);
  const $ = s => dialog.querySelector(s);
  let kind = 'templates', selectedId = null, displayed = null, dirty = false, boundContext = '', busy = false;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const button = (action, label) => `<button type="button" class="secondary-btn" data-action="${action}">${label}</button>`;
  const field = (name, label, value, type = 'text') => `<label>${label}<input class="settings-input" name="${name}" type="${type}" value="${esc(value)}"></label>`;
  const area = (name, label, value) => `<label class="library-wide">${label}<textarea class="settings-input" name="${name}" rows="${name === 'content' ? 8 : 3}">${esc(value)}</textarea></label>`;
  const select = (name, label, value, options) => `<label>${label}<select class="settings-select" name="${name}">${options.map(([v, t]) => `<option value="${esc(v)}" ${String(v) === String(value) ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>`;
  const rows = () => kind === 'templates' ? [...api.builtins(), ...api.store.list(kind)] : api.store.list(kind);
  const current = () => rows().find(r => r.id === selectedId);
  let confirmation = null;
  function ask(text) {
    if (confirmation) return Promise.resolve(false);
    return new Promise(resolve => {
      const previous = document.activeElement, siblings = [...dialog.children];
      siblings.forEach(node => { node.inert = true; });
      const prompt = document.createElement('section'); prompt.className = 'library-confirm';
      prompt.setAttribute('role', 'alertdialog'); prompt.setAttribute('aria-label', text);
      const p = document.createElement('p'); p.textContent = text;
      const cancel = document.createElement('button'), ok = document.createElement('button');
      cancel.type = ok.type = 'button'; cancel.className = ok.className = 'secondary-btn';
      cancel.textContent = '취소'; ok.textContent = '확인';
      const finish = value => {
        siblings.forEach(node => { node.inert = false; }); prompt.remove(); confirmation = null;
        previous?.focus(); resolve(value);
      };
      confirmation = finish; cancel.onclick = () => finish(false); ok.onclick = () => finish(true);
      prompt.onkeydown = event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); finish(false); } };
      prompt.append(p, cancel, ok); dialog.prepend(prompt); cancel.focus(); prompt.scrollIntoView({ block: 'nearest' });
    });
  }
  const clean = async () => !dirty || await ask('저장하지 않은 변경을 버릴까요?');
  const message = (text, error = false) => { $('#libraryStatus').textContent = text; $('#libraryStatus').dataset.error = String(error); };
  const safe = action => async () => { try { await action(); } catch (e) { message(e.message, true); } };
  function status() {
    if (boundContext !== api.contextKey()) {
      selectedId = null; dirty = false; boundContext = api.contextKey(); render(); return;
    }
    const s = api.store.status();
    const error = s.error || s.outbox?.find(o => o.error)?.error?.message;
    message(error || `${api.contextLabel()} · ${s.outbox?.length || 0}건 전송 대기${busy ? ' · 동기화 중' : ''}`, Boolean(error));
    renderList(); renderConflicts();
  }
  function renderList() {
    $('#libraryList').replaceChildren();
    for (const row of rows()) {
      const b = document.createElement('button'); b.type = 'button';
      b.className = 'library-item'; b.dataset.id = row.id;
      b.setAttribute('aria-current', String(selectedId === row.id));
      const title = document.createElement('strong'); title.textContent = row.payload?.name || row.id;
      const info = document.createElement('small');
      info.textContent = row.builtin ? '기본 양식' : row.readonly ? '지원하지 않는 형식 · 원본 보존' : row.conflict ? '충돌 · 비교 필요' : row.pending ? '전송 대기' : `버전 ${row.version}`;
      b.append(title, info);
      b.onclick = safe(async () => { if (!await clean()) return; selectedId = row.id; dirty = false; render(); });
      $('#libraryList').append(b);
    }
    if (!rows().length) $('#libraryList').textContent = '저장된 자료 없음';
  }
  function scopeOptions(level, value) {
    const options = [['', '전체'], ...api.notes().filter(n => n.level === level).map(n => [n.id, n.title || '제목 없음'])];
    if (value && !options.some(([id]) => id === value)) options.push([value, `없거나 접근할 수 없는 범위 (${value})`]);
    return options;
  }
  function render() {
    boundContext = api.contextKey();
    dialog.querySelectorAll('[data-kind]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.kind === kind)));
    $('[data-action="capture"]').hidden = kind !== 'templates';
    renderList(); renderConflicts();
    const row = current(), detail = $('#libraryDetail');
    displayed = row ? structuredClone(row) : null;
    if (api.store.readonly()) { detail.textContent = '지원하지 않는 보관 형식입니다. 원본을 백업한 뒤 호환되는 버전에서 열어주세요.'; status(); return; }
    if (!row) { detail.textContent = '선택한 자료 없음'; status(); return; }
    if (row.readonly) { detail.innerHTML = `<h3>지원하지 않는 형식 · 읽기 전용</h3><pre>${esc(JSON.stringify(row, null, 2))}</pre>`; status(); return; }
    const p = row.payload;
    const shared = field('name', '이름', p.name);
    if (kind === 'templates') {
      detail.innerHTML = `<form id="libraryForm"><div class="library-fields">${shared}${field('title', '메모 제목', p.title_template || '')}${area('description', '설명', p.description || '')}${area('content', '본문', p.content_template)}${area('properties', '속성 (JSON)', JSON.stringify(p.properties || {}, null, 2))}</div><div class="library-actions">${button('save', row.builtin ? '사본 저장' : '저장')}${button('clone', '복제')}${row.builtin ? '' : button('delete', '삭제')}${button('preview', '미리보기')}${button('create-note', '새 메모 생성')}${button('insert', '현재 메모에 삽입')}</div></form><section id="libraryPreview" class="markdown-preview" aria-label="템플릿 미리보기"></section>`;
    } else {
      const f = p.filter || {}, scope = f.scope || {};
      const localDate = v => v ? new Date(Date.parse(v) - new Date(v).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '';
      detail.innerHTML = `<form id="libraryForm"><div class="library-fields">${shared}${field('order', '목록 순서', p.order || 0, 'number')}${field('text', '제목·본문 검색어', f.text || '')}${field('tagsAll', '모두 포함할 태그 (쉼표 구분)', (f.tags?.all || []).join(', '))}${field('tagsAny', '하나 이상 포함할 태그 (쉼표 구분)', (f.tags?.any || []).join(', '))}${select('topic', '주제', scope.topic_id || '', scopeOptions(1, scope.topic_id))}${select('category', '분류', scope.category_id || '', scopeOptions(2, scope.category_id))}${select('favorite', '즐겨찾기', typeof f.favorite === 'boolean' ? String(f.favorite) : '', [['', '전체'], ['true', '즐겨찾기만'], ['false', '즐겨찾기 제외']])}${field('from', '수정 시작 (현지 시간)', localDate(f.updated?.from), 'datetime-local')}${field('to', '수정 종료 (현지 시간)', localDate(f.updated?.to), 'datetime-local')}${select('sortField', '결과 정렬', p.sort?.field || 'updated_at', [['updated_at', '수정일'], ['title', '제목']])}${select('direction', '정렬 방향', p.sort?.direction || 'desc', [['asc', '오름차순'], ['desc', '내림차순']])}</div><div class="library-actions">${button('save', '저장')}${button('clone', '복제')}${button('delete', '삭제')}${button('preview', '결과 새로고침')}</div></form><section id="libraryPreview" aria-label="불러온 메모 결과"></section>`;
    }
    $('#libraryForm').onsubmit = e => e.preventDefault();
    $('#libraryForm').oninput = () => { dirty = true; };
    detail.querySelectorAll('[data-action]').forEach(b => { b.onclick = safe(() => action(b.dataset.action)); });
    preview(); status();
  }
  function payload() {
    const form = $('#libraryForm'), val = name => form.elements[name].value;
    if (kind === 'templates') return NowLibrary.validate(kind, { name: val('name'), title_template: val('title'), content_template: val('content'), description: val('description'), properties: JSON.parse(val('properties')), variables: ['date', 'time', 'title'] });
    const tags = name => val(name).split(',').map(s => s.trim()).filter(Boolean);
    return NowLibrary.validate(kind, { name: val('name'), order: Number(val('order')), filter: { text: val('text'), tags: { all: tags('tagsAll'), any: tags('tagsAny') }, scope: { topic_id: val('topic') || null, category_id: val('category') || null }, favorite: val('favorite') === '' ? null : val('favorite') === 'true', updated: { from: val('from') ? new Date(val('from')).toISOString() : null, to: val('to') ? new Date(val('to')).toISOString() : null } }, sort: { field: val('sortField'), direction: val('direction') } });
  }
  function preview() {
    const target = $('#libraryPreview'); if (!target) return;
    const p = payload();
    if (kind === 'templates') {
      const value = NowLibrary.applyTemplate(p, api.noteTitle());
      const inert = document.createElement('template');
      inert.innerHTML = `<h3>${esc(value.title)}</h3>${NowMarkdown.render(value.content)}`;
      // Preview links never open a file/network or hydrate remote attachments.
      inert.content.querySelectorAll('img').forEach(img => img.remove());
      inert.content.querySelectorAll('a').forEach(a => { a.removeAttribute('href'); });
      target.replaceChildren(inert.content);
    } else {
      const notes = api.notes(), results = NowLibrary.evaluate(p, notes, new Set(notes.map(n => n.id)));
      target.replaceChildren();
      const title = document.createElement('h3'); title.textContent = `불러온 메모 ${results.length}개`;
      target.append(title);
      if (!results.length) { const empty = document.createElement('p'); empty.textContent = '조건에 맞는 메모 없음'; target.append(empty); }
      for (const n of results) { const b = document.createElement('button'); b.type = 'button'; b.className = 'library-result'; b.textContent = n.path || n.title || '제목 없음'; b.onclick = safe(async () => { if (!await clean()) return; dialog.close(); api.selectNote(n.id); }); target.append(b); }
    }
  }
  async function sync() { if (busy) return; busy = true; status(); try { await api.store.sync(); } finally { busy = false; if (dialog.open) { status(); if (!dirty && current()) render(); } } }
  async function action(name) {
    if (boundContext !== api.contextKey()) { render(); throw new Error('사용자 또는 서버가 변경되어 선택을 초기화했습니다.'); }
    const row = displayed;
    if (name === 'preview') return preview();
    if (name === 'save' || name === 'clone') {
      selectedId = await api.store.put(kind, name === 'clone' || row.builtin ? null : row.id, payload(), { baseVersion: name === 'clone' || row.builtin ? 0 : row.version });
      dirty = false; render(); await sync();
    }
    if (name === 'delete' && await ask('이 자료를 삭제할까요?')) { await api.store.remove(kind, row.id, { baseVersion: row.version }); selectedId = null; dirty = false; render(); await sync(); }
    if (name === 'create-note' || name === 'insert') {
      const value = NowLibrary.applyTemplate(payload(), api.noteTitle());
      if (await api.apply(value, name === 'insert')) message('메모에 적용했습니다.');
    }
  }
  function renderConflicts() {
    const target = $('#libraryConflicts'); target.replaceChildren();
    const conflicts = api.store.status().conflicts || {};
    for (const [rk, conflict] of Object.entries(conflicts)) {
      const [resourceKind, id] = rk.split('/');
      const section = document.createElement('section'); section.className = 'library-conflict';
      const title = document.createElement('h3'); title.textContent = `충돌: ${conflict.code}`;
      const compare = document.createElement('div'); compare.className = 'library-compare';
      for (const [label, value] of [['내 변경', conflict.local], ['서버 현재본', conflict.remote]]) {
        const pane = document.createElement('div'), h = document.createElement('h4'), pre = document.createElement('pre'); h.textContent = label; pre.textContent = JSON.stringify(value, null, 2); pane.append(h, pre); compare.append(pane);
      }
      section.append(title, compare);
      for (const [choice, text] of [['local', conflict.remote?.deleted_at ? '내 변경을 새 사본으로 저장' : '내 변경으로 다시 저장'], ['remote', '서버 현재본 사용']]) {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'secondary-btn'; b.textContent = text;
        b.onclick = safe(async () => { if (!await clean()) return; await api.store.resolve(resourceKind, id, choice, { remoteVersion: conflict.remote?.version || 0 }); dirty = false; selectedId = null; render(); await sync(); }); section.append(b);
      }
      target.append(section);
    }
  }
  dialog.querySelectorAll(':scope > .library-toolbar [data-action], :scope > .library-header [data-action]').forEach(b => {
    b.onclick = safe(async () => {
      const name = b.dataset.action;
      if (name === 'close') { if (await clean()) dialog.close(); return; }
      if (name === 'sync') { await sync(); return; }
      if (!await clean()) return;
      kind = name === 'capture' ? 'templates' : kind;
      const p = name === 'capture' ? api.capture() : kind === 'templates' ? { name: '새 템플릿', content_template: '' } : { name: '새 저장조건', order: api.store.list(kind).length, filter: {}, sort: { field: 'updated_at', direction: 'desc' } };
      selectedId = await api.store.put(kind, null, p); dirty = false; render();
    });
  });
  dialog.querySelectorAll('[data-kind]').forEach(b => { b.onclick = safe(async () => { if (!await clean()) return; kind = b.dataset.kind; selectedId = null; dirty = false; render(); }); });
  dialog.addEventListener('cancel', e => { e.preventDefault(); safe(async () => { if (await clean()) dialog.close(); })(); });
  return { open: async () => { if (dialog.open) return; boundContext = api.contextKey(); selectedId = rows()[0]?.id || null; dirty = false; render(); dialog.showModal(); await sync(); }, refresh: () => { if (dialog.open) status(); }, close: () => { confirmation?.(false); dialog.close(); }, requestConfirmation: ask, sync };
};
