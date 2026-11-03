const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const file=path.resolve(__dirname,'../vendor/wiki-index-reader.js');
function fixture(){
  assert.ok(fs.existsSync(file),'explicit readonly Wiki index reader required');require(file);
  let active=true,stamp='one',ops=[],malformed=false;const reads=[];
  globalThis.NowWikiLifecycle={validateMap:value=>{if(malformed)throw Error('bad lifecycle');return value;}};
  const account=JSON.stringify(['https://qa.invalid','alice']);
  const options={stamp:'one',account,metadata:['wiki_lifecycle','wiki_ingest_operations'],guard:{active:()=>active},
    directory:async p=>{reads.push({p,kind:'directory'});return {projection:'path_v1',stamp,found:true,part:{type:'object',entries:p.at(-1)==='wiki_ingest_operations'?ops:[]}};},
    read:async p=>{reads.push({p,kind:'value'});return {projection:'path_v1',stamp,found:true,value:{}};}};
  return {run:()=>NowWikiIndex.read(options),reads,change:()=>{stamp='changed';},lock:()=>{active=false;},pending:()=>{ops=[['opaque-operation',{}]];},malformed:()=>{malformed=true;}};
}
test('browse reads lifecycle metadata only and checks the same account snapshot without entry/history payloads',async()=>{
  const f=fixture(),result=await f.run();assert.deepEqual(result,{lifecycle:{}});assert.ok(f.reads.every(row=>!row.p.includes('notes')));assert.equal(f.reads.filter(row=>row.kind==='value').length,1);
});
test('nonempty operation registry requests the established full validation without reading its bodies',async()=>{
  const f=fixture();f.pending();assert.equal(await f.run(),null);assert.ok(f.reads.every(row=>row.kind==='directory'));
});
test('validated operation rows are read individually and only blocking IDs remain in the index',async()=>{
  assert.ok(fs.existsSync(file));require(file);const reads=[],account='account';
  const result=await NowWikiIndex.read({stamp:'one',account,metadata:['wiki_ingest_operations'],guard:{active:()=>true},
    directory:async p=>({projection:'path_v1',found:true,stamp:'one',part:{type:'object',entries:p.at(-1)==='wiki_ingest_operations'?[['op',{}]]:[]}}),
    read:async p=>{reads.push(p);return {projection:'path_v1',found:true,stamp:'one',value:{operation_id:'op',exact:'validated metadata'}};},
    inspectOperations:rows=>{assert.equal(rows.op.exact,'validated metadata');return ['wiki:pending'];}});
  assert.deepEqual(result,{lifecycle:{},blocked:['wiki:pending']});assert.deepEqual(reads,[['contexts',account,'wiki_ingest_operations','op']]);
});
test('stale, late account and malformed lifecycle never produce a partial index',async()=>{
  for(const action of ['change','lock','malformed']){const f=fixture();f[action]();await assert.rejects(f.run());}
});
