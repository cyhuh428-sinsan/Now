const {isDeepStrictEqual:same}=require("node:util");
const HISTORY_KEY="nownote.history.v1";
const object=value=>value!==null&&typeof value==="object"&&!Array.isArray(value);
const own=(value,key)=>Object.hasOwn(value,key);
const meaning=note=>Object.fromEntries(["note_type","title","content","parent_local_id","level","tags","source","deleted_at"].map(key=>[key,note[key]??(key==="level"?1:null)]));
const tags=value=>String(value||"").split(",").map(tag=>tag.trim()).filter(Boolean);

function historyState(store,id){
  if (["__proto__","prototype","constructor"].includes(id)) throw Error("Invalid Vault history ID");
  const server=store.values["nownote.web.settings.v1"]?.server||{};
  const scope={url:String(server.url||"").replace(/\/+$/,""),owner:String(server.ownerId||"local")};
  const key=JSON.stringify([scope.url,scope.owner]), history=store.values[HISTORY_KEY];
  if (history===undefined||history===null) return {history,scope,key,item:null};
  if (!object(history)||history.schema_version!==1||!object(history.contexts)
    || Object.values(history.contexts).some(bucket=>!object(bucket)||!object(bucket.notes))) throw Error("Unsupported Vault note history; original preserved");
  const bucket=history.contexts[key],item=bucket&&own(bucket.notes,id)?bucket.notes[id]:null;
  if (bucket?.legacy_pending) throw Error("Resolve existing note synchronization before Vault import");
  if (!item&&Object.entries(history.contexts).some(([account,b])=>account!==key&&own(b.notes,id))) throw Error("Vault note history belongs to another account");
  if (history.protection_operations!==undefined&&!object(history.protection_operations)) throw Error("Unsupported Vault protection journal");
  if (Object.values(history.protection_operations||{}).some(marker=>marker?.scope?.owner===scope.owner
    && String(marker.scope.url||"").replace(/\/+$/,"")===scope.url&&marker.scope.local_id===id&&marker.phase!=="complete"))
    throw Error("Vault note protection must finish first");
  if (item){
    if (item.protection_record||item.base?.crypto_epoch>0||String(item.draft?.content||"").startsWith("NOW_ENCRYPTED_V1:")) throw Error("Protected history cannot use ordinary Vault import");
    if (!object(item.raw)||!object(item.draft)||!object(item.base)||!Array.isArray(item.revisions)||!Array.isArray(item.outbox)||!Array.isArray(item.receipts)
      || [item.raw,item.draft].some(note=>note.owner_id!==scope.owner||note.local_id!==id||note.note_type!=="tree")) throw Error("Invalid Vault note history scope");
    if (item.conflict||bucket.legacy_pending) throw Error("Resolve existing note synchronization before Vault import");
  }
  return {history,scope,key,item};
}

function assertVaultHistorySource(store,id,local){
  const state=historyState(store,id),draft=state.item?.draft;
  if (draft&&local&&(draft.title!==local.title||draft.content!==local.body||draft.parent_local_id!==(local.parentId||null)
    || draft.level!==({topic:1,category:2,note:3}[local.kind]))) throw Error("Vault projection changed; reload history and compare again");
  return state;
}

function validateHistoryPatch(store,id,node,input){
  const state=historyState(store,id);
  if (!state.item&&!input) return null;
  if (!object(input)||Object.keys(input).some(key=>!["scope","local_id","expected","next"].includes(key))) throw Error("Vault import requires a prepared note history");
  const patch=structuredClone(input),next=patch.next,old=state.item;
  if (!same(patch.scope,state.scope)||patch.local_id!==id||!same(patch.expected,old)) throw Error("Vault history changed since comparison");
  if (!object(next)||next.protection_record||!object(next.raw)||!object(next.draft)||!object(next.base)
    || !Array.isArray(next.revisions)||!Array.isArray(next.outbox)||!Array.isArray(next.receipts)||typeof next.dirty!=="boolean"
    || next.base.crypto_epoch!==0) throw Error("Invalid Vault history candidate");
  for (const note of [next.raw,next.draft]) if (note.owner_id!==state.scope.owner||note.local_id!==id||note.note_type!=="tree") throw Error("Vault history candidate owner mismatch");
  const draft=next.draft;
  if (draft.title!==node.title||draft.content!==node.content||draft.parent_local_id!==(node.parentId||null)
    || draft.level!==node.level||draft.deleted_at!==null||!same(tags(draft.tags),node.tags||[])) throw Error("Vault history candidate differs from imported note");
  if (old){
    const mutable=new Set(["draft","dirty","edit_generation","revisions","outbox"]);
    if (Object.keys(next).some(key=>!own(old,key)&&key!=="edit_generation")||Object.keys(old).some(key=>!mutable.has(key)&&!same(old[key],next[key])))
      throw Error("Vault import must preserve original note history");
    for (const field of ["revisions","outbox"]) if (next[field].length<old[field].length||next[field].length>old[field].length+2
      ||!same(next[field].slice(0,old[field].length),old[field])) throw Error("Vault import must preserve pending history");
    if (next.revisions.length-old.revisions.length!==next.outbox.length-old.outbox.length) throw Error("Invalid Vault prior-draft preservation");
    const appended=next.revisions.slice(old.revisions.length);
    if (new Set(appended.map(revision=>revision.reason)).size!==appended.length) throw Error("Duplicate Vault import revision");
    for (let index=0;index<appended.length;index++){
      const revision=appended[index],op=next.outbox[old.outbox.length+index];
      const source=revision.reason==="before_external_import"?old.draft:revision.reason==="external_import"?draft:null;
      if (!source||!same(revision.snapshot?.note,source)
        ||op.revision_id!==revision.revision_id||op.sent!==false||op.body?.owner_id!==state.scope.owner||op.body?.local_id!==id
        ||!same(op.body?.note,meaning(source))) throw Error("Invalid Vault preserved draft");
    }
    const changed=new Set(["title","content","tags","client_updated_at"]);
    if (Object.keys(draft).some(key=>!changed.has(key)&&!same(draft[key],old.draft[key]))
      ||Object.keys(old.draft).some(key=>!changed.has(key)&&!same(draft[key],old.draft[key]))) throw Error("Vault import changed unrelated note fields");
  }else{
    const allowed=new Set(["raw","draft","base","revisions","outbox","receipts","conflict","dirty","localOnly","needsBaseline","replicaSelected"]);
    if (Object.keys(next).some(key=>!allowed.has(key))||!same(next.raw,draft)||next.revisions.length!==1||next.outbox.length!==1||next.receipts.length
      ||next.base.head_version!==0||next.base.head_revision_id!==null||!Array.isArray(next.base.inventory_revision_ids)||next.base.inventory_revision_ids.length)
      throw Error("Invalid new Vault history");
    if (next.revisions[0].reason!=="external_import"||!same(next.revisions[0].snapshot?.note,draft)
      ||next.outbox[0].revision_id!==next.revisions[0].revision_id||!same(next.outbox[0].body?.note,meaning(draft))) throw Error("Invalid new Vault import revision");
  }
  if ((!same(meaning(next.raw),meaning(draft))||next.outbox.length)&&!next.dirty) throw Error("Vault edit must remain pending");
  return {...state,next};
}

function applyVaultHistoryPatch(store,id,node,input){
  const prepared=validateHistoryPatch(store,id,node,input);
  if (!prepared) return;
  const history=store.values[HISTORY_KEY] ||= {schema_version:1,contexts:{}};
  const bucket=history.contexts[prepared.key] ||= {notes:{}};
  bucket.notes[id]=prepared.next;
}

module.exports={assertVaultHistorySource,validateHistoryPatch,applyVaultHistoryPatch};
