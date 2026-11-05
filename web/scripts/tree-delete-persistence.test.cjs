const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

for(const surface of ['web','desktop/app']){
  const source=fs.readFileSync(path.resolve(__dirname,'../../'+surface+'/app.js'),'utf8');
  function fixture({cancel=false,children=false,readOnly=false,deferred=true}={}){
    const note={id:'selected',title:'QA delete',content:'preserve body',children:children?[{id:'child'}]:[]};
    let handler,captures=0,wholeWrites=0,schedules=0,archived=0;
    const box=vm.createContext({
      elements:{deleteTreeBtn:{addEventListener:(_event,fn)=>handler=fn}},
      state:{selectedTreeId:note.id,data:{tree:[note]}},
      getSelectedTreeNode:()=>note,isReadOnlyTreeNode:()=>readOnly,
      showNotice:()=>{},t:x=>x,noteTitle:x=>x,confirmAction:async()=>!cancel,
      archiveDeletedTreeNode:()=>{archived++;return true;},
      noteHistoryCaptureDrafts:()=>captures++,noteHistoryEnrolling:new Set(),
      noteHistory:{deferred:()=>deferred,selectable:id=>id===note.id},
      isHostedWebClient:()=>false,STORAGE_KEY:'data',writeStorage:()=>wholeWrites++,
      scheduleServerSync:()=>schedules++,renderTree:()=>{},renderDeletedTreeButton:()=>{},
    });
    const start=source.indexOf('function persist({journalId=null}={})');
    vm.runInContext(source.slice(start,source.indexOf('\nfunction scheduleServerSync(',start)),box);
    const at=source.indexOf('  elements.deleteTreeBtn.addEventListener(');
    vm.runInContext(source.slice(at,source.indexOf('\n  elements.deletedTreeBtn.addEventListener',at)),box);
    return {run:()=>handler(),stats:()=>({captures,wholeWrites,schedules,archived,selected:box.state.selectedTreeId})};
  }
  test(surface+': managed deletion captures its tombstone without whole-journal persistence',async()=>{
    const f=fixture();await f.run();
    assert.deepEqual(f.stats(),{captures:1,wholeWrites:0,schedules:1,archived:1,selected:null});
  });
  test(surface+': legacy deletion retains the normal durable save path',async()=>{
    const f=fixture({deferred:false});await f.run();assert.equal(f.stats().wholeWrites,1);
  });
  test(surface+': cancellation, children and readonly cannot archive or save',async()=>{
    for(const options of [{cancel:true},{children:true},{readOnly:true}]){
      const f=fixture(options);await f.run();assert.equal(f.stats().archived,0);assert.equal(f.stats().captures,0);
    }
  });
  for(const localOnly of [true,false])test(surface+': local deletion is distinct from server unsharing ('+localOnly+')',()=>{
    const node={id:'selected',title:'QA',content:'preserve body',children:[],status:'active',shared:false};
    const tree=[node],deletedTree=[];
    const box=vm.createContext({state:{data:{tree,deletedTree}},
      noteHistoryContext:()=>({owner:'alice'}),noteHistory:{currentView:()=>({localOnly})},
      findTreeNode:()=>tree[0],isTreeNodeSharedForServer:()=>false,
      detachTreeNode:()=>tree.splice(0,1),
    });
    const start=source.indexOf('function noteHistoryProject(');
    vm.runInContext(source.slice(start,source.indexOf('\nfunction noteHistoryAcceptRemote(',start)),box);
    box.noteHistoryProject({owner_id:'alice',local_id:node.id,note_type:'tree',deleted_at:'2026-11-05T00:00:00Z'});
    assert.equal(tree.length,localOnly?0:1);
    assert.equal(deletedTree.length,localOnly?1:0);
    if(localOnly){assert.equal(deletedTree[0].content,node.content);assert.equal(deletedTree[0].status,'deleted');}
  });
  test(surface+': restoring a managed archived note also avoids the full journal',()=>{
    const node={id:'selected',content:'preserve body',children:[],deletedAt:'2026-11-05T00:00:00Z'};
    let wholeWrites=0,captures=0;
    const box=vm.createContext({state:{data:{deletedTree:[node],tree:[]},selectedDeletedTreeIds:new Set(),expandedTreeIds:new Set()},
      findTreeNode:()=>null,render:()=>{},renderDeletedTreeList:()=>{},
      noteHistoryCaptureDrafts:()=>captures++,noteHistoryEnrolling:new Set(),noteHistory:{deferred:()=>true,selectable:id=>id===node.id},
      scheduleServerSync:()=>{},isHostedWebClient:()=>false,STORAGE_KEY:'data',writeStorage:()=>wholeWrites++});
    for(const [startName,endName] of [['function persist({journalId=null}={})','\nfunction scheduleServerSync('],['function restoreDeletedTreeNode(','\nasync function permanentlyDeleteTreeNode(']]){
      const start=source.indexOf(startName);vm.runInContext(source.slice(start,source.indexOf(endName,start)),box);
    }
    box.restoreDeletedTreeNode(node.id);assert.equal(wholeWrites,0);assert.equal(captures,1);
    assert.equal(box.state.data.tree[0].content,node.content);assert.equal(box.state.data.deletedTree.length,0);
  });
}
