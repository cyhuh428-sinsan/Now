import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';

const file = new URL('../vendor/wiki-runtime-loader.js', import.meta.url);
function fixture(base = 'https://example.test/app/', script = 'https://example.test/app/app.js') {
  assert.ok(existsSync(file), '명시적 Wiki loader가 필요합니다');
  const scripts = [];
  const document = { baseURI: base, currentScript: { src: script },
    createElement(tag) { assert.equal(tag, 'script'); return { remove() { this.removed = true; } }; },
    head: { appendChild(node) { scripts.push(node); } } };
  const context = vm.createContext({ document, URL, location: { href: base } });
  vm.runInContext(readFileSync(file, 'utf8'), context);
  return { context, scripts, ensure: context.ensureNowWikiRuntime };
}
function ready(context) {
  context.cytoscape = () => {};
  context.mountWikiGraph = () => {};
  context.mountNowWiki = () => {};
}
test('명시 호출 전 로딩0, 동시·완료 호출의 Promise와 script는 하나', async () => {
  const { context, scripts, ensure } = fixture();
  assert.equal(scripts.length, 0);
  const first = ensure();
  assert.equal(ensure(), first);
  assert.equal(scripts.length, 1);
  assert.equal(scripts[0].src, 'https://example.test/app/wiki-runtime.js');
  ready(context); scripts[0].onload();
  await first;
  assert.equal(ensure(), first);
  assert.equal(scripts.length, 1);
});
test('실패는 거절하고 자동 재시도0, 다음 명시 호출만 재시도', async () => {
  const { context, scripts, ensure } = fixture();
  const first = ensure(); scripts[0].onerror();
  await assert.rejects(first, /wiki_runtime_load_failed/);
  assert.equal(scripts.length, 1);
  assert.equal(scripts[0].removed, true);
  const retry = ensure(); assert.notEqual(retry, first);
  assert.equal(ensure(), retry);
  ready(context); scripts[1].onload(); await retry;
  assert.equal(scripts.length, 2);
});
test('onload만으로 성공하지 않고 세 export를 확인', async () => {
  const { scripts, ensure } = fixture();
  const pending = ensure(); scripts[0].onload();
  await assert.rejects(pending, /wiki_runtime_incomplete/);
  assert.equal(scripts.length, 1);
});
test('문서 base 변경에도 main script 옆 자산만 로드', async () => {
  for (const [base, script, expected] of [
    ['https://example.test/wiki/', 'https://example.test/app.js', 'https://example.test/wiki-runtime.js'],
    ['file:///synthetic/index.html', 'file:///synthetic/app.js', 'file:///synthetic/wiki-runtime.js'],
  ]) {
    const { context, scripts, ensure } = fixture(base, script);
    context.document.baseURI = 'https://untrusted.test/';
    const pending = ensure(); assert.equal(scripts[0].src, expected);
    ready(context); scripts[0].onload(); await pending;
  }
});
test('다른 origin의 main script를 기준으로 외부 chunk를 로드하지 않음', async () => {
  const { scripts, ensure } = fixture('https://example.test/app/', 'https://untrusted.test/app.js');
  await assert.rejects(ensure(), /wiki_runtime_origin/);
  assert.equal(scripts.length, 0);
});

test('lazy view는 명시 진입 후에만 mount하고 close된 늦은 요청을 무시',async()=>{
  const {context,scripts}=fixture();let mounts=0,opens=0;
  assert.equal(typeof context.createLazyWikiView,'function');
  const view=context.createLazyWikiView({contextKey:()=> 'alice',mount:()=>{mounts++;return {open:async()=>{opens++;},check(){},close(){}};}});
  assert.equal(mounts,0);const opening=view.open('sources');
  assert.equal(scripts.length,1);view.close();ready(context);scripts[0].onload();await opening;
  assert.equal(mounts,0);assert.equal(opens,0);
  await view.open('build');assert.equal(mounts,1);assert.equal(opens,1);
});

test('loading 중 계정 변경 시 과거 보호 평문을 화면에 넘기지 않음',async()=>{
  const {context,scripts}=fixture();let account='alice',mounts=0,opens=0;
  const view=context.createLazyWikiView({contextKey:()=>account,mount:()=>{mounts++;return {openProtected(){opens++;},check(){},close(){}};}});
  const opening=view.openProtected({synthetic:'private'},null);account='bob';view.check();
  ready(context);scripts[0].onload();await opening;
  assert.equal(mounts,0);assert.equal(opens,0);
});

test('prepare receives the requested Wiki mode before opening the selected workspace',async()=>{
  const {context,scripts}=fixture();const calls=[];
  const view=context.createLazyWikiView({contextKey:()=> 'alice',prepare:(method,args)=>calls.push([method,...args]),mount:()=>({open(){calls.push(['mounted']);}})});
  const pending=view.open('browse');ready(context);scripts[0].onload();await pending;
  assert.deepEqual(calls,[['open','browse'],['mounted']]);
});
