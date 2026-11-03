const {randomUUID}=require('node:crypto');
const file=require('./document-file.cjs');
const policy=require('./app/journal-writes.js');
const KEY='nownote.history.v1',same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function createHistorySession(filename){
  const sessions=new WeakMap();
  function remember(sender,snapshot){const state={...snapshot,revision:randomUUID()};sessions.set(sender,state);return state;}
  function current(sender,revision){const state=sessions.get(sender);if(!state||state.revision!==revision)throw Error('저장 기준을 다시 열어 확인하세요.');return state;}
  return {
    createWindow(sender,{account,id,stamp,next}){
      const result=file.createKeyWindow(filename(),KEY,{account,id,stamp,next});
      const value={schema_version:1,contexts:{[account]:{notes:{[id]:structuredClone(next)}}}};
      const window={projection:'journal_window_v1',offsets:{revisions:0,receipts:0,completed_outbox:0,archived_outbox:0}};
      const saved=remember(sender,{value,manifest:result.manifest,stamp:result.stamp,selected:{account,id,window}});
      return {revision:saved.revision,stamp:saved.stamp,scoped:true};
    },
    selectWindow(sender,{account,id,stamp}){
      const snapshot=file.readKeyWindow(filename(),KEY,{account,id,stamp}),entry=snapshot.window.entry;
      const value={schema_version:1,contexts:{[account]:{notes:{[id]:entry}}}};
      if(!policy.eligible(value,account,id,entry))throw Error('선택 메모 보호 상태를 확인하세요.');
      const window={projection:snapshot.window.projection,offsets:snapshot.window.offsets};
      const saved=remember(sender,{value,manifest:snapshot.manifest,stamp:snapshot.stamp,selected:{account,id,window}});
      return {entry:structuredClone(entry),window:structuredClone(window),revision:saved.revision,stamp:saved.stamp,scoped:true};
    },
    noteWindow(sender,{revision,account,id,expected,next}){
      const state=current(sender,revision),selection=state.selected,before=state.value?.contexts?.[account]?.notes?.[id];
      if(!selection?.window||selection.account!==account||selection.id!==id||!same(before,expected)||!policy.eligible(state.value,account,id,next))
        throw Error('부분 이력 선택 기준을 확인하세요.');
      try{
        const window={...selection.window,account,id,entry:before};
        const result=file.writeKeyWindow(filename(),KEY,{account,id,expected:window,next},state.manifest);
        const value={schema_version:1,contexts:{[account]:{notes:{[id]:structuredClone(next)}}}};
        const saved=remember(sender,{value,manifest:result.manifest,stamp:result.stamp,selected:selection});
        return {revision:saved.revision,stamp:saved.stamp,scoped:true};
      }catch(error){sessions.delete(sender);throw error;}
    },
    page(_sender,request){return file.readKeyHistoryPage(filename(),KEY,request);},
    select(sender,{account,id,stamp}){
      const snapshot=file.readKeyNote(filename(),KEY,account,id,stamp);
      const value={schema_version:1,contexts:{[account]:{notes:{[id]:snapshot.entry}}}};
      if(!policy.eligible(value,account,id,snapshot.entry))throw Error('선택 메모 보호 상태를 확인하세요.');
      const saved=remember(sender,{value,manifest:snapshot.manifest,stamp:snapshot.stamp,selected:{account,id}});
      return {entry:structuredClone(snapshot.entry),revision:saved.revision,stamp:saved.stamp,scoped:true};
    },
    current(_sender,account){return file.readKeyCurrent(filename(),KEY,account);},
    open(sender){const snapshot=remember(sender,file.readKeySnapshot(filename(),KEY));return {value:structuredClone(snapshot.value),revision:snapshot.revision,stamp:snapshot.stamp,scoped:true};},
    full(sender,{revision,next}){
      const state=current(sender,revision);let committed=false;
      if(state.selected)throw Error('선택 세션으로 전체 원장을 저장할 수 없습니다.');
      try{
        file.writeKey(filename(),KEY,next,state.value);committed=true;
        const snapshot=file.readKeySnapshot(filename(),KEY);
        if(!same(snapshot.value,next))throw Error('저장 뒤 원장 변경을 확인했습니다. 다시 여세요.');
        const saved=remember(sender,snapshot);return {revision:saved.revision,stamp:saved.stamp,scoped:true};
      }catch(error){sessions.delete(sender);if(committed)error.committed=true;throw error;}
    },
    note(sender,{revision,account,id,expected,next}){
      const state=current(sender,revision),before=state.value?.contexts?.[account]?.notes?.[id];
      if(state.selected?.window)throw Error('부분 이력을 전체 메모로 교체할 수 없습니다.');
      if(state.selected&&(state.selected.account!==account||state.selected.id!==id))throw Error('선택 메모가 다릅니다.');
      if(!same(before,expected)||!policy.eligible(state.value,account,id,next))throw Error('전체 저장 또는 보호 상태 기준을 확인하세요.');
      try{
        const result=file.writeKeyPath(filename(),KEY,['contexts',account,'notes',id],before,next,state.manifest);
        const bucket=state.value.contexts[account],value={...state.value,contexts:{...state.value.contexts,[account]:{...bucket,notes:{...bucket.notes,[id]:structuredClone(next)}}}};
        const saved=remember(sender,{value,manifest:result.manifest,stamp:result.stamp,selected:state.selected});return {revision:saved.revision,stamp:saved.stamp,scoped:true};
      }catch(error){sessions.delete(sender);throw error;}
    },
  };
}
module.exports={createHistorySession};
