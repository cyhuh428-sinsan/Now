import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
const failures=[];
for(const file of ['../app.js','../../desktop/app/app.js']){
  const source=await fs.readFile(new URL(file,import.meta.url),'utf8');
  for(const action of ['sync','resolve']){
    let release;
    const deferred=new Promise(resolve=>release=resolve);
    const row=id=>({id,version:1,payload:{title:id,cards:[],edges:[],zoom:1},...(action==='resolve'?{conflict:{remote:{version:1}}}:{})});
    const box=vm.createContext({crypto:webcrypto,structuredClone,state:{data:{canvases:[]},selectedCanvasCardIds:[]},
      normalizeText:v=>String(v??''),isPlainObject:v=>v&&typeof v==='object',
      libraryContext:()=>({url:'synthetic',owner:'a',auth:'synthetic',enabled:true}),
      NowLibrary:{key:ctx=>ctx.url+'/'+ctx.owner},elements:{},
      libraryStore:{list:()=>[row('a'),row('b')],sync:()=>action==='sync'?deferred:Promise.resolve(),
        resolve:()=>deferred}});
    vm.runInContext(source.slice(source.indexOf('let canvasResourceEditor = null;'),source.indexOf('function defaultCaptureCard() {')),box);
    vm.runInContext('renderCanvas=()=>{};renderCanvasResourceControls=()=>{};',box);
    box.editCanvasResource(row('a'));
    const pending=action==='sync'?box.syncCanvasResources():box.resolveCanvasResource('remote');
    box.editCanvasResource(row('b'));
    vm.runInContext('canvasResourceEditor.dirty=true;canvasResourceEditor.canvas.title="new unsaved b";',box);
    release();await pending;
    const editor=vm.runInContext('canvasResourceEditor',box);
    if(editor.id!=='b'||editor.canvas.title!=='new unsaved b'||!editor.dirty)failures.push(file+': late '+action+' replaced newer editor');
  }
}
assert.deepEqual(failures,[]);
console.log('Canvas stale sync/resolve responses preserve newer editor PASS');
