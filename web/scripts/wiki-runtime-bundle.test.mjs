import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import * as bundler from './bundle_markdown.mjs';

test('설치형 원장 세션과 공통 저장 정책이 패키지에 포함되고 renderer 정책과 일치',async()=>{
  const metadata=JSON.parse(await readFile(new URL('../../desktop/package.json',import.meta.url),'utf8'));
  assert.ok(metadata.build.files.includes('history-session.cjs'));assert.ok(metadata.build.files.includes('app/**/*'));
  const web=(await readFile(new URL('../vendor/journal-writes.js',import.meta.url),'utf8')).replace(/\r\n/g,'\n');
  const desktop=(await readFile(new URL('../../desktop/app/journal-writes.js',import.meta.url),'utf8')).replace(/\r\n/g,'\n');
  assert.equal(web,desktop);
});

test('서버 이미지는 기존 Web shell 복사와 독립 Wiki chunk 복사를 모두 유지',async()=>{
  const docker=await readFile(new URL('../../server/Dockerfile',import.meta.url),'utf8');
  assert.ok(docker.includes('COPY web/index.html web/app.js web/styles.css web/help.html web/manifest.webmanifest web/sw.js /web_app/'));
  assert.ok(docker.includes('COPY web/wiki-runtime.js /web_app/'));
});

test('UI 세 파일만 별도 chunk, 코어·loader는 main, 라이선스 보존', async () => {
  assert.equal(typeof bundler.buildRuntimeBundles, 'function');
  const { main, wiki } = await bundler.buildRuntimeBundles();
  for (const name of ['cytoscape.min.js', 'wiki-graph-ui.js', 'wiki-ui.js']) {
    const source = (await readFile(new URL('../vendor/' + name, import.meta.url), 'utf8')).replace(/\r\n/g, '\n');
    assert.ok(wiki.includes(source), name);
    assert.ok(!main.includes(source), name + ' main 제외');
  }
  for (const name of ['wiki-state.js', 'wiki-evidence.js', 'wiki-protection-group.js', 'wiki-graph.js', 'wiki-runtime-loader.js']) {
    const source = (await readFile(new URL('../vendor/' + name, import.meta.url), 'utf8')).replace(/\r\n/g, '\n');
    assert.ok(main.includes(source), name);
    assert.ok(!wiki.includes(source), name + ' chunk 제외');
  }
  const license = (await readFile(new URL('../vendor/cytoscape.LICENSE', import.meta.url), 'utf8')).replace(/\r\n/g, '\n');
  assert.ok(wiki.includes(license));
  const context = vm.createContext({});
  vm.runInContext(wiki, context);
  for (const name of ['cytoscape', 'mountWikiGraph', 'mountNowWiki']) assert.equal(typeof context[name], 'function');
});
test('--check 검증은 양쪽 main/chunk의 누락·오래된 내용 거부, CRLF 허용', async () => {
  assert.equal(typeof bundler.checkRuntimeBundles, 'function');
  const bundles = await bundler.buildRuntimeBundles();
  const files = new Map([
    ['web/app.js', bundles.main + 'application();'],
    ['desktop/app/app.js', bundles.main + 'desktop();'],
    ['web/wiki-runtime.js', bundles.wiki],
    ['desktop/app/wiki-runtime.js', bundles.wiki],
    ['web/wiki-core.js',bundles.core],
    ['desktop/app/wiki-core.js',bundles.core],
    ...Object.entries(bundles.assets),
  ]);
  const reader = async name => { if (!files.has(name)) throw Error('missing'); return files.get(name); };
  await bundler.checkRuntimeBundles(bundles, reader);
  for (const [name, source] of [...files]) {
    files.set(name, 'stale');
    await assert.rejects(bundler.checkRuntimeBundles(bundles, reader), { message: new RegExp(name.replaceAll('.', '\\.')) });
    files.delete(name);
    await assert.rejects(bundler.checkRuntimeBundles(bundles, reader), { message: new RegExp(name.replaceAll('.', '\\.')) });
    files.set(name, source.replaceAll('\n', '\r\n'));
    await bundler.checkRuntimeBundles(bundles, reader);
  }
});

test('생성된 양쪽 Wiki chunk는 공식 builder 출력과 동일', async () => {
  const { wiki } = await bundler.buildRuntimeBundles();
  for (const relative of ['../wiki-runtime.js', '../../desktop/app/wiki-runtime.js']) {
    const source = await readFile(new URL(relative, import.meta.url), 'utf8');
    assert.equal(source.replace(/\r\n/g, '\n'), wiki);
  }
});
test('독립 Wiki core는 메모 앱 bootstrap 없이 기존 저장·검증·Wiki host를 제공한다',async()=>{
  const {core}=await bundler.buildRuntimeBundles();assert.equal(typeof core,'string');
  assert.ok(!core.includes('async function initializeApp()'));
  const document={currentScript:{src:'https://qa.invalid/wiki-core.js'},createElement(){throw Error('unexpected eager DOM creation');},head:{appendChild(){throw Error('unexpected eager script load');}}};
  const box=vm.createContext({TextEncoder,TextDecoder,Uint8Array,structuredClone,crypto:webcrypto,atob,btoa,URL,location:{href:'https://qa.invalid/wiki/'},document});
  vm.runInContext('globalThis.window=globalThis;',box);vm.runInContext(core,box);
  for(const name of ['NowHistoryClient','NowWikiWorkspace','NowWikiReadSet','NowWikiSelectedPage'])assert.equal(typeof box[name]?.create==='function'||typeof box[name]?.open==='function',true,name);
  for(const relative of ['../wiki-core.js','../../desktop/app/wiki-core.js'])assert.equal((await readFile(new URL(relative,import.meta.url),'utf8')).replace(/\r\n/g,'\n'),core);
});
