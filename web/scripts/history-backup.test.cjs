const {test}=require('node:test');
const assert=require('node:assert/strict');
const {webcrypto}=require('node:crypto');
globalThis.crypto=webcrypto;
require('../vendor/note-history-state.js');
const parts=require('../vendor/document-parts.js');
const file=require('node:path').resolve(__dirname,'../vendor/history-backup.js');
function fixture(){
  assert.ok(require('node:fs').existsSync(file),'document-wise backup implementation required');
  require(file);const account=JSON.stringify(['https://qa.invalid','alice']);
  const note=(id,owner='alice')=>({owner_id:owner,local_id:id,content:id,note_type:'tree',source:'manual'});
  const entry=(id,owner)=>({raw:note(id,owner),draft:note(id,owner),base:{crypto_epoch:0,inventory_revision_ids:[]},revisions:[{snapshot:{note:{...note(id,owner),content:'old '+id}}}],outbox:[],receipts:[],unknown:{value:id}});
  const other=JSON.stringify(['https://qa.invalid','bob']);
  const root={schema_version:1,contexts:{[account]:{notes:{a:entry('a'),b:entry('b')}},[other]:{notes:{'한글':entry('한글','bob')}}}},encoded=parts.encode(root),reads=[];let stamp='one',active=true,after=null;
  const read=async(path,directory)=>{reads.push({path:[...path],directory});const step=parts.selectSteps(path,directory);let item=step.next();while(!item.done)item=step.next(encoded.get(item.value));const result={...item.value,stamp,...(directory&&!path.length?{partIds:[...encoded.keys()]}:{})};after?.(path,directory);return result;};
  const exporter=NowHistoryBackup.create({directory:path=>read(path,true),read:path=>read(path,false)});
  return {root,account,other,reads,exporter,guard:{active:()=>active},orphan:()=>encoded.set('["orphan"]',{type:'object',entries:[]}),change:()=>{stamp='changed';},lock:()=>{active=false;},after:fn=>{after=fn;}};
}
test('whole backup reads one document at a time and preserves every account/history/unknown field',async()=>{
  const f=fixture(),blob=await f.exporter.read('one',f.guard);
  assert.deepEqual(JSON.parse(await blob.text()),f.root);
  assert.deepEqual(f.reads.filter(row=>!row.directory).map(row=>row.path),[['schema_version'],['contexts',f.account,'notes','a'],['contexts',f.account,'notes','b'],['contexts',f.other,'notes','한글']]);
});
test('changed journal and authentication discard the backup without retry or partial output',async()=>{
  for(const action of ['change','lock']){const f=fixture();f.after(path=>{if(path.at(-1)==='a')f[action]();});await assert.rejects(f.exporter.read('one',f.guard));}
});

test('unreferenced physical records never become a silently incomplete archive',async()=>{
  const f=fixture();f.orphan();await assert.rejects(f.exporter.read('one',f.guard));
});
test('unknown metadata requires the established full gate; broken document never exports',async()=>{
  const f=fixture();f.root.extension={preserved:true};
  const g=fixture();g.root.contexts[g.account].notes.b.revisions[0]={broken:true};
  // Re-encode mutations to keep the fixture's physical store authoritative.
  const store=root=>{const encoded=parts.encode(root);return async(path,shallow)=>{const iterator=parts.selectSteps(path,shallow);let step=iterator.next();while(!step.done)step=iterator.next(encoded.get(step.value));return {...step.value,stamp:'one'};};};
  const bad=store(f.root),broken=store(g.root);
  await assert.rejects(NowHistoryBackup.create({directory:p=>bad(p,true),read:p=>bad(p,false)}).read('one'),error=>error.code==='backup_full_required');
  await assert.rejects(NowHistoryBackup.create({directory:p=>broken(p,true),read:p=>broken(p,false)}).read('one'),error=>error.code!=='backup_full_required');
});
