import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

for (const surface of ['web','desktop/app']) {
  const source=await fs.readFile(new URL('../../'+surface+'/app.js',import.meta.url),'utf8');
  const slice=(from,to)=>{const start=source.indexOf(from),end=source.indexOf(to,start);assert(start>=0&&end>start);return source.slice(start,end);};
  const controller=slice('  noteHistoryController = {','\n  noteHistoryUI =');
  const project=slice('function noteHistoryProject(note) {','\nfunction noteHistoryAcceptRemote');
  const load=slice('async function loadServerSharedNotes(','\nasync function loadServerUserProfile');
  for (const suspended of [false,true]) {
    const ctx={owner:'qa',url:'https://qa.invalid',auth:'same-session',enabled:true,headers:{Authorization:'qa-only'}};
    const parent={id:'parent',title:'Parent',content:'Server parent',children:[],level:1};
    const child={owner_id:'qa',local_id:'child',parent_local_id:'parent',note_type:'tree',title:'Child',content:'Retained draft',level:2,tags:'[]'};
    let paused=suspended,hydrated=0,applied=0;
    const initial={schema_version:1,contexts:{}};
    const noop=()=>{};
    const box=vm.createContext({
      structuredClone,Set,Map,clearTimeout,
      state:{settings:{server:{ownerId:'qa',deviceId:'qa-device'}},data:{tree:[],deletedTree:[]},expandedTreeIds:new Set(),selectedDeletedTreeIds:new Set()},
      expected:null,noteHistoryController:null,noteHistoryAuthenticated:false,noteHistoryProjection:false,noteHistoryCaptureEpoch:0,
      noteHistoryRemoteCache:new Map(),noteHistoryTimers:new Map(),hostedWebSyncSuspended:false,
      libraryContext:()=>ctx,noteHistoryContext:()=>ctx,NowLibrary:{key:()=> 'qa'},NowNoteHistory:{key:()=> 'qa'},
      noteHistory:{suspended:()=>paused,hydrate:value=>{assert.equal(JSON.stringify(value),JSON.stringify(initial));paused=false;hydrated++;},
        entries:()=>({child:{draft:child}}),view:()=>({localOnly:false,base:{head_revision_id:'qa-head'},outbox:[]})},
      readStorage:async()=>structuredClone(initial),NOTE_HISTORY_KEY:'qa-history',elements:{},isEditorComposing:()=>false,
      isHostedWebClient:()=>true,prepareServerRequest:()=>true,normalizeOwnerId:x=>x,t:x=>x,
      renderServerStatus:noop,requestServerJson:async()=>({pulled_notes:[parent],server_time:'qa-time'}),
      defaultData:()=>({tree:[],deletedTree:[]}),
      applyPulledServerNotes:()=>{applied++;box.state.data.tree.push(structuredClone(parent));return {applied:1};},
      findTreeNode:(nodes,id)=>{for(const n of nodes){if(n.id===id)return n;const found=n.children?.find(c=>c.id===id);if(found)return found;}return null;},
      createNode:(title,content,parentId,level)=>({title,content,parentId,level,children:[]}),
      tagsFromServerNote:()=>[],isTreeNodeSharedForServer:()=>true,
      render:noop,markServerSyncedNotes:noop,setServerMessage:noop,persist:noop,persistSettings:noop,renderServerSettings:noop,
      libraryStore:null,libraryNotesContext:'',noteHistoryProjectionScope:'',
    });
    vm.runInContext(project+'\n'+controller+'\n'+load,box);
    await vm.runInContext('loadServerSharedNotes({replace:true})',box);
    assert.equal(applied,1);
    assert.equal(hydrated,suspended?1:0);
    assert.equal(box.state.data.tree.length,1);
    assert.equal(box.state.data.tree[0].content,parent.content);
    assert.equal(box.state.data.tree[0].children[0].content,child.content);
    assert.equal(box.state.data.tree[0].children[0].parentId,'parent');
    assert.equal(box.hostedWebSyncSuspended,false);
  }
}
console.log('History server-parent/local-child cold restore: both assets, active and suspended journals PASS');
