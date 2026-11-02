import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
for(const file of ['../app.js','../../desktop/app/app.js']){
  const source=await fs.readFile(new URL(file,import.meta.url),'utf8');
  const start=source.indexOf('async function prepareVaultHistorySelection(');
  assert.ok(start>=0,'Vault renderer must prepare canonical history before invoking file apply');
  const box=vm.createContext({crypto:webcrypto,structuredClone,TextEncoder,TextDecoder,Uint8Array,atob,btoa});
  for(const name of ['note-protection-protocol','note-protection-state','note-history-state'])
    vm.runInContext(await fs.readFile(new URL('../vendor/'+name+'.js',import.meta.url),'utf8'),box);
  const ctx={url:'https://example.invalid',owner:'fixture',device:'device',auth:'synthetic',enabled:true};
  const note={owner_id:'fixture',local_id:'t',note_type:'tree',title:'Topic',content:'before',parent_local_id:null,level:1,tags:'',source:'web-tree',deleted_at:null};
  const history={schema_version:1,contexts:{[box.NowNoteHistory.key(ctx)]:{notes:{t:{raw:note,draft:note,base:{head_version:1,head_revision_id:'r',inventory_revision_ids:['r'],crypto_epoch:0,replica_count:1},revisions:[],outbox:[],receipts:[],dirty:false}}}}};
  box.state={data:{tree:[{id:'t',title:'Topic',content:'before',parentId:null,level:1,tags:[],children:[]}]},settings:{server:{mode:'server'}}};
  box.findTreeNode=(tree,id)=>tree.find(n=>n.id===id);
  box.tagsFromServerNote=n=>String(n.tags||'').split(',').filter(Boolean);
  vm.runInContext(source.slice(start,source.indexOf('\nasync function ',start+20)),box);
  const input={itemId:'t',action:'toNowNote'};
  const result=await box.prepareVaultHistorySelection(history,ctx,{local:{id:'t'},vault:{id:'t',title:'Topic',body:'from Vault',tags:[]},paths:{vault:'Topic/_index.md'}},input);
  assert.equal(result.historyPatch.next.draft.content,'from Vault');
  assert.equal(result.historyPatch.next.raw.content,'before');
  assert.equal(result.historyPatch.next.revisions.at(-1).reason,'external_import');
  assert.equal(JSON.stringify(result).includes(ctx.auth),false);
  assert.equal(input.historyPatch,undefined);
}
console.log('Vault Web/Desktop import adapter prepares history without changing the source selection PASS');
