import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
let passed=0;
for(const surface of ['web','desktop/app']){
  const source=await fs.readFile(new URL('../../'+surface+'/app.js',import.meta.url),'utf8');
  function extract(name){const m=new RegExp('^(?:async )?function '+name+'\\(','m').exec(source);assert(m,name);const rest=source.slice(m.index),end=/\n(?:async )?function [A-Za-z]/.exec(rest);return end?rest.slice(0,end.index):rest;}
  const original={mode:'server',url:'https://qa.invalid',ownerId:'alice',deviceId:'one',userToken:'qa-user-session',token:'qa-api-token',autoSync:false};
  let hosted=false,session=null,reply=async()=>({status:'ok',capabilities:{mixed_representation_schema:3,mixed_representation_read_v1:true,mixed_current_plain_v1:true,mixed_full_conversion_v1:true,mixed_note_write_v1:true,mixed_offline_import_v1:true,mixed_analysis_source_v1:true,full_protection_complete:true}});
  const elements={};
  for(const name of ['serverUrlInput','serverTokenInput','serverUserTokenInput','serverModeSelect','ownerIdInput','deviceIdInput','serverDisplayNameInput','serverEmailInput','serverTimezoneInput'])elements[name]={value:''};
  elements.serverAutoSyncToggle={checked:false};
  const box={state:{settings:{server:structuredClone(original)}},elements,navigator:{onLine:true},
    noteProtectionInternalEnabled:false,noteProtectionSupport:null,noteProtectionSupportGeneration:0,noteHistoryAuthenticated:true,
    requestServerJson:async()=>reply(),isHostedWebClient:()=>hosted,isWebAuthActive:()=>true,loadWebSession:()=>session,
    normalizeOwnerId:x=>String(x||'').trim(),normalizeServerUrl:x=>x.replace(/\/+$/,''),normalizeServerUserProfile:x=>x||{},
    defaultServerSettings:()=>structuredClone(original),defaultHostedServerUrl:()=>original.url,
    persistSettings(){},renderServerSettings(){},renderSettings(){},t:x=>x};
  vm.createContext(box);
  const names=['serverAuthHeaders','libraryContext','noteHistoryContext','noteProtectionSupportBinding','noteProtectionMutationsEnabled','refreshNoteProtectionSupport','saveServerSettingsFromForm','applyWebSession'];
  if(source.includes('function invalidateNoteProtectionSupport('))names.push('invalidateNoteProtectionSupport');
  vm.runInContext(names.map(extract).join('\n'),box);
  function save(value){
    const fields={serverUrlInput:'url',serverTokenInput:'token',serverUserTokenInput:'userToken',serverModeSelect:'mode',ownerIdInput:'ownerId',deviceIdInput:'deviceId'};
    for(const [field,key] of Object.entries(fields))elements[field].value=value[key]||'';
    box.saveServerSettingsFromForm();
  }
  for(const [field,value] of [['url','https://other.invalid'],['ownerId','bob'],['deviceId','two'],['userToken','qa-new-session'],['token','qa-new-api-token'],['mode','local']]){
    save(original);assert.equal(await box.refreshNoteProtectionSupport(),true);
    save({...original,[field]:value});save(original);
    assert.equal(box.noteProtectionMutationsEnabled(),false,field+': A-B-A must discard old proof without an intervening predicate');passed++;
    let release;const actual=reply;reply=()=>new Promise(resolve=>{release=resolve;});
    const pending=box.refreshNoteProtectionSupport();save({...original,[field]:value});save(original);
    release(await actual());assert.equal(await pending,false,field+': A-B-A must reject the old in-flight response');reply=actual;passed++;
  }
  assert.equal(await box.refreshNoteProtectionSupport(),true);
  elements.serverEmailInput.value='synthetic@example.invalid';box.saveServerSettingsFromForm();
  assert.equal(box.noteProtectionMutationsEnabled(),true,'Unchanged connection profile edits retain the current proof');passed++;
  hosted=true;session={ownerId:'alice',token:'qa-web-a',deviceId:'web-client'};box.applyWebSession(session);
  assert.equal(await box.refreshNoteProtectionSupport(),true);
  const a={...session};session={ownerId:'bob',token:'qa-web-b',deviceId:'web-client'};box.applyWebSession(session);
  session=a;box.applyWebSession(session);assert.equal(box.noteProtectionMutationsEnabled(),false,'Web session A-B-A must discard old proof');passed++;
}
console.log('Actual settings/session A-B-A support invalidation: '+passed+' PASS; no live service');
