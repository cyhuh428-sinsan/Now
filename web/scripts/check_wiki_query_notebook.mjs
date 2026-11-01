import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {fixture,ctx,clone} from './wiki_ingest_fixture.mjs';
import {catalog as graphCatalog,documents} from './check_wiki_graph.mjs';
const {box,P}=await fixture();
for(const name of ['wiki-query','wiki-query-notebook']){
  try{vm.runInContext(await fs.readFile(new URL('../vendor/'+name+'.js',import.meta.url),'utf8'),box);}catch(error){if(error.code!=='ENOENT')throw error;}
}
assert.equal(typeof box.createWikiQueryNotebook,'function','Query must use the actual account-bound approved catalog');
let context={...ctx,enabled:true},generation=0,calls=0;
let catalog={...clone(graphCatalog),nodes:graphCatalog.nodes.map(n=>({...clone(n),origin:'server',protected:false}))};
const book={approvedCatalog:async()=>clone(catalog)};
const query=box.createWikiQueryNotebook({book,context:()=>context,contextKey:()=>JSON.stringify([context,generation])});
const initial=P.canonicalJson(catalog),snapshot=await query.plan('Alpha',{related_limit:0});
const output=s=>{const page=s.pages[0];return {query_hash:s.snapshot_hash,title:'Answer',claims:[{id:'a',statement:'A compiled finding',assessment:'supported',citation_ids:['c']}],
  citations:[{id:'c',wiki_id:page.wiki_id,draft_id:page.draft_id,approval_id:page.approval_id,draft_hash:page.draft_hash,document_version:page.document_version,section_id:'s1',quote:page.draft.sections[0].markdown}],uncertainties:[]};};
const connection={provider:'synthetic',model:'auto',endpoint:'https://model.invalid/v1',outputTokens:512};
// The synthetic callback receives a prompt-shaped object rather than a snapshot.
connection.invoke=async prompt=>{calls++;const input=JSON.parse(prompt).input;return output({...input,snapshot_hash:input.query_hash});};
await assert.rejects(()=>query.run(snapshot,connection),/wiki_query_consent/);assert.equal(calls,0);
const answer=await query.run(snapshot,connection,{confirmed:true});assert.equal(calls,1);assert.equal(answer.persisted,false);
assert.equal(P.canonicalJson(catalog),initial,'Query does not update a Wiki, Note or operation journal');
const stale=clone(catalog);stale.nodes[0].stale=true;catalog=stale;
await assert.rejects(()=>query.run(snapshot,connection,{confirmed:true}));assert.equal(calls,1,'stale input is rejected before provider invocation');
catalog=JSON.parse(initial);
await assert.rejects(()=>query.run(snapshot,{...connection,outputTokens:0},{confirmed:true}));assert.equal(calls,1);
await assert.rejects(()=>query.run(snapshot,{...connection,invoke:async()=>{calls++;generation++;return output(snapshot);}},{confirmed:true}),/wiki_query_context/);
assert.equal(calls,2,'a late result is not automatically retried');
const pending=await query.plan('Alpha',{related_limit:0});
await assert.rejects(()=>query.run(pending,{...connection,invoke:async()=>{calls++;catalog.nodes[0].protected=true;return output(pending);}},{confirmed:true}));
assert.equal(calls,3,'a locked input must not leak a late answer');
catalog=JSON.parse(initial);context={...context,owner:'other'};
await assert.rejects(()=>query.run(snapshot,connection,{confirmed:true}));assert.equal(calls,3);
context={...ctx,enabled:true};generation++;
assert.equal(typeof query.planProtected,'function','an explicitly unlocked protected Wiki needs a memory-only Query path');
let unlocked=true,protectedReads=0;
const protectedAccess={origin:'server',guard:()=>{if(!unlocked)throw Error('locked');},revalidate:async()=>{protectedReads++;if(!unlocked)throw Error('locked');}};
const protectedSnapshot=await query.planProtected('Alpha',documents[0],protectedAccess);
assert.equal(protectedSnapshot.memory_only,true);assert.equal(protectedSnapshot.pages.length,1);
const protectedAnswer=await query.run(protectedSnapshot,connection,{confirmed:true});assert.equal(protectedAnswer.memory_only,true);assert.equal(protectedAnswer.persisted,false);
assert.throws(()=>box.NowWikiQuery.assertSaveable(protectedSnapshot),/wiki_query_protected/);
assert.ok(protectedReads>=3,'protected access is checked again before and after the model');
const beforeLate=calls;
await assert.rejects(()=>query.run(protectedSnapshot,{...connection,invoke:async()=>{calls++;unlocked=false;return output(protectedSnapshot);}},{confirmed:true}),/locked/);
assert.equal(calls,beforeLate+1);
console.log('Wiki Query adapter: explicit consent/budget, current approved sources, context/late-lock guards, no writes or retries PASS');
