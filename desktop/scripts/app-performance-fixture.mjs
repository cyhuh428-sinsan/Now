import {randomUUID} from 'node:crypto';

export function makeFixture(mib){
  if(![1,8,16].includes(mib))throw Error('Unsupported synthetic fixture size');
  const owner='local_user',account=JSON.stringify(['',owner]),time='2026-11-03T00:00:00.000Z',notes={},tree=[];
  const ballast='Synthetic historical payload. '.repeat(Math.ceil(mib*1024*1024/100/30)).slice(0,Math.floor(mib*1024*1024/100));
  for(let index=0;index<20;index++){
    const id='perf-'+index,title='Synthetic memo '+index,content='Current synthetic document '+index+'\n'+'small current line\n'.repeat(20);
    const note={owner_id:owner,local_id:id,note_type:'tree',source:'web-tree',title,content,parent_local_id:null,level:1,tags:'',deleted_at:null};
    let previous=null;const revisions=[];
    for(let revision=0;revision<6;revision++){
      const revision_id=randomUUID();revisions.push({revision_id,parent_ref:previous?{kind:'offline_branch',id:previous}:null,
        snapshot:{schema_version:1,note:{...note,content:revision===5?content:'History '+index+'/'+revision+'\n'+ballast}},reason:'edit',created_at:time,imported:false});previous=revision_id;
    }
    notes[id]={raw:{...note},draft:{...note},base:{head_version:0,head_revision_id:null,inventory_revision_ids:[],crypto_epoch:0,replica_count:0},
      revisions,outbox:[],receipts:[],conflict:null,dirty:false,localOnly:true,needsBaseline:false,replicaSelected:true};
    tree.push({id,title,content,children:[],parentId:null,level:1,status:'active',syncState:'synced',shared:true,serverShared:false,groupSharedReadOnly:false,
      remoteOwnerId:'',remoteLocalId:'',unsharedAt:null,favorite:false,tags:[],properties:{},createdAt:time,updatedAt:time});
  }
  return {version:1,updatedAt:time,values:{'nownote.web.v1':{daily:{},worklogs:{},archivedDaily:[],deletedTree:[],canvases:[],captures:[],snapshots:[],importReports:[],publishBundles:[],tree},
    'nownote.web.settings.v1':{language:'ko',theme:'dark',server:{mode:'local',url:'',ownerId:owner,deviceId:'web-desktop',autoSync:false},openTreeTabs:['perf-0']},
    'nownote.history.v1':{schema_version:1,contexts:{[account]:{notes}}}}};
}
