/* Fresh existing-API proof for plaintext Wiki batches; never decrypts or writes. */
globalThis.NowWikiServerAccess=Object.freeze({create(api){
  'use strict';
  const P=NowNoteProtectionProtocol,copy=structuredClone,eq=(a,b)=>P.canonicalJson(a)===P.canonicalJson(b);
  const check=(v,message='서버 원본 검증에 실패했습니다.')=>{if(!v)throw Error(message);};
  const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v);
  const exact=(value,names)=>check(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===names.length&&names.every(k=>Object.hasOwn(value,k)),
    '작업 응답 형식이 다릅니다. 원요청은 보존했습니다.');
  const plain=s=>s?.status==='ok'&&s.crypto_epoch===0&&s.protection_state==='legacy'&&s.identity_state==='coherent'
    &&!Object.hasOwn(s,'crypto_transition')&&uuid(s.head_revision_id)&&Number.isSafeInteger(s.head_version)&&s.head_version>0
    &&Number.isSafeInteger(s.history_generation)&&s.history_generation>=0&&s.replica_count===1&&s.has_replica_variants===false;
  function action(){
    const ctx={...api.context()},key=api.contextKey();
    check(ctx.enabled&&ctx.online&&ctx.owner&&ctx.device&&ctx.url,'인증된 서버에 연결하세요.');
    const active=()=>{check(key===api.contextKey()&&api.context().enabled,'계정·서버 상태가 변경되었습니다.');};
    const get=async(path,body={})=>{active();const result=await api.request(path,'GET',{owner_id:ctx.owner,...body});active();return result;};
    return {ctx,active,get};
  }
  async function capabilities(a,policy=2){
    const info=await a.get('/api/v1/server');
    check(info.status==='ok'&&info.capabilities?.wiki_document_schema===2&&info.capabilities.wiki_operations_v1===true
      &&(policy===1||info.capabilities.wiki_operation_manifest_schema===2),
      '서버가 Wiki v2 일괄 반영을 지원하는지 확인하세요. 로컬 자료는 보존했습니다.');
  }
  function snapshot(value,a,id,current=false){
    P.validateSnapshot(value);check(value.note.owner_id===a.ctx.owner&&value.note.local_id===id&&(!current||!value.note.deleted_at)
      &&!value.note.content.startsWith('NOW_ENCRYPTED_V1:'),'보호·삭제·다른 계정의 원본은 일괄 적재할 수 없습니다.');
  }
  async function identity(a,id,current){
    const result=await a.get('/api/v2/notes/crypto-transitions/status',{local_id:id,device_id:a.ctx.device});
    check(uuid(result.server_instance_id)&&result.preparation_only===true&&result.current_exists===true,'물리 서버와 원본 상태를 확인하세요.');
    for(const k of ['head_revision_id','head_version','crypto_epoch','history_generation','protection_state','identity_state','inventory_revision_ids'])
      check(eq(result[k],current[k]),'원본 판본·보호 상태가 변경되었습니다. 다시 검토하세요.');
    return result.server_instance_id;
  }
  async function inspect(id,expected,{policy=2}={}){
    const a=action();check(typeof id==='string'&&id.length>0&&id.length<=120,'원본 ID를 확인하세요.');await capabilities(a,policy);
    const current=await a.get('/api/v2/notes/current',{local_id:id});
    check(plain(current),'보호 lineage·전환·대표 판본을 확인할 수 없어 일괄 적재하지 않았습니다.');snapshot(current.snapshot,a,id,true);
    if(expected){check(current.snapshot.note.content===expected.content&&current.head_revision_id===expected.revisionId&&current.head_version===expected.headVersion,
      '원본·위키 판본이 변경되었습니다. 다시 검토하세요.');}
    const instance=await identity(a,id,current),refs=new Map(),cursors=new Set();let cursor=null;
    do{
      const page=await a.get('/api/v2/notes/revisions',{local_id:id,limit:100,...(cursor?{cursor}:{})});
      check(page.status==='ok'&&page.crypto_epoch===0&&page.history_generation===current.history_generation&&Array.isArray(page.items)
        &&(page.next_cursor===null||typeof page.next_cursor==='string'&&page.next_cursor.length>0),'과거 판본 전체를 확인할 수 없습니다.');
      for(const row of page.items){
        const ref=row.revision_ref,key=ref?.kind+':'+ref?.id;
        check(row.representation_epoch===0&&['note_revision','offline_branch'].includes(ref?.kind)&&uuid(ref.id)&&!refs.has(key),'보호·중복·미지원 과거 판본입니다.');
        refs.set(key,copy(ref));check(refs.size<=2000,'원본 과거 판본 검증 한도를 초과했습니다. 일부만 적재하지 않았습니다.');
      }
      cursor=page.next_cursor;if(cursor){check(!cursors.has(cursor),'과거 판본 목록이 반복되었습니다.');cursors.add(cursor);}
      check(cursors.size<=2000,'과거 판본 검증 한도를 초과했습니다.');
    }while(cursor);
    check(refs.has('note_revision:'+current.head_revision_id)&&Array.isArray(current.inventory_revision_ids)
      &&current.inventory_revision_ids.every(ref=>refs.has('note_revision:'+ref)),'원본의 현재·과거 판본 집합을 확인하세요.');
    const history=[];
    for(const ref of refs.values()){
      const result=await a.get('/api/v2/notes/revision',{local_id:id,revision_kind:ref.kind,revision_id:ref.id});
      check(result.status==='ok'&&result.crypto_epoch===0&&eq(result.revision_ref,ref),'과거 판본 참조가 다릅니다.');snapshot(result.snapshot,a,id);
      history.push({revision_ref:copy(ref),snapshot:copy(result.snapshot)});
    }
    const latest=await a.get('/api/v2/notes/current',{local_id:id});check(plain(latest)&&eq(latest,current),'검증 중 원본·보호 상태가 변경되었습니다.');
    check(await identity(a,id,latest)===instance,'물리 서버 식별자가 변경되었습니다.');a.active();
    return {instance,current:copy(current),history,safety:{status:'ok',epoch:0,lineage:false,fence:false}};
  }
  async function pinnedWiki(ref,{fresh=true,allowDeleted=false,revisionId=null,policy=2}={}){
    const a=action(),W=NowNoteWiki;W.validateEvidence(ref,a.ctx.owner);check(ref.kind==='wiki'&&ref.origin==='server'&&api.readWiki,'고정 위키 읽기 연결을 확인하세요.');
    const proof=await inspect('wiki:'+ref.wiki_id,undefined,{policy}),remote=await api.readWiki(ref.wiki_id);a.active();
    check(remote.resource?.owner_id===a.ctx.owner&&remote.resource.id===ref.wiki_id&&(!remote.resource.deleted_at||allowDeleted)
      &&remote.artifact?.protected===false&&remote.artifact.head_revision_id===proof.current.head_revision_id,'wiki_source_unavailable');
    const index=await W.validateLink(remote.resource.payload,a.ctx);a.active();check(index.artifact_local_id==='wiki:'+ref.wiki_id,'wiki_evidence_binding');
    const currentDocument=await W.validateDocument(proof.current.snapshot.note.content,a.ctx);a.active();
    check(currentDocument.wiki_id===ref.wiki_id&&(!remote.artifact.document||eq(remote.artifact.document,currentDocument)),'wiki_evidence_binding');
    if(fresh){
      const approval=currentDocument.approvals.at(-1),draft=currentDocument.drafts.find(d=>d.id===approval?.draft_id);
      check(currentDocument.document_version>=ref.document_version&&approval?.id===ref.approval_id&&draft?.id===ref.draft_id&&draft.draft_hash===ref.content_hash,'wiki_source_changed');
    }
    const history=[];let chosen=null;
    for(const row of proof.history){
      check(row.snapshot.note.source==='wiki-artifact','wiki_evidence_binding');
      const document=await W.validateDocument(row.snapshot.note.content,a.ctx);a.active();check(document.wiki_id===ref.wiki_id,'wiki_evidence_binding');
      history.push({revision_ref:copy(row.revision_ref),document});
      if(row.revision_ref.kind!=='note_revision'||revisionId&&row.revision_ref.id!==revisionId||document.document_version!==ref.document_version)continue;
      const approval=document.approvals.find(v=>v.id===ref.approval_id&&v.draft_id===ref.draft_id),draft=document.drafts.find(d=>d.id===ref.draft_id&&d.draft_hash===ref.content_hash);
      if(approval&&draft&&(!chosen||row.revision_ref.id===proof.current.head_revision_id))chosen={document,draft,revisionId:row.revision_ref.id};
    }
    check(chosen,'wiki_source_unavailable');return {...copy(chosen),currentDocument,index,history,deleted:Boolean(remote.resource.deleted_at),instance:proof.instance,safety:proof.safety,
      ...(Object.hasOwn(remote.artifact,'generation_provenance')?{generationProvenance:copy(remote.artifact.generation_provenance)}:{})};
  }
  function verifyReceipt(value,manifest){
    exact(value,['status','wiki_operation','operation_id','manifest_hash','state','pages']);
    check(value.status==='ok'&&value.wiki_operation===true&&value.operation_id===manifest.operation_id&&value.manifest_hash===manifest.manifest_hash
      &&['prepared','committed','aborted'].includes(value.state)&&Array.isArray(value.pages),'원작업 응답·해시가 다릅니다.');
    check(value.pages.length===(value.state==='committed'?manifest.changes.length:0),'원작업의 전체 페이지 응답을 확인하세요.');
    for(let i=0;i<value.pages.length;i++){
      const p=value.pages[i],c=manifest.changes[i];
      exact(p,['status','wiki_operation','operation_id','manifest_hash','wiki_id','mutation_id','result_revision_id','result_head_version',
        'result_inventory_revision_ids','crypto_epoch','history_generation','document_version','index_version','document_schema_floor','result_document_hash']);
      check(p.status==='ok'&&p.wiki_operation===true&&p.operation_id===manifest.operation_id&&p.manifest_hash===manifest.manifest_hash
        &&p.wiki_id===c.wiki_id&&p.mutation_id===c.note_mutation_id&&p.result_document_hash===c.result_document_hash
        &&uuid(p.result_revision_id)&&p.result_head_version===c.base_head_version+1&&p.document_version===c.base_document_version+1
        &&p.index_version===c.base_index_version+1&&p.crypto_epoch===0&&p.document_schema_floor===2&&Number.isSafeInteger(p.history_generation)&&p.history_generation>0
        &&Array.isArray(p.result_inventory_revision_ids)&&p.result_inventory_revision_ids.length>0&&p.result_inventory_revision_ids.length<=2000
        &&p.result_inventory_revision_ids.every(uuid)&&new Set(p.result_inventory_revision_ids).size===p.result_inventory_revision_ids.length
        &&eq([...p.result_inventory_revision_ids].sort(),p.result_inventory_revision_ids)&&p.result_inventory_revision_ids.includes(p.result_revision_id),
        '원작업의 페이지·판본·결과 해시가 다릅니다.');
    }
    return copy(value);
  }
  async function operationAction(manifest,instance,write=false){
    const a=action();exact(manifest,['schema_version','owner_id','device_id','operation_id','mutation_id','commit_mutation_id','abort_mutation_id','kind','inputs','draft_bindings','changes','manifest_hash']);
    const unsigned=copy(manifest);delete unsigned.manifest_hash;
    check([1,2].includes(manifest.schema_version)&&manifest.owner_id===a.ctx.owner&&uuid(manifest.operation_id)&&uuid(instance)
      &&(!write||manifest.device_id===a.ctx.device)&&await P.hashJson(unsigned)===manifest.manifest_hash,'고정 작업·계정·기기·해시를 확인하세요.');
    const source=manifest.inputs?.find(ref=>ref.kind==='note'&&ref.origin==='server'&&ref.note_ref.owner_id===a.ctx.owner);
    const wiki=manifest.inputs?.find(ref=>ref.kind==='wiki'&&ref.origin==='server'&&ref.owner_id===a.ctx.owner&&uuid(ref.wiki_id));
    const anchor=source?.note_ref.local_id||(wiki?'wiki:'+wiki.wiki_id:null);
    check(anchor,'원작업의 서버 원본 참조가 없습니다.');
    if(write)await capabilities(a,manifest.schema_version);
    const identity=await a.get('/api/v2/notes/crypto-transitions/status',{local_id:anchor,device_id:a.ctx.device});
    check(identity.server_instance_id===instance&&identity.preparation_only===true,'물리 서버 식별자가 변경되었습니다. 원요청은 보존했습니다.');
    return a;
  }
  async function send(manifest,instance,phase,body){
    check(phase==='abort'||manifest.schema_version===2,'wiki_operation_upgrade_required');
    const a=await operationAction(manifest,instance,true);
    const result=await api.request('/api/v1/wiki-operations/'+(phase==='prepare'?'prepare':manifest.operation_id+'/'+phase),'POST',copy(body));a.active();
    const receipt=verifyReceipt(result,manifest);check(receipt.state===({prepare:'prepared',commit:'committed',abort:'aborted'}[phase]),'원작업 단계의 응답이 다릅니다.');return receipt;
  }
  async function status(manifest,instance){
    const a=await operationAction(manifest,instance);let result;
    try{result=await a.get('/api/v1/wiki-operations/'+manifest.operation_id);}
    catch(error){if(error.status===404)error.operationAbsent=true;throw error;}
    exact(result,['status','operation_id','state','manifest_hash','manifest','receipt']);
    check(result.status==='ok'&&result.operation_id===manifest.operation_id&&result.manifest_hash===manifest.manifest_hash&&eq(result.manifest,manifest),'상태 응답이 원작업과 다릅니다.');
    const receipt=verifyReceipt(result.receipt,manifest);check(receipt.state===result.state,'상태와 원응답이 다릅니다.');return copy(result);
  }
  async function readOperation(id,instance){
    check(uuid(id)&&uuid(instance),'원작업 ID·물리 서버를 확인하세요.');
    const a=action(),result=await a.get('/api/v1/wiki-operations/'+id);
    exact(result,['status','operation_id','state','manifest_hash','manifest','receipt']);
    check(result.status==='ok'&&result.operation_id===id&&result.manifest?.operation_id===id
      &&result.manifest_hash===result.manifest.manifest_hash,'상태 응답의 원작업이 다릅니다.');
    await operationAction(result.manifest,instance);a.active();
    const receipt=verifyReceipt(result.receipt,result.manifest);
    check(receipt.state===result.state,'상태와 원응답이 다릅니다.');return copy(result);
  }
  const abort=(manifest,instance)=>send(manifest,instance,'abort',{schema_version:1,owner_id:manifest.owner_id,device_id:manifest.device_id,
    mutation_id:manifest.abort_mutation_id,manifest_hash:manifest.manifest_hash});
  async function commit(manifest,body,instance){
    exact(body,['schema_version','owner_id','device_id','mutation_id','manifest_hash','documents']);
    check(body.schema_version===1&&body.owner_id===manifest.owner_id&&body.device_id===manifest.device_id&&body.mutation_id===manifest.commit_mutation_id
      &&body.manifest_hash===manifest.manifest_hash&&Array.isArray(body.documents)&&body.documents.length===manifest.changes.length,'원 commit 요청과 다릅니다.');
    for(let i=0;i<body.documents.length;i++)check(body.documents[i].wiki_id===manifest.changes[i].wiki_id
      &&await P.hashJson(body.documents[i].document)===manifest.changes[i].result_document_hash,'원 commit 본문·해시가 다릅니다.');
    return send(manifest,instance,'commit',body);
  }
  return {inspect,pinnedWiki,verifyReceipt,status,readOperation,prepare:(manifest,instance)=>send(manifest,instance,'prepare',manifest),commit,abort};
}});
