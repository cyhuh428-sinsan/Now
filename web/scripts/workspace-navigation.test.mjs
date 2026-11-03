import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
async function fixture(){const box=vm.createContext({URL,structuredClone});vm.runInContext(await fs.readFile(new URL('../vendor/workspace-navigation.js',import.meta.url),'utf8'),box);return box.NowWorkspaceNavigation;}
test('workspace navigation carries only bounded account-bound actions, not credentials or arbitrary routes',async()=>{
  const N=await fixture(),ctx={owner:'alice',url:'https://qa.invalid'},value={schema_version:1,action:'source',local_id:'note-one',owner:ctx.owner,url:ctx.url,created_at:1000};
  assert.equal(N.validate(value,ctx,1100).local_id,'note-one');
  for(const bad of [{...value,owner:'bob'},{...value,url:'https://other.invalid'},{...value,token:'synthetic-only'},{...value,action:'delete'},{...value,local_id:'a\npath'},{...value,url:'https://user:password@qa.invalid'},{...value,created_at:0}])assert.throws(()=>N.validate(bad,ctx,400000));
  assert.throws(()=>N.validate(value,ctx,400001));assert.throws(()=>N.validate({...value,action:'wiki-protection'},ctx,1100));
  assert.equal(N.validate({...value,action:'settings',local_id:null},ctx,1100).action,'settings');
});
