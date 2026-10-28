import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { launchApp, evaluate, stopProcess, CdpClient, freePort } from './check-desktop-storage.mjs';
const root='D:/tmp/now-240-stage-d';
const dir=await fs.mkdtemp(root+'/single-instance-'), a=path.join(dir,'owner-a'), b=path.join(dir,'owner-b');
const exe=fileURLToPath(new URL('../dist/win-unpacked/NowNote.exe',import.meta.url));
let owner,other,restarted,main,paused=false;
const children=[];
async function until(fn,label,timeout=10000){const end=Date.now()+timeout;while(Date.now()<end){if(await fn())return;await delay(50);}throw Error(label);}
async function exit(child,timeout=10000){await until(()=>child.exitCode!==null||child.signalCode!==null,'process exit',timeout);return child.exitCode;}
function second(profile,args=[]){const child=spawn(exe,args,{env:{...process.env,NOWNOTE_DESKTOP_USER_DATA_DIR:profile},stdio:'ignore'});children.push(child);return child;}
async function connectMain(port){let target;await until(async()=>{try{target=(await(await fetch(`http://127.0.0.1:${port}/json/list`)).json())[0];return Boolean(target?.webSocketDebuggerUrl);}catch{return false;}},'main inspector');const client=await CdpClient.connect(target.webSocketDebuggerUrl);return client;}
const mainEval=code=>evaluate({send:(method,params)=>main.send(method,params)},`(()=>{const electron=process.getBuiltinModule('module').createRequire(process.execPath)('electron');return ${code};})()`);
try {
  const port=await freePort();
  owner=await launchApp(a,[`--inspect=127.0.0.1:${port}`]);main=await connectMain(port);
  await until(()=>evaluate(owner.page,'Boolean(libraryStore)'),'library ready');
  const noteId=await evaluate(owner.page,`libraryStore.put('templates',null,{name:'single owner pending',content_template:'must survive handoff and restart'})`);
  await evaluate(owner.page,`window.__singleOwnerMarker='no-reload'`);
  const firstUrl=await evaluate(owner.page,'location.href');
  const duplicate=second(a,['D:/tmp/argument-only-not-opened.md']);
  assert.equal(await exit(duplicate),0);
  assert.equal(await evaluate(owner.page,'window.__singleOwnerMarker'),'no-reload');
  assert.equal(await evaluate(owner.page,'location.href'),firstUrl);
  await mainEval(`(()=>{const w=electron.BrowserWindow.getAllWindows()[0];w.__qaActivation=[];for(const name of ['restore','show','focus']){const original=w[name].bind(w);w[name]=(...args)=>{w.__qaActivation.push(name);return original(...args);};}w.minimize();})()`);
  assert.equal(await mainEval(`electron.BrowserWindow.getAllWindows()[0].isMinimized()`),true);
  assert.equal(await exit(second(a)),0);
  try { await until(()=>mainEval(`(()=>{const w=electron.BrowserWindow.getAllWindows()[0];return !w.isMinimized()&&w.isVisible()&&w.isFocused();})()`),'restore/show/focus minimized'); }
  catch(error) { console.log('Activation evidence',await mainEval(`(()=>{const w=electron.BrowserWindow.getAllWindows()[0];return {minimized:w.isMinimized(),visible:w.isVisible(),focused:w.isFocused(),focusable:w.isFocusable(),calls:w.__qaActivation};})()`));throw error; }
  await mainEval(`electron.BrowserWindow.getAllWindows()[0].hide()`);
  assert.equal(await exit(second(a)),0);
  await until(()=>mainEval(`electron.BrowserWindow.getAllWindows()[0].isVisible()`),'show hidden');
  const alias=path.join(dir,'owner-a-alias');await fs.symlink(a,alias,'junction');
  assert.equal(await exit(second(alias)),0);
  other=await launchApp(b);await until(()=>evaluate(other.page,'Boolean(libraryStore)'),'independent profile');
  const otherId=await evaluate(other.page,`libraryStore.put('templates',null,{name:'independent profile',content_template:'separate outbox'})`);
  assert.notEqual(other.app.pid,owner.app.pid);
  assert.equal(await evaluate(owner.page,`libraryStore.list('templates')[0].id`),noteId);
  assert.equal(await evaluate(other.page,`libraryStore.list('templates')[0].id`),otherId);
  // No time-based takeover: the paused owner still owns its OS singleton after 30 seconds.
  await main.send('Debugger.enable');await main.send('Debugger.pause');paused=true;
  await delay(31050);
  const whilePaused=second(a);
  await delay(1000);
  const durable=JSON.parse(await fs.readFile(path.join(a,'nownote-desktop-store.json'),'utf8'));
  assert.equal(Object.values(durable.values['nownote.library.v1'].contexts).flatMap(c=>c.outbox)[0].id,noteId);
  await main.send('Debugger.resume');paused=false;
  assert.equal(await exit(whilePaused),0);
  assert.equal(await mainEval(`electron.BrowserWindow.getAllWindows().length`),1);
  assert.equal(await evaluate(owner.page,'window.__singleOwnerMarker'),'no-reload');
  await mainEval(`electron.app.quit()`).catch(()=>{});
  main.close();main=null;
  assert.equal(await exit(owner.app),0);
  owner.client.close();owner=null;
  restarted=await launchApp(a);await until(()=>evaluate(restarted.page,'Boolean(libraryStore)'),'normal restart');
  assert.equal(await evaluate(restarted.page,`libraryStore.list('templates')[0].id`),noteId);
  stopProcess(restarted.app);restarted.client.close();restarted=null;await delay(300);
  restarted=await launchApp(a);await until(()=>evaluate(restarted.page,'Boolean(libraryStore)'),'restart after crash');
  assert.equal(await evaluate(restarted.page,`libraryStore.list('templates')[0].id`),noteId);
  const result={secondaryExitZero:true,firstRendererUnchanged:true,documentArgumentsUnchanged:true,minimizedRestoredFocused:true,hiddenShown:true,physicalAliasSameOwner:true,differentProfilesIndependent:true,pausedOwner31SecondsNoTakeover:true,pendingSurvivesNormalAndForcedRestart:true};
  await fs.writeFile(root+'/single-instance.json',JSON.stringify(result,null,2));
  console.log('NowNote single-instance actual Electron:',result);
} finally {
  if(paused)await main?.send('Debugger.resume').catch(()=>{});
  main?.close();
  for(const app of [owner,other,restarted]){app?.client?.close();stopProcess(app?.app);}
  for(const child of children)if(child.exitCode===null)stopProcess(child);
  await delay(500);await fs.rm(dir,{recursive:true,force:true});
}
