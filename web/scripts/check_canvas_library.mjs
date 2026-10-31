import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
const box={crypto:webcrypto,TextEncoder,structuredClone};
vm.runInNewContext(await fs.readFile(new URL('../vendor/library-state.js',import.meta.url),'utf8'),box);
const L=box.NowLibrary, context={url:'https://synthetic.invalid',owner:'a',enabled:true,auth:'synthetic'};
const payload={title:'Map',cards:[{id:'a',type:'note',noteId:'note',text:'',x:0,y:2400,width:240,color:'blue'}],edges:[],zoom:0.6};
assert.equal(L.validate('canvases',payload).cards[0].x,0);
for(const change of [
  p=>p.cards[0].text='note cache',p=>p.cards[0].x=Infinity,p=>p.zoom=true,
  p=>p.cards.push(structuredClone(p.cards[0])),p=>p.edges.push({id:'e',from:'a',to:'missing',label:''})
]){const invalid=structuredClone(payload);change(invalid);assert.throws(()=>L.validate('canvases',invalid));}
let saved,current=context,rows=[],version=0,oldServer=false;
const request=async(ctx,kind,id,method,body)=>{
  if(oldServer&&kind==='canvases')throw Object.assign(Error('unsupported'),{status:404,code:'request_error'});
  if(method==='GET')return {items:kind==='canvases'?rows:[]};
  if(kind!=='canvases')return {resource:{id,owner_id:ctx.owner,version:1,schema_version:1,payload:body.payload}};
  if(body.base_version!==version)throw Object.assign(Error('conflict'),{status:409,code:'version_conflict'});
  const resource={id,owner_id:ctx.owner,version:++version,schema_version:1,payload:body.payload};
  rows=[resource];return {resource};
};
const make=()=>L.create({initial:saved,context:()=>current,request,write:async v=>{saved=structuredClone(v);}});
let store=make(),id=await store.put('canvases',null,payload);await store.sync();
assert.equal(store.list('canvases')[0].version,1);
store=make();assert.equal(store.list('canvases')[0].payload.cards[0].y,2400);
await store.put('canvases',id,{...payload,title:'local'},{baseVersion:1});
rows=[{...rows[0],version:++version,payload:{...payload,title:'remote'}}];await store.sync();
assert.equal(store.list('canvases')[0].conflict.code,'version_conflict');
assert.equal(store.list('canvases')[0].payload.title,'local');
await store.resolve('canvases',id,'remote');assert.equal(store.list('canvases')[0].payload.title,'remote');
current={...context,owner:'other'};assert.equal(store.list('canvases').length,0);current=context;
oldServer=true;await store.put('templates',null,{name:'Still works',content_template:'ordinary'});
await store.sync();
assert.equal(store.status().outbox.filter(o=>o.kind==='templates').length,0,'old server canvas absence must not block templates');
console.log('Canvas library: validation, durable restart, conflict, account isolation and old server compatibility PASS');
