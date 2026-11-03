/* A revision-bound bridge; scoped saves never merge an unseen journal revision. */
(() => {
  'use strict';
  const copy=value=>structuredClone(value),object=value=>value&&typeof value==='object'&&!Array.isArray(value);
  function owned(value,owner,id){
    return object(value)&&!value.protection_record&&!value.protectionScope&&value.base?.crypto_epoch===0
      &&Array.isArray(value.revisions)&&Array.isArray(value.outbox)&&Array.isArray(value.receipts)
      &&[value.raw,value.draft].every(note=>object(note)&&note.owner_id===owner&&note.local_id===id
        &&['tree','daily','worklog'].includes(note.note_type)&&!String(note.source||'').startsWith('wiki')
        &&typeof note.content==='string'&&!note.content.startsWith('NOW_ENCRYPTED_'));
  }
  function eligible(root,account,id,next){
    try{
      const scope=JSON.parse(account),bucket=root?.contexts?.[account],before=bucket?.notes?.[id];
      return Array.isArray(scope)&&scope.length===2&&scope.every(value=>typeof value==='string')&&JSON.stringify(scope)===account
        &&root.schema_version===1&&Object.keys(root).sort().join(',')==='contexts,schema_version'
        &&object(bucket)&&Object.keys(bucket).join(',')==='notes'&&owned(before,scope[1],id)&&owned(next,scope[1],id);
    }catch{return false;}
  }
  function create({initial,revision=null,scoped=false,contextKey,full,note}){
    let base=initial,token=revision,allowed=scoped,bound=contextKey(),epoch=0,failed=false,tail=Promise.resolve();
    const error=()=>Error('저장 상태를 다시 열어 확인하세요. 자동으로 재전송하지 않았습니다.');
    function enqueue(guard,action){
      const generation=epoch,key=bound;
      const active=()=>generation===epoch&&key===contextKey()&&(!guard?.active||guard.active());
      const run=tail.catch(()=>{}).then(async()=>{
        if(failed||!active())throw error();
        try{await action(active);}catch(e){if(generation===epoch)failed=true;throw e;}
      });
      tail=run;return run;
    }
    async function persist(value,active,request){
      const result=await request({active});
      if(!active())throw Object.assign(error(),{committed:true});
      if(!result||!(result.revision===null||typeof result.revision==='string'))throw Object.assign(error(),{committed:true});
      base=value;token=result.revision;allowed=result.scoped===true;
    }
    return {
      reset(snapshot){epoch++;base=snapshot.value;token=snapshot.revision;allowed=snapshot.scoped===true;bound=contextKey();failed=false;},
      write(value,guard){const snapshot=copy(value);return enqueue(guard,active=>persist(snapshot,active,g=>full({expected:base,next:snapshot,revision:token},g)));},
      writeNote(ctx,id,value,guard){
        const account=JSON.stringify([String(ctx.url||'').replace(/\/+$/,''),String(ctx.owner||'')]),snapshot=copy(value);
        return enqueue(guard,async active=>{
          const bucket=base?.contexts?.[account],before=bucket?.notes?.[id];
          if(!before||snapshot?.draft?.owner_id!==ctx.owner||snapshot?.draft?.local_id!==id)throw error();
          const next={...base,contexts:{...base.contexts,[account]:{...bucket,notes:{...bucket.notes,[id]:snapshot}}}};
          if(allowed&&typeof token==='string'&&eligible(base,account,id,snapshot))
            await persist(next,active,g=>note({account,id,expected:before,next:snapshot,revision:token},g));
          else await persist(next,active,g=>full({expected:base,next,revision:token},g));
        });
      },
    };
  }
  globalThis.NowJournalWrites={create,eligible};
  if(typeof module!=='undefined'&&module.exports)module.exports=globalThis.NowJournalWrites;
})();
