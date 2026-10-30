/* Synthetic metadata backend for isolated renderer QA only. Not a server/DB substitute. */
globalThis.createProtectionViewBackend = function(scope,password,saved) {
  const Q=NowNoteProtectionProtocol, cp=v=>structuredClone(v), j=v=>Q.canonicalJson(v), eq=(a,b)=>j(a)===j(b);
  const uid=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
  const key=(kind,id,slot)=>({kind,id:String(id),slot});
  const kinds=['analysis_error','analysis_input','analysis_result','inventory_snapshot','note_body','offline_snapshot','recording_transcript','reserved_offline_snapshot','revision_before','revision_snapshot'];
  const stamp='2026-10-30T00:00:00.000000Z';
  let serial=100;
  const nonce=()=>uid(++serial);
  const note={id:17,owner_id:scope.owner,local_id:scope.local_id,device_id:scope.device,note_type:'tree',title:'Synthetic target',content:'SYNTHETIC-E4B3A-ORIGINAL\r\n',parent_local_id:null,level:1,tags:'',source:null,deleted_at:null,client_updated_at:stamp,created_at:stamp,updated_at:stamp};
  let base={head_version:1,head_revision_id:uid(7),crypto_epoch:0,history_generation:1,protection_state:'legacy',inventory_revision_ids:[uid(7)],identity_state:'coherent',current_exists:true};
  let mode='plain',live=[],op=null,drain=null;
  const bodyKey=key('note_body',17,'content'),invKey=key('inventory_snapshot',17,'current');
  const ref={kind:'note_revision',id:uid(7)};
  const context=()=>({base:cp(base),current_mode:mode,selected_physical_note_id:17,mixed_metadata_version:1});
  const binding=(id,epoch,k,r=ref,parent=null)=>({server_instance_id:scope.instance,owner_id:scope.owner,local_id:scope.local_id,transition_id:id,crypto_epoch:epoch,destination_key:k,revision_ref:r,parent_ref:parent});
  const descriptor=async(k,raw,kind,epoch,bind,origin=null,storage=null)=>({key:k,representation_kind:kind,representation_epoch:epoch,is_null:raw===null,representation_version:1,representation_etag:nonce(),storage_operation_id:storage,semantic_origin_id:origin?.operation_id||null,
    origin_validator:k.kind==='note_body'?'body_v1':'native_v1',origin_row_required:k.kind!=='note_body',expected_binding:bind,revision_ref:bind?.revision_ref||(['inventory_snapshot','revision_snapshot','revision_before'].includes(k.kind)?ref:null),parent_ref:bind?.parent_ref||null,
    physical_note_id:['note_body','inventory_snapshot'].includes(k.kind)?17:null,inventory_revision_id:k.kind==='inventory_snapshot'?(bind?.revision_ref?.id||ref.id):null,linked_slot_version:null,ciphertext_sha256:raw!==null&&epoch>0?await Q.sha256(raw):null});
  const order=rows=>Q.keyOrder(rows.map(r=>r.descriptor.key)).map(k=>rows.find(r=>eq(r.descriptor.key,k)));
  const stats=items=>({total:items.length,nonnull:items.filter(d=>!d.is_null).length,nulls:items.filter(d=>d.is_null).length});
  const counts=items=>({...stats(items),by_kind:kinds.map(kind=>({kind,...stats(items.filter(d=>d.key.kind===kind))}))});
  const coverage={supported_kinds:kinds,scope_complete:true,full_protection_complete:false};
  async function catalog() {const entries=order(live).map(r=>r.descriptor),c=context();return {schema_version:3,status:'ok',server_instance_id:scope.instance,context:c,catalog_digest:await Q.hashJson({server_instance_id:scope.instance,owner_id:scope.owner,local_id:scope.local_id,context:c,entries}),entries,counts:counts(entries),coverage};}
  function framed(raw,index) {if(raw===null)return {total_bytes:0,total_chunks:0,chunk_index:null,data_base64:null};const bytes=new TextEncoder().encode(raw),part=bytes.slice(index*262144,(index+1)*262144);let text='';for(const b of part)text+=String.fromCharCode(b);return {total_bytes:bytes.length,total_chunks:Math.max(1,Math.ceil(bytes.length/262144)),chunk_index:index,data_base64:btoa(text)};}
  function result() {
    return {...cp(op.response),state:op.state,receipt:cp(op.receipt),receipt_matches_current:op.state==='committed',current_context:op.version===2
      ? {server_instance_id:scope.instance,...base,active_transition_id:op.state==='committed'?null:op.id}
      : {...context(),server_instance_id:scope.instance,active_operation_id:op.state==='committed'?null:op.id}};
  }
  async function legacyCatalog() {
    const items=order(live).map(r=>{
      const d=r.descriptor;return {key:d.key,representation_kind:d.representation_kind,representation_epoch:d.representation_epoch,representation_etag:'e'.repeat(64),is_null:d.is_null,total_bytes:r.raw===null?0:new TextEncoder().encode(r.raw).length,total_chunks:r.raw===null?0:Math.ceil(new TextEncoder().encode(r.raw).length/262144),ciphertext_sha256:d.ciphertext_sha256,expected_binding:d.expected_binding,revision_ref:d.revision_ref,parent_ref:d.parent_ref,physical_note_id:d.physical_note_id,inventory_revision_id:d.inventory_revision_id,operation_origin:r.origin};
    });
    const c={server_instance_id:scope.instance,...base},digest=await Q.hashJson({context:c,items});
    const names=['note_body','revision_snapshot','revision_before','inventory_snapshot','offline_snapshot'];
    return {context:{...c,catalog_digest:digest},catalog_digest:digest,counts:Object.fromEntries(names.map(n=>[n,items.filter(d=>d.key.kind===n).length])),coverage:{scope:'note_history',scope_complete:true,supported_kinds:names,full_protection_complete:false},items,next_cursor:null};
  }
  async function prepare(body,purpose) {
    const id=nonce(),version=purpose==='conversion'?2:3,sources=order(live).map(r=>({descriptor:cp(r.descriptor),source_etag:nonce()}));
    const inputs=cp(live),sets={};
    let response;
    if(version===2) {
      sets.entries=sources.filter(s=>!s.descriptor.is_null).map(s=>{const d=s.descriptor;return {key:d.key,destination_key:d.key,source_etag:s.source_etag,source_kind:d.representation_kind,output_kind:d.key.kind==='note_body'?'content_encrypted_v1':'history_envelope_v1',representation_epoch:d.representation_epoch,expected_binding:d.key.kind==='note_body'?null:binding(id,1,d.key,d.revision_ref,d.parent_ref),operation_origin:null,slot_version:null};});
      sets.null_slots=sources.filter(s=>s.descriptor.is_null).map(s=>({key:s.descriptor.key,is_null:true,representation_epoch:0,slot_version:null,expected_binding:binding(id,1,s.descriptor.key,s.descriptor.revision_ref,s.descriptor.parent_ref),operation_origin:null}));
      sets.origin_expectations=[];sets.linked_expectations=[];
      const metadata_context={schema_version:2,purpose,transition_id:id,server_instance_id:scope.instance,owner_id:scope.owner,local_id:scope.local_id,actor_device_id:scope.device};
      response={schema_version:2,transition_id:id,state:'prepared',lease_version:1,target_epoch:1,metadata_context,drain_id:drain.drain_id,drain_version:1,set_counts:Object.fromEntries(Object.entries(sets).map(([k,v])=>[k,v.length])),metadata_manifest_digest:await Q.hashJson({...metadata_context,...sets})};
    } else {
      const isCP=purpose==='current_plain_transition',epoch=isCP?base.crypto_epoch:base.crypto_epoch+1,newref={kind:'note_revision',id:nonce()},parent={kind:'note_revision',id:base.head_revision_id};
      const inv=sources.find(s=>eq(s.descriptor.key,invKey)).descriptor;
      const header={schema_version:3,purpose,operation_id:id,mutation_id:body.mutation_id,server_instance_id:scope.instance,owner_id:scope.owner,local_id:scope.local_id,actor_device_id:scope.device,base:context(),target_epoch:epoch,target_current_mode:isCP?'plain':'protected',drain_ref:{drain_id:drain.drain_id,drain_version:1},selection:isCP?cp(body.selection):null,
        server_fields:isCP?Object.fromEntries(['id','owner_id','local_id','device_id','client_updated_at','created_at','updated_at'].map(k=>[k,note[k]])):null,revision_ref:isCP?newref:null,parent_ref:isCP?parent:null,reserved_branches:[]};
      const dest=(k,src,kind,kEpoch,bind,isNull=false)=>({destination_key:k,source_keys:src,source_etag:nonce(),output_kind:kind,output_epoch:kEpoch,is_null:isNull,expected_binding:bind});
      sets.S=sources;sets.DSET=isCP?[
        dest(bodyKey,[bodyKey,invKey],'plain_text_v1',0,null),dest(invKey,[bodyKey,invKey],'snapshot_v1',0,null),
        dest(key('revision_snapshot',newref.id,'after'),[bodyKey,invKey],'snapshot_v1',0,null),
        dest(key('revision_before',newref.id,'before'),[invKey],'history_envelope_v1',inv.representation_epoch,binding(id,inv.representation_epoch,key('revision_before',newref.id,'before'),newref,parent)),
      ]:sources.map(s=>{const d=s.descriptor,k=d.key;return dest(k,[k],k.kind==='note_body'?'content_encrypted_v1':'history_envelope_v1',epoch,k.kind==='note_body'?null:binding(id,epoch,k,d.revision_ref,d.parent_ref),d.is_null);});
      sets.DSET=Q.keyOrder(sets.DSET.map(d=>d.destination_key)).map(k=>sets.DSET.find(d=>eq(d.destination_key,k)));
      sets.P=isCP?sources.filter(s=>![bodyKey,invKey].some(k=>eq(k,s.descriptor.key))).map(s=>s.descriptor):[];
      sets.O=sets.DSET.map(d=>{const original=sources.find(s=>eq(s.descriptor.key,d.source_keys[0]))?.descriptor;return {destination_key:d.destination_key,is_null:d.is_null,origin_validator:d.destination_key.kind==='note_body'?'body_v1':'native_v1',origin_row_required:d.destination_key.kind!=='note_body',storage_operation_id:id,semantic_origin_id:isCP&&['inventory_snapshot','revision_snapshot'].includes(d.destination_key.kind)?id:original?.semantic_origin_id||null};});
      sets.O.push(...sets.P.map(d=>({destination_key:d.key,...Object.fromEntries(['is_null','origin_validator','origin_row_required','storage_operation_id','semantic_origin_id'].map(k=>[k,d[k]]))})));
      sets.O=Q.keyOrder(sets.O.map(o=>o.destination_key)).map(k=>sets.O.find(o=>eq(o.destination_key,k)));
      response={schema_version:3,purpose,operation_id:id,state:'prepared',lease_version:1,metadata_header:header,metadata_manifest_digest:await Q.hashJson({...header,...sets}),counts:Object.fromEntries(Object.entries(sets).map(([k,v])=>[k,{total:v.length}])),set_digests:Object.fromEntries(await Promise.all(Object.entries(sets).map(async([k,v])=>[k,await Q.hashJson(v)])))};
    }
    op={id,version,purpose,body:cp(body),inputs,sets,response,state:'prepared',receipt:null,uploads:{}};drain.state='promoted';drain.transition_id=id;
    return cp(response);
  }
  async function publish(body) {
    if(op.version===2 && Object.hasOwn(body,'client_decryption_verified'))throw Error('schema2 unexpected field');
    const m=op.sets,header=op.response.metadata_header,isCP=op.purpose==='current_plain_transition';
    const cpOrigin=isCP?{purpose:op.purpose,operation_id:op.id,mutation_id:op.body.mutation_id,source_inventory_ref:op.body.selection.inventory_revision_ref,selected_physical_note_id:17,target_current_mode:'plain'}:null;
    const destinations=op.version===2?m.entries.map(e=>({destination_key:e.destination_key,output_kind:e.output_kind,output_epoch:1,is_null:false,expected_binding:e.expected_binding,source_keys:[e.key]})):m.DSET;
    const next=op.version===3?live.filter(r=>m.P.some(d=>eq(d.key,r.descriptor.key))):[];
    for(const d of destinations) {
      const k=d.destination_key;
      let raw=null;
      if(!d.is_null) {
        if(d.output_epoch===0)raw=k.kind==='note_body'?body.plain_current.content:j({schema_version:1,note:body.plain_current});
        else raw=op.uploads[j(k)].raw;
      }
      const old=op.inputs.find(r=>eq(r.descriptor.key,d.source_keys[0]));
      const origin=isCP&&['inventory_snapshot','revision_snapshot'].includes(k.kind)?cpOrigin:old?.origin||null;
      const desc=await descriptor(k,raw,d.output_kind,d.output_epoch,d.expected_binding,origin,op.id);
      if(isCP&&d.output_epoch===0&&k.kind!=='note_body') {desc.revision_ref=header.revision_ref;desc.parent_ref=header.parent_ref;if(k.kind==='inventory_snapshot')desc.inventory_revision_id=header.revision_ref.id;}
      next.push({descriptor:desc,raw,origin});
    }
    if(op.version===2)for(const z of m.null_slots)next.push({descriptor:await descriptor(z.key,null,'history_envelope_v1',1,null,null,op.id),raw:null,origin:null});
    live=next;mode=isCP?'plain':'protected';base={...base,head_version:base.head_version+1,history_generation:base.history_generation+1,crypto_epoch:isCP?base.crypto_epoch:base.crypto_epoch+1,protection_state:'protected',...(isCP?{head_revision_id:header.revision_ref.id,inventory_revision_ids:[header.revision_ref.id]}:{})};
    note.content=next.find(r=>eq(r.descriptor.key,bodyKey)).raw;
    op.state='committed';op.receipt=op.version===2?{owner_id:scope.owner,local_id:scope.local_id,server_instance_id:scope.instance,metadata_manifest_digest:op.response.metadata_manifest_digest,...base}:{owner_id:scope.owner,local_id:scope.local_id,server_instance_id:scope.instance,operation_id:op.id,metadata_manifest_digest:op.response.metadata_manifest_digest,result:context()};
    return result();
  }
  return {
    async init() {
      if(saved) {base=cp(saved.base);mode=saved.mode;live=cp(saved.live);op=cp(saved.op);drain=cp(saved.drain);serial=saved.serial;Object.assign(note,saved.note);return;}
      for(const [k,raw,kind] of [[bodyKey,note.content,'plain_text_v1'],[invKey,j({schema_version:1,note}),'snapshot_v1'],[key('revision_snapshot',ref.id,'after'),j({schema_version:1,note}),'snapshot_v1'],[key('revision_before',ref.id,'before'),null,'snapshot_v1']])live.push({descriptor:await descriptor(k,raw,kind,0,null),raw,origin:null});
    },
    export() {return {base,mode,live,op:{...op,inputs:[],uploads:{}},drain,serial,note};},
    note:()=>cp(note),
    async request(_scope,path,method,b) {
      if(path==='/api/v2/notes/crypto-transitions/status'&&!b.transition_id)return {server_instance_id:scope.instance,...base};
      if(path==='/api/v2/notes/related-drains'&&method==='POST') {drain={drain_id:nonce(),drain_version:1,state:'ready',accepted_runs:[],accepted_claims:[],pending_count:0,ready_base:cp(base)};return cp(drain);}
      if(path.endsWith('/related-drains/status'))return cp(drain);
      if(path==='/api/v2/notes/representations')return legacyCatalog();
      if(path.includes('/mixed-representations/')) {
        const c=await catalog(),common={schema_version:3,context:c.context,catalog_digest:c.catalog_digest};
        if(path.endsWith('/context'))return c;
        if(b.expected_context===undefined||b.catalog_digest!==c.catalog_digest)throw Error('synthetic context mismatch');
        if(path.endsWith('/catalog'))return {...common,counts:c.counts,coverage:c.coverage,entries:c.entries,next_cursor:null};
        const row=live.find(r=>r.descriptor.key.kind===b.kind&&r.descriptor.key.id===b.representation_id);
        if(path.endsWith('/metadata'))return {...common,descriptor:cp(row.descriptor),operation_origin:cp(row.origin)};
        if(path.endsWith('/representation'))return {...common,descriptor:cp(row.descriptor),...framed(row.raw,Number(b.chunk_index))};
        if(path.endsWith('/revision')) {
          const v=r=>r?{descriptor:r.descriptor,operation_origin:r.origin,snapshot:r.descriptor.representation_kind==='snapshot_v1'&&r.raw!==null?JSON.parse(r.raw):null,envelope:r.descriptor.representation_kind==='history_envelope_v1'&&r.raw!==null?JSON.parse(r.raw):null}:null;
          const after=live.find(r=>r.descriptor.key.kind==='revision_snapshot'&&r.descriptor.key.id===b.revision_id),before=live.find(r=>r.descriptor.key.kind==='revision_before'&&r.descriptor.key.id===b.revision_id);
          return {...common,revision_ref:{kind:b.revision_kind,id:b.revision_id},parent_ref:after?.descriptor.parent_ref,representation:v(after),before_representation:v(before)};
        }
      }
      if(method==='POST'&&(path.endsWith('/prepare')||path.endsWith('/quote')||path==='/api/v2/notes/crypto-transitions'))return prepare(b,path.includes('current-plain')?'current_plain_transition':path.includes('mixed-conversions')?'mixed_conversion':'conversion');
      if(path.endsWith('/manifest'))return op.version===2?{...cp(op.response),items:Object.entries(op.sets).flatMap(([set,rows])=>rows.map(entry=>({set,entry}))),next_cursor:null}:{...cp(op.response),section:b.section,entries:cp(op.sets[b.section]),next_cursor:null};
      if(path.endsWith('/source')) {
        const row=op.inputs.find(r=>r.descriptor.key.kind===b.kind&&r.descriptor.key.id===b.representation_id),k=row.descriptor.key;
        if(op.version===2)return {entry:cp(op.sets.entries.find(e=>eq(e.key,k))),metadata_manifest_digest:op.response.metadata_manifest_digest,metadata_context:op.response.metadata_context,value:row.raw};
        const s=op.sets.S.find(s=>eq(s.descriptor.key,k));return {schema_version:3,operation_id:op.id,metadata_manifest_digest:op.response.metadata_manifest_digest,entry_key:k,source_etag:s.source_etag,descriptor:s.descriptor,...framed(row.raw,Number(b.chunk_index))};
      }
      if(path.endsWith('/chunks')) {const k=b.entry_key;op.uploads[j(k)] ||= {parts:[]};op.uploads[j(k)].parts[b.chunk_index]=b.data_base64;return {transition_id:op.id,entry_key:k,chunk_index:b.chunk_index,source_etag:b.source_etag,chunk_sha256:b.chunk_sha256};}
      if(path.endsWith('/entries/seal')) {const u=op.uploads[j(b.entry_key)],bytes=u.parts.flatMap(p=>[...atob(p)].map(c=>c.charCodeAt(0)));u.raw=new TextDecoder().decode(Uint8Array.from(bytes));if(await Q.sha256(u.raw)!==b.ciphertext_sha256)throw Error('synthetic cipher digest');u.hash=b.ciphertext_sha256;u.etag=b.source_etag;return {sealed:true,ciphertext_sha256:u.hash};}
      if(path.endsWith('/staged')) {const u=op.uploads[j(key(b.kind,b.representation_id,b.slot))];return {...framed(u.raw,Number(b.chunk_index)),ciphertext_sha256:u.hash,source_etag:u.etag};}
      if(path.endsWith('/commit'))return publish(b);
      if(path.endsWith('/status')) {const r=result();if(op.version===2&&op.state==='committed')r.current_context={server_instance_id:scope.instance,...base,active_transition_id:null};return r;}
      throw Error('synthetic unsupported '+path);
    },
  };
};
