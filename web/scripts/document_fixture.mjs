export const documentFixture = [
  '# 한글 제목', '', '**강조** 와 *기울임*, ~~취소선~~', '',
  '- 첫 항목', '  - 중첩 항목', '', '- [ ] 작업', '',
  '| 이름 | 값 |', '| --- | --- |', '| 한글 | 2 |', '',
  '<details><summary>바깥 접기</summary>', '', '## 같은 제목', '',
  '<details><summary>안쪽 접기</summary>', '', '### 안쪽 제목', '본문 내용', '</details>', '</details>', '',
  '> <details><summary>인용 접기</summary>', '>', '> ## 인용 제목', '>', '> 내용 **강조**', '> </details>', '',
  '## 같은 제목', '', 'https://example.com/한글_(문서).', '',
  '[사이트](https://example.com/path?q=1)', '[파일](file:///D:/tmp/now-240-stage-b/sample.txt)', '[[QA 연결]]', '',
  '```html', '# 코드 안 제목', '<details><summary>코드</summary></details>', '<script>window.__documentAttack=1</script>', '```', '',
  '<script>window.__documentAttack=2</script>', '<img src=x onerror="window.__documentAttack=3">',
  '[위험](javascript:alert(1))', '<a href="data:text/html,test" onclick="window.__documentAttack=4">위험 링크</a>',
].join('\n');

export async function verifyDocumentFlow(driver) {
  const { evaluate, click, fill } = driver;
  await evaluate(`(() => { state.data.tree = [createNode('Stage B QA', '', null, 1), createNode('QA 연결', '연결 본문', null, 1)]; state.selectedTreeId=state.data.tree[0].id; setView('tree'); })()`);
  await fill('#treeContent', documentFixture);
  await evaluate('elements.treeContent.setSelectionRange(5,10);elements.treeContent.scrollTop=0');
  await click('#documentFormattedBtn');
  const info = await evaluate(`(() => { const p=elements.markdownPreview;return {
    headings:[...p.querySelectorAll('h1,h2,h3,h4,h5,h6')].map(h=>({text:h.textContent,id:h.id})),
    details:p.querySelectorAll('details:not(.document-section)').length,
    nested:!!p.querySelector('details details'), quote:!!p.querySelector('blockquote details'),
    table:!!p.querySelector('table'), nestedList:!!p.querySelector('ul ul'),
    strong:!!p.querySelector('strong'), code:p.querySelector('pre code')?.textContent,
    dangerous:!!p.querySelector('script,iframe,object,[onclick],[onerror],a[href^="javascript:"],a[href^="data:"]'),
    attacked:window.__documentAttack||0,local:!!p.querySelector('[data-local-path]'),wiki:!!p.querySelector('[data-wiki-link]'),
    source:getSelectedTreeNode().content,selection:[elements.treeContent.selectionStart,elements.treeContent.selectionEnd]
  };})()`);
  const assert=(ok,message)=>{if(!ok)throw new Error(message+': '+JSON.stringify(info));};
  assert(info.source===documentFixture,'원문 변경');
  assert(info.details===3&&info.nested&&info.quote&&info.table&&info.nestedList&&info.strong,'중첩 서식 누락');
  assert(!info.dangerous&&!info.attacked,'위험 HTML 실행');
  assert(info.local&&info.wiki&&info.code.includes('# 코드 안 제목')&&info.code.includes('<script>'),'링크·코드 원문 누락');
  assert(info.headings.length===5&&new Set(info.headings.map(h=>h.id)).size===5,'목차·고유 ID 오류');
  await evaluate("elements.outlinePanel.classList.remove('hidden');renderOutlinePanel({...getSelectedTreeNode(),content:getSelectedTreeNode().content});elements.markdownPreview.querySelectorAll('details').forEach(d=>d.open=false)");
  await click('#outlinePanel .outline-item:nth-child(3)');
  assert(await evaluate("[...elements.markdownPreview.querySelector('#note-heading-2').closest('details').parentElement.closest('details').querySelectorAll('details')].some(d=>d.open)"),'접힌 제목 이동 오류');
  await click('#documentSourceBtn');
  assert(await evaluate('elements.treeContent.value===getSelectedTreeNode().content'),'모드 왕복 원문 변경');
  assert(await evaluate('elements.treeContent.selectionStart===5&&elements.treeContent.selectionEnd===10'),'선택 복원 오류');
  await evaluate('undoTreeEditor()');
  assert(await evaluate('elements.treeContent.value===""'),'Undo 회귀');
  await evaluate('redoTreeEditor()');
  assert(await evaluate('elements.treeContent.value===getSelectedTreeNode().content'),'Redo 회귀');
  await evaluate("elements.treeContent.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));setDocumentMode(true)");
  assert(await evaluate("elements.markdownPreview.classList.contains('hidden')"),'IME 조합 중 보기 전환');
  await evaluate("elements.treeContent.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true}))");
  await click('#documentFormattedBtn');
  await click('#markdownPreview .task-list-item input');
  assert(await evaluate('getSelectedTreeNode().content.includes("- [x] 작업")'),'체크리스트 회귀');
  await click('#markdownPreview .task-list-item input');
  await click('#documentSourceBtn');
  await evaluate('persist();persistSettings()');
  assert(await evaluate('elements.treeContent.value===getSelectedTreeNode().content'),'저장 원문 변경');
  await evaluate('openPrintPreview()');
  assert(await evaluate("elements.printPreviewBody.querySelector('table')&&!elements.printPreviewBody.querySelector('script,[onclick],[onerror]')"),'인쇄 미리보기 회귀');
  await evaluate('closePrintPreview()');
  return info;
}
