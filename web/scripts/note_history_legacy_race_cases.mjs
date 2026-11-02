import assert from 'node:assert/strict';

// Both actual runtimes execute the same delayed/lost-v1-response sequence.
export async function checkLegacyRaces({run,until,restart}) {
  const results=[];
  try {
    for (const loss of [false,true]) {
      await run('noteHistoryFlush()');
      const id=await run(`(() => {
        state.settings.server.autoSync=false;state.settings.server.lastSyncedAt=null;persistSettings();clearTimeout(serverSyncTimer);
        const node=createNode('E3 v1 race','LEGACY_A',null,1);node.shared=true;state.data.tree.push(node);state.selectedTreeId=node.id;render();
        const control={fetcher:globalThis.fetch,events:[],id:node.id,released:false};globalThis.__e3Legacy=control;
        globalThis.fetch=(...args)=>{
          const url=String(args[0]);
          if(url.includes('/api/v2/notes/'))control.events.push({kind:'v2',active:control.started&&!control.released});
          if(url.includes('/api/v1/sync')&&args[1]?.method==='POST'){
            control.started=true;control.events.push({kind:'v1'});control.body=args[1].body;const response=control.fetcher.call(globalThis,...args);
            return new Promise((resolve,reject)=>{control.release=async()=>{control.released=true;try{const value=await response;if(${JSON.stringify(loss)})reject(new Error('synthetic v1 response lost'));else resolve(value);}catch(error){reject(error);}};});
          }
          return control.fetcher.call(globalThis,...args);
        };
        globalThis.__e3LegacyPromise=syncWebNotesToServer(undefined,{skipFormSave:true});return node.id;
      })()`);
      await until('typeof globalThis.__e3Legacy?.release === "function"');
      const captured=await run('globalThis.__e3Legacy.body');
      assert.equal(JSON.parse(captured).notes.find(n=>n.local_id===id).content,'LEGACY_A');
      await run(`(() => {const node=findTreeNode(state.data.tree,${JSON.stringify(id)});node.content='DRAFT_B';markTreeNodeChanged(node);persist();})()`);
      await run(`(async()=>{await noteHistoryCaptureChain;await noteHistory.seal(${JSON.stringify(id)});await syncWebNotesToServer(undefined,{skipFormSave:true});await noteHistory.sync();})()`);
      assert.equal(await run('globalThis.__e3Legacy.events.filter(e=>e.kind==="v2"&&e.active).length'),0,'v2 must not run while the v1 response is unsettled');
      assert.ok(await run('noteHistory.legacyPending()'));
      await run('globalThis.__e3Legacy.release();globalThis.__e3LegacyPromise');
      await run('globalThis.fetch=globalThis.__e3Legacy.fetcher;delete globalThis.__e3Legacy;delete globalThis.__e3LegacyPromise;');
      if(loss){
        assert.equal(await run('JSON.stringify(noteHistory.legacyPending().body)'),captured);
        await restart();
        assert.equal(await run('JSON.stringify(noteHistory.legacyPending().body)'),captured,'uncertain v1 request survives actual restart');
        await run(`(() => {const fetcher=globalThis.fetch;globalThis.__e3Legacy={fetcher,events:[]};globalThis.fetch=(...args)=>{const url=String(args[0]);if(url.includes('/api/v1/sync'))globalThis.__e3Legacy.events.push({kind:'v1',body:args[1]?.body});if(url.includes('/api/v2/notes/'))globalThis.__e3Legacy.events.push({kind:'v2'});return fetcher(...args);};})()`);
        await run('syncWebNotesToServer(undefined,{skipFormSave:true})');
        const events=await run('globalThis.__e3Legacy.events');
        assert.equal(events[0]?.kind,'v1');assert.equal(events[0]?.body,captured);
        assert.equal(events.filter(e=>e.kind==='v2').length,0,'replay acknowledgment must precede v2');
        await run('globalThis.fetch=globalThis.__e3Legacy.fetcher;delete globalThis.__e3Legacy;');
      }
      const settled=await run('({pending:noteHistory.legacyPending(),status:state.settings.server.lastStatus,message:state.settings.server.lastMessage,raw:state.settings.server.lastRawMessage,error:noteHistory.failure()})');
      assert.equal(settled.pending,null,JSON.stringify(settled));
      await run('noteHistoryFlush()');
      const current=await run(`noteHistoryRequest(noteHistoryContext(),'current','GET',{local_id:${JSON.stringify(id)}})`);
      assert.equal(current.snapshot.note.content,'DRAFT_B');
      assert.equal(await run(`noteHistory.view(${JSON.stringify(id)}).conflict`),null);
      results.push(loss?'actual v1 response loss + cold restart + exact-body replay precedes v2 adoption':'actual delayed v1 response + edit/enrollment + repeated sync sends v2 only after settlement');
    }
    return results;
  } finally {
    await run('if(globalThis.__e3Legacy){globalThis.fetch=globalThis.__e3Legacy.fetcher;delete globalThis.__e3Legacy;}delete globalThis.__e3LegacyPromise;').catch(()=>{});
  }
}
