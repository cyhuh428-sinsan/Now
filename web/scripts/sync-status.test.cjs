const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const status=require('../vendor/sync-status-ui.js');require('../vendor/note-history-state.js');const history=globalThis.NowNoteHistory;
test('schema errors identify the rejected field without serializing input, context or arbitrary server text',()=>{
 const error=status.responseError(422,{detail:[{loc:['body','entries',0,'snapshot','note','client_updated_at'],type:'value_error',msg:'Value error, timezone required',input:'NEVER_SHOW_INPUT',ctx:{secret:'NEVER_SHOW_CONTEXT'}}]});
 assert.match(error.message,/client_updated_at/);assert.match(error.message,/시간대/);assert.ok(!error.message.includes('NEVER_SHOW'));
 assert.equal(status.responseError(409,{detail:{code:'invalid_note_parent'}}).code,'invalid_note_parent');
});
test('status rows inspect current metadata only and distinguish preserved excluded records',()=>{
 assert.deepEqual(status.rows(null),[]);
 const notes={a:{draft:{title:'note',deleted_at:null},conflicted:true,conflictCode:'baseline_selection_required'},
  b:{draft:{title:'trash',deleted_at:'2026-11-03T00:00:00Z'},localOnly:true,conflicted:true,error:{code:'invalid_note_parent',message:'invalid_note_parent'}},
  c:{draft:{title:'plain'},conflicted:false}};
 const rows=status.rows({issues:()=>Object.entries(notes).map(([id,item])=>history.issueSummary(id,item)).filter(Boolean),
  currentView(){throw Error('Current bodies must not be cloned');},ensure(){throw Error('Full history forbidden');},entries(){throw Error('Full export forbidden');}});
 assert.equal(rows.length,2);assert.equal(rows[0].title,'note');assert.equal(rows[1].excluded,true);assert.equal(rows[1].deleted,true);
 assert.ok(rows.every(row=>!Object.hasOwn(row,'content')));
});
test('excluding local notes preserves conflicts and requests but no longer counts them as active sync failures',()=>{
 const ctx={enabled:true,owner:'alice',url:'https://qa.invalid'},account=history.key(ctx),note={owner_id:'alice',local_id:'a',content:'keep'};
 const entry={raw:note,draft:note,base:{inventory_revision_ids:[]},revisions:[],outbox:[{body:{keep:'immutable'}}],receipts:[],
  localOnly:true,conflict:{code:'invalid_note_parent'},error:{code:'invalid_note_parent',message:'preserved'}};
 const store=history.create({initial:{schema_version:1,contexts:{[account]:{notes:{a:entry}}}},context:()=>ctx,write:async()=>{}});
 assert.equal(store.status().conflicts,0);assert.equal(store.status().errors,0);
 assert.deepEqual(store.view('a').outbox,entry.outbox);assert.deepEqual(store.view('a').conflict,entry.conflict);
 assert.equal(store.currentView('a').conflictCode,'invalid_note_parent');
});
for(const file of ['web/app.js','desktop/app/app.js'])test(file+': sync status opens diagnostics, not preferences',()=>{
 const source=fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n'),start=source.indexOf('  elements.syncStatusBtn?.addEventListener'),end=source.indexOf('\n\n',start);
 let click,opened=0,settings=0;
 const context={elements:{syncStatusBtn:{addEventListener:(_name,fn)=>{click=fn;}}},noteProtection:{pending:()=>false},openSyncStatus:()=>{opened++;},toggleSettings:()=>{settings++;}};
 vm.createContext(context);vm.runInContext(source.slice(start,end),context);click();assert.equal(opened,1);assert.equal(settings,0);
});
