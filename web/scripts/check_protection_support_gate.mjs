import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

let passed=0;
for(const surface of ['web','desktop/app']){
  const source=await fs.readFile(new URL('../../'+surface+'/app.js',import.meta.url),'utf8');
  function extract(name){
    const match=new RegExp('^(?:async )?function '+name+'\\(','m').exec(source);assert(match,name);
    const rest=source.slice(match.index),next=/\n(?:async )?function [A-Za-z]/.exec(rest);
    return next?rest.slice(0,next.index):rest;
  }
  const names=['noteProtectionSupportBinding','noteProtectionMutationsEnabled','refreshNoteProtectionSupport'];
  const caps={mixed_representation_schema:3,mixed_representation_read_v1:true,mixed_current_plain_v1:true,
    mixed_full_conversion_v1:true,mixed_note_write_v1:true,mixed_offline_import_v1:true,mixed_analysis_source_v1:true,full_protection_complete:true};
  let ctx={url:'https://qa.invalid',owner:'alice',device:'one',auth:'qa-session',enabled:true,online:true};
  let reply=async()=>({status:'ok',capabilities:{...caps}}),calls=0;
  const box={noteProtectionInternalEnabled:false,noteProtectionSupport:null,noteProtectionSupportGeneration:0,
    state:{settings:{server:{url:ctx.url,capabilities:{...caps}}}},noteHistoryContext:()=>({...ctx}),
    requestServerJson:async(server,path,options)=>{calls++;assert.equal(server.url,ctx.url);assert.equal(path,'/api/v1/server');assert.equal(options.cache,'no-store');return reply();}};
  vm.createContext(box);vm.runInContext(names.map(extract).join('\n'),box);
  const enabled=()=>box.noteProtectionMutationsEnabled(),refresh=()=>box.refreshNoteProtectionSupport();
  assert.equal(enabled(),false,'Persisted capability cannot enable writes');passed++;
  assert.equal(await refresh(),true);assert.equal(enabled(),true);assert.equal(calls,1);passed++;
  for(const [key,value] of [['auth','new-session'],['owner','bob'],['device','two'],['url','https://other.invalid']]){
    const original={...ctx};ctx={...ctx,[key]:value};assert.equal(enabled(),false);
    ctx=original;assert.equal(enabled(),false,'Returning to an old context requires a fresh check');
    assert.equal(await refresh(),true);
  }passed++;
  reply=async()=>{throw Error('qa_network_failure');};assert.equal(await refresh(),false);assert.equal(enabled(),false);passed++;
  for(const key of Object.keys(caps)){
    reply=async()=>({status:'ok',capabilities:{...caps,[key]:key==='mixed_representation_schema'?2:'true'}});
    assert.equal(await refresh(),false,key);assert.equal(enabled(),false,key);
  }passed++;
  let release;reply=()=>new Promise(resolve=>{release=resolve;});
  const pending=refresh();ctx={...ctx,auth:'changed-during-read'};release({status:'ok',capabilities:{...caps}});
  assert.equal(await pending,false);assert.equal(enabled(),false);ctx={...ctx,auth:'qa-session'};passed++;
  let old;reply=()=>new Promise(resolve=>{old=resolve;});const stale=refresh();
  reply=async()=>({status:'ok',capabilities:{...caps,full_protection_complete:false}});assert.equal(await refresh(),false);
  old({status:'ok',capabilities:{...caps}});assert.equal(await stale,false);assert.equal(enabled(),false);passed++;
  ctx={...ctx,enabled:false};const before=calls;assert.equal(await refresh(),false);assert.equal(calls,before);passed++;
  box.noteProtectionInternalEnabled=true;assert.equal(enabled(),true);passed++;
}
console.log('Actual Web/Desktop support gates: '+passed+' PASS; no live server or Provider');
