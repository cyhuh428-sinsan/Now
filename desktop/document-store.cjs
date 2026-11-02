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
  const rangeIds=(scope,id,prefix)=>db.prepare('SELECT id FROM documents WHERE scope=? AND (id=? OR instr(id,?)=1)').all(scope,id,prefix).map(row=>row.id).sort();
  const manifest=scope=>db.prepare('SELECT id,version FROM documents WHERE scope=?').all(scope).map(row=>[row.id,row.version]).sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:0);
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
    db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA secure_delete=ON;');
  }catch(error){
    if(initializing){try{db.exec('ROLLBACK');}catch{}}
    db.close();throw error;
  }
  let insert,update,advance,read,nextSeq,revision,exists,history,scan,remove;
  try{
    insert=db.prepare('INSERT INTO documents(scope,id,payload,version) VALUES(?,?,?,1) ON CONFLICT(scope,id) DO NOTHING');
    update=db.prepare('UPDATE documents SET payload=?,version=version+1 WHERE scope=? AND id=? AND version=?');
    advance=db.prepare('UPDATE documents SET version=version+1 WHERE scope=? AND id=? AND version=?');
    read=db.prepare('SELECT payload,version FROM documents WHERE scope=? AND id=?');
    scan=db.prepare('SELECT id,payload,version FROM documents WHERE scope=? ORDER BY id');
    remove=db.prepare('DELETE FROM documents WHERE scope=? AND id=? AND version=?');
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
    scan(scope){
      identity(scope,'scan');
      return scan.all(scope).map(row=>({id:row.id,version:row.version,value:JSON.parse(row.payload)}));
    },
    dataVersion(){return db.prepare('PRAGMA data_version').get().data_version;},
    hasScope(scope){identity(scope,'scope');return Boolean(db.prepare('SELECT 1 FROM documents WHERE scope=? LIMIT 1').get(scope));},
    snapshot(read){
      db.exec('BEGIN');
      try{
        const result=read();
        if(result&&typeof result.then==='function')throw Error('A synchronous document read is required');
        return result;
      }finally{db.exec('ROLLBACK');}
    },
    commit(changes,{checks=[],ranges=[],manifests=[]}={}){
      if(!Array.isArray(changes)||!Array.isArray(checks)||!Array.isArray(ranges)||!changes.length&&!checks.length)throw Error('A nonempty document transaction is required');
      for(const check of checks){identity(check.scope,check.id);if(!Number.isSafeInteger(check.version)||check.version<1)throw Error('Invalid document check');}
      for(const range of ranges){identity(range.scope,range.id);if(typeof range.prefix!=='string'||!range.prefix||!Array.isArray(range.ids))throw Error('Invalid document range');}
      if(!Array.isArray(manifests))throw Error('Invalid document manifest');
      for(const item of manifests){identity(item.scope,'manifest');if(!Array.isArray(item.rows))throw Error('Invalid document manifest');}
      const encoded=changes.map(change=>{
        identity(change.scope,change.id);
        if(!['put','append','remove'].includes(change.kind)||!Number.isSafeInteger(change.expectedVersion)||change.expectedVersion<0)throw Error('Invalid document transaction');
        if(change.kind==='append'&&(typeof change.revisionId!=='string'||!change.revisionId))throw Error('Revision id is required');
        return change.kind==='remove'?null:json(change.value);
      });
      db.exec('BEGIN IMMEDIATE');
      let committed=false;
      try{
        for(const item of manifests)if(JSON.stringify(manifest(item.scope))!==JSON.stringify(item.rows))throw Error('Document journal changed; reopen before saving');
        for(const check of checks){
          const row=read.get(check.scope,check.id);
          if(!row||row.version!==check.version||row.payload!==json(check.value))throw Error('Document version conflict');
        }
        for(const range of ranges)if(JSON.stringify(rangeIds(range.scope,range.id,range.prefix))!==JSON.stringify(range.ids))throw Error('Document parts conflict');
        const versions=changes.map((change,index)=>{
          const {scope,id,expectedVersion}=change;
          if(change.kind==='put'){
            const result=expectedVersion===0?insert.run(scope,id,encoded[index]):update.run(encoded[index],scope,id,expectedVersion);
            if(result.changes!==1)throw Error('Document version conflict');
          }else if(change.kind==='remove'){
            if(remove.run(scope,id,expectedVersion).changes!==1)throw Error('Document version conflict');
          }else{
            if(exists.get(scope,id,change.revisionId))throw Error('Revision already exists');
            if(advance.run(scope,id,expectedVersion).changes!==1)throw Error('Document version conflict');
            revision.run(scope,id,change.revisionId,nextSeq.get(scope,id).seq,encoded[index]);
          }
          return expectedVersion+1;
        });
        db.exec('COMMIT');committed=true;
        const checkpoint=db.prepare('PRAGMA wal_checkpoint(TRUNCATE)').get();
        if(checkpoint.busy!==0)throw Error('Document commit persisted, but storage cleanup is pending. Reopen to verify before completing protection.');
        return versions;
      }catch(error){if(!committed)db.exec('ROLLBACK');else error.committed=true;throw error;}
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
