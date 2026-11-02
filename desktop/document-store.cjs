const {DatabaseSync}=require('node:sqlite');
const SCHEMA=[
  'CREATE TABLE documents(scope TEXT NOT NULL,id TEXT NOT NULL,payload TEXT NOT NULL,version INTEGER NOT NULL CHECK(version>0),PRIMARY KEY(scope,id))',
  'CREATE TABLE revisions(scope TEXT NOT NULL,id TEXT NOT NULL,revision_id TEXT NOT NULL,seq INTEGER NOT NULL,payload TEXT NOT NULL,PRIMARY KEY(scope,id,revision_id),UNIQUE(scope,id,seq),FOREIGN KEY(scope,id) REFERENCES documents(scope,id))',
];
const canonicalSchema=sql=>sql.replace(/\s+/g,' ').replace(/\s*([(),])\s*/g,'$1').trim();

function identity(scope,id){
  if(typeof scope!=='string'||!scope||typeof id!=='string'||!id)throw Error('Document scope and id are required');
}
function json(value){
  const encoded=JSON.stringify(value);
  if(encoded===undefined)throw Error('Document value must be JSON');
  return encoded;
}
function createDocumentStore(filename){
  const db=new DatabaseSync(filename);
  let closed=false,initializing=false;
  try{
    db.exec('PRAGMA busy_timeout=2000; PRAGMA foreign_keys=ON;');
    db.exec('BEGIN IMMEDIATE');initializing=true;
    const version=db.prepare('PRAGMA user_version').get().user_version;
    if(version!==0&&version!==1)throw Error('Unsupported document store version');
    if(version===0){
      if(db.prepare("SELECT name FROM sqlite_master WHERE substr(name,1,7) != 'sqlite_'").all().length)throw Error('Existing database schema is not an empty NowNote document store');
      db.exec(SCHEMA.join(';')+';PRAGMA user_version=1;');
    }
    const schema=db.prepare("SELECT sql FROM sqlite_master WHERE substr(name,1,7) != 'sqlite_' AND type IN ('table','index','view','trigger') ORDER BY name").all();
    if(schema.length!==SCHEMA.length||schema.some((row,index)=>canonicalSchema(row.sql)!==canonicalSchema(SCHEMA[index])))throw Error('Unsupported document store schema');
    db.exec('COMMIT');initializing=false;
    db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;');
  }catch(error){
    if(initializing){try{db.exec('ROLLBACK');}catch{}}
    db.close();throw error;
  }
  let insert,update,advance,read,nextSeq,revision,exists,history;
  try{
    insert=db.prepare('INSERT INTO documents(scope,id,payload,version) VALUES(?,?,?,1) ON CONFLICT(scope,id) DO NOTHING');
    update=db.prepare('UPDATE documents SET payload=?,version=version+1 WHERE scope=? AND id=? AND version=?');
    advance=db.prepare('UPDATE documents SET version=version+1 WHERE scope=? AND id=? AND version=?');
    read=db.prepare('SELECT payload,version FROM documents WHERE scope=? AND id=?');
    nextSeq=db.prepare('SELECT COALESCE(MAX(seq),0)+1 AS seq FROM revisions WHERE scope=? AND id=?');
    revision=db.prepare('INSERT INTO revisions(scope,id,revision_id,seq,payload) VALUES(?,?,?,?,?)');
    exists=db.prepare('SELECT 1 FROM revisions WHERE scope=? AND id=? AND revision_id=?');
    history=db.prepare('SELECT revision_id,seq,payload FROM revisions WHERE scope=? AND id=? AND seq<? ORDER BY seq DESC LIMIT ?');
  }catch(error){db.close();throw error;}
  return {
    read(scope,id){
      identity(scope,id);const row=read.get(scope,id);
      return row?{version:row.version,value:JSON.parse(row.payload)}:null;
    },
    commit(changes){
      if(!Array.isArray(changes)||changes.length===0)throw Error('A nonempty document transaction is required');
      const encoded=changes.map(change=>{
        identity(change.scope,change.id);
        if(!['put','append'].includes(change.kind)||!Number.isSafeInteger(change.expectedVersion)||change.expectedVersion<0)throw Error('Invalid document transaction');
        if(change.kind==='append'&&(typeof change.revisionId!=='string'||!change.revisionId))throw Error('Revision id is required');
        return json(change.value);
      });
      db.exec('BEGIN IMMEDIATE');
      try{
        const versions=changes.map((change,index)=>{
          const {scope,id,expectedVersion}=change;
          if(change.kind==='put'){
            const result=expectedVersion===0?insert.run(scope,id,encoded[index]):update.run(encoded[index],scope,id,expectedVersion);
            if(result.changes!==1)throw Error('Document version conflict');
          }else{
            if(exists.get(scope,id,change.revisionId))throw Error('Revision already exists');
            if(advance.run(scope,id,expectedVersion).changes!==1)throw Error('Document version conflict');
            revision.run(scope,id,change.revisionId,nextSeq.get(scope,id).seq,encoded[index]);
          }
          return expectedVersion+1;
        });
        db.exec('COMMIT');return versions;
      }catch(error){db.exec('ROLLBACK');throw error;}
    },
    history(scope,id,{limit=30,before=Number.MAX_SAFE_INTEGER}={}){
      identity(scope,id);
      if(!Number.isInteger(limit)||limit<1||limit>100)throw Error('History limit must be between 1 and 100');
      if(!Number.isSafeInteger(before)||before<1)throw Error('History cursor is invalid');
      const rows=history.all(scope,id,before,limit+1),page=rows.slice(0,limit);
      return {items:page.map(row=>({revisionId:row.revision_id,sequence:row.seq,value:JSON.parse(row.payload)})),
        nextCursor:rows.length>limit?page.at(-1).seq:null};
    },
    close(){if(!closed){db.close();closed=true;}},
  };
}
module.exports={createDocumentStore};
