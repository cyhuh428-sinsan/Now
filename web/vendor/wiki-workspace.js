/* Workspace assembly shared by memo integration and the independent Wiki entry. */
(() => {
  'use strict';
  function create(api){
    const {context,contextKey,history,source,notes,readCurrent,readRemote}=api;
    const fresh=async()=>{if(api.verifyFresh){await api.verifyFresh();if(!context().enabled)throw Error('자료·보호 상태가 변경되었습니다. 다시 확인하세요.');}};
    const server=NowWikiServerAccess.create({context,contextKey,request:api.request,readWiki:readRemote});
    const sources=NowNoteWikiSources.create({context,contextKey,history,readCurrent});
    const lifecycle=NowWikiLifecycle.create({context,contextKey,history,
      read:(_ctx,local)=>readRemote(local.slice(5)),request:api.lifecycleRequest});
    let ingest;
    const selected=NowWikiSelectedPage.create({context,contextKey,history,source,server,
      openSet:api.openSet,inspectOperations:rows=>ingest.inspectOperations(rows),readCurrent,readRemote,
      inspectLifecycle:(resources,stored)=>lifecycle.inspect(resources,stored)});
    const book=createWikiNotebook({selected,context,contextKey,history,lifecycle,server,source,notes,readCurrent,
      listRemote:api.listRemote,readRemote,approveV2:(value,id)=>ingest.approveLocal(value,id),rejectV2:(value,id)=>ingest.rejectLocal(value,id),
      readOperations:()=>ingest.operations()});
    ingest=createWikiIngestNotebook({context,contextKey,history,lifecycle,source,viewGeneration:api.viewGeneration,
      sources,captureNotes:ids=>book.capture(ids),server,lintSnapshot:()=>book.lintSnapshot(),readRemote,
      sourceSafety:async id=>{
        const value=source(id),ctx=context();
        if(!value||value.status!=='ok'||value.protected||value.origin!=='local')
          throw Error('서버 원본의 lineage·전환 상태를 먼저 확인해야 합니다. 원본은 보존했습니다.');
        const roots=[history().export()],seen=new WeakSet();
        while(roots.length){
          const root=roots.shift();if(seen.has(root))continue;seen.add(root);
          const item=root.contexts?.[NowNoteHistory.key(ctx)]?.notes?.[id];
          if(item&&(item.protectionScope||item.base.crypto_epoch!==0||item.raw?.content?.startsWith('NOW_ENCRYPTED_V1:')
            ||item.draft?.content?.startsWith('NOW_ENCRYPTED_V1:')||item.revisions.some(row=>row.snapshot?.note?.content?.startsWith('NOW_ENCRYPTED_V1:')))
            ||Object.values(root.protection_operations||{}).some(marker=>marker.scope.owner===ctx.owner&&marker.scope.local_id===id
              &&marker.scope.url.replace(/\/+$/,'')===ctx.url.replace(/\/+$/,'')))
            throw Error('보호 이력이 있는 원본은 일괄 적재할 수 없습니다.');
          roots.push(...(root.recovery_archives||[]));
        }
        return {status:'ok',epoch:0,lineage:false,fence:false};
      }});
    const view=createLazyWikiView({contextKey,
      prepare:async(method,args)=>{await fresh();return method==='open'&&args[0]==='browse'?api.prepareBrowse():history().ensure();},
      mount:()=>mountNowWiki({prepare:async()=>{await fresh();await history().ensure();},...book,sources,ingest,contextKey,
        connection:api.connection,openProtection:api.openProtection,query:createWikiQueryNotebook({book,context,contextKey}),notes,
        openSource:ref=>{
          if(ref.owner_id!==context().owner||!source(ref.local_id))throw Error('현재 계정에서 원문을 사용할 수 없습니다.');
          view.close();api.openSource(ref);
        }},api.mountOptions)});
    return {server,sources,lifecycle,book,ingest,view};
  }
  globalThis.NowWikiWorkspace={create};
})();
