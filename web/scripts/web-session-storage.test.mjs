import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

async function fixture(){
  const box=vm.createContext({});vm.runInContext(await fs.readFile(new URL('../vendor/web-session-storage.js',import.meta.url),'utf8'),box);
  const createStore=()=>{const data=new Map();return {data,getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};};
  const persistent=createStore(),a=createStore(),b=createStore();let time=100;
  const make=session=>box.NowWebSessionStorage.create({session:()=>session,persistent:()=>persistent,now:()=>time});
  return {a,b,persistent,one:make(a),two:make(b),time:value=>{time=value;}};
}
test('workspace navigation reuses the existing per-tab session format without writing tokens to shared storage',async()=>{
  const f=await fixture();f.one.save({ownerId:'alice',token:'synthetic-token',deviceId:'web-client'});
  assert.equal(f.one.load().ownerId,'alice');assert.equal(f.one.invalidated(f.one.load()),false);
  assert.equal(f.two.load(),null);assert.equal(f.persistent.data.get('nownote.web.auth.active.v1'),'1');
  assert.ok([...f.persistent.data.values()].every(value=>!value.includes('synthetic-token')));
});
test('logout markers revoke older sessions across workspaces and a later login does not revive old per-tab tokens',async()=>{
  const f=await fixture();f.one.save({ownerId:'alice',token:'synthetic-token'});const old=f.one.load();
  f.time(200);f.two.markLoggedOut();assert.equal(f.one.invalidated(old),true);
  f.time(300);f.two.save({ownerId:'bob',token:'other-synthetic'});assert.equal(f.one.invalidated(old),true);assert.equal(f.two.invalidated(f.two.load()),false);
  f.one.clear();assert.equal(f.one.load(),null);assert.equal(f.two.load().ownerId,'bob');
});
test('shared session storage remains byte-compatible with the existing memo app session functions',async()=>{
  const f=await fixture(),source=await fs.readFile(new URL('../app.js',import.meta.url),'utf8');
  const box=vm.createContext({sessionStorage:f.a,localStorage:f.persistent,Date:{now:()=>100},
    WEB_SESSION_KEY:'nownote.web.session.v1',WEB_LOGOUT_KEY:'nownote.web.logout.v1',WEB_AUTH_ACTIVE_KEY:'nownote.web.auth.active.v1'});
  const start=source.indexOf('function loadWebSession()'),end=source.indexOf('function clearWebSession()',start);
  vm.runInContext(source.slice(start,end),box);box.saveWebSession({ownerId:'alice',token:'synthetic-token'});
  assert.equal(JSON.stringify(f.one.load()),JSON.stringify(box.loadWebSession()));assert.equal(f.one.invalidated(f.one.load()),box.isWebSessionInvalidated(box.loadWebSession()));
  f.time(200);f.two.markLoggedOut();assert.equal(f.one.invalidated(f.one.load()),true);assert.equal(box.isWebSessionInvalidated(box.loadWebSession()),true);
});
test('memo logout clears only NowNote caches, preserving unrelated site applications',async()=>{
  const source=await fs.readFile(new URL('../app.js',import.meta.url),'utf8'),deleted=[];
  const keys=['nownote-web-v18','nownote-shell:%2Fapp%2F:v2.4.1','nownote-shell:%2Fwiki%2F:v2.4.1','other-product','nownote-web-v-other'];
  const box=vm.createContext({isHostedWebClient:()=>true,markWebLoggedOut(){},clearWebSession(){},localStorage:{removeItem(){}},sessionStorage:{clear(){}},
    STORAGE_KEY:'data',SETTINGS_KEY:'settings',WEB_AUTH_ACTIVE_KEY:'active',window:{caches:{}},caches:{keys:async()=>keys,delete:async key=>deleted.push(key)}});
  const start=source.indexOf('async function clearHostedWebLogoutCache()'),end=source.indexOf('function applyWebSession(',start);
  vm.runInContext(source.slice(start,end),box);await box.clearHostedWebLogoutCache();assert.deepEqual(deleted,keys.slice(0,3));
});
