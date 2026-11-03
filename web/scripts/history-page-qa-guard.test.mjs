import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
test('page QA forbids unselected document bodies without treating journal receipt keys as document paths',()=>{
 const source=fs.readFileSync(new URL('./wiki_sources_ui_host.cjs',import.meta.url),'utf8'),label=source.indexOf("throw Error('selected_sibling_history_read')"),start=source.lastIndexOf('IDBObjectStore.prototype.get=function',label),end=source.indexOf('return get.call(this,key);};',label)+'return get.call(this,key);};'.length;
 assert.ok(start>0&&end>start);const box={IDBObjectStore:{prototype:{}},get:key=>key,pageFloor:75};vm.createContext(box);vm.runInContext(source.slice(start,end),box);const get=box.IDBObjectStore.prototype.get;
 for(const key of ['retained-header-v1','retained-original-v1'])assert.deepEqual(get.call({name:'journals'},['nownote.history.v1',key]),['nownote.history.v1',key]);
 assert.throws(()=>get.call({name:'documents'},['nownote.history.v1',JSON.stringify(['contexts','account','notes','qa-save-a','revisions',1])]),/unselected_revision/);
 assert.throws(()=>get.call({name:'documents'},['nownote.history.v1',JSON.stringify(['contexts','account','notes','qa-save-b','revisions',80])]),/selected_sibling/);
 const allowed=['nownote.history.v1',JSON.stringify(['contexts','account','notes','qa-save-a','revisions',80])];assert.deepEqual(get.call({name:'documents'},allowed),allowed);
});
