/* Local proposal IDs remain independent archives; the journal owns resumable progress. */
(() => {
  const prefix='wiki-protection-group:',uuid='[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}';
  const wiki=new RegExp('^wiki:('+uuid+')$'),alias=new RegExp('^wiki-proposal:'+uuid+':('+uuid+')$');
  const P=()=>globalThis.NowNoteProtectionProtocol,S=()=>globalThis.NowNoteProtectionState,copy=structuredClone;
  const eq=(a,b)=>P().canonicalJson(a)===P().canonicalJson(b);
  const check=(value,code='wiki_group_binding')=>{if(!value)throw Error(code);};
  function targetOf(marker){
    if(marker?.phase!=='wiki_group_applying'||typeof marker.scope?.local_id!=='string')return null;
    const id=marker.scope.local_id.slice(prefix.length);
    return marker.scope.local_id.startsWith(prefix)&&new RegExp('^'+uuid+'$').test(id)?'wiki:'+id:null;
  }
  const proposalTarget=id=>typeof id==='string'&&alias.test(id)?'wiki:'+alias.exec(id)[1]:null;
  const relatedTarget=id=>typeof id==='string'&&id.startsWith(prefix)&&new RegExp('^'+uuid+'$').test(id.slice(prefix.length))?'wiki:'+id.slice(prefix.length):proposalTarget(id);
  const blockedTarget=marker=>marker?.phase!=='complete'?(targetOf(marker)||proposalTarget(marker?.scope?.local_id)):null;
  function create(api){
    function action(scope){
      S().validateScope(scope);check(wiki.test(scope.local_id));
      const ctx=copy(api.context()),key=api.contextKey(),h=api.history();
      const active=()=>{const now=api.context();check(h===api.history()&&key===api.contextKey()&&now.enabled&&now.owner===scope.owner
        &&String(now.url).replace(/\/+$/,'')===scope.url.replace(/\/+$/,'')&&now.device===scope.device
        &&(now.instance===undefined||now.instance===scope.instance),'wiki_group_context_changed');};
      active();return {scope:copy(scope),ctx,h,active};
    }
    const groupScope=scope=>({...copy(scope),local_id:prefix+scope.local_id.slice(5)});
    function pending(scope){
      const a=action(scope),rows=Object.values(a.h.protectionOperations()).filter(m=>targetOf(m)===scope.local_id
        &&m.scope.owner===scope.owner&&m.scope.url.replace(/\/+$/,'')===scope.url.replace(/\/+$/,''));
      check(rows.length<=1,'wiki_group_ambiguous');
      if(rows[0])check(eq(rows[0].scope,groupScope(scope)),'wiki_group_context_changed');
      return rows[0]?copy(rows[0]):null;
    }
    function normalized(value,scope){
      const result=copy(value);
      if(result.protectionScope){check(eq(result.protectionScope,scope));delete result.protectionScope;}
      return result;
    }
    async function snapshot(a){
      const stores=api.stores(),roots=[],members=new Map(),account=JSON.stringify([a.scope.url.replace(/\/+$/,''),a.scope.owner]);
      check(new Set(stores.map(s=>s.name)).size===stores.length);
      for(const store of stores){
        const root=await store.read();a.active();roots.push(root);const seen=new WeakSet();
        async function walk(value,path){
          if(!value||typeof value!=='object'||seen.has(value))return;seen.add(value);
          if(value.contexts){
            const notes=value.contexts[account]?.notes;
            for(const [id,item]of Object.entries(notes||{})){
              if(alias.exec(id)?.[1]!==a.scope.local_id.slice(5))continue;
              check(value.schema_version===1&&item&&typeof item==='object');
              let scope=await globalThis.NowNoteWiki.localProtectionScope(a.ctx,id);a.active();
              const encrypted=S().protectedRecord(item);
              if(encrypted){
                const saved=item.protection_record.scope;
                check(saved.owner===scope.owner&&saved.url===scope.url&&saved.instance===scope.instance&&saved.local_id===scope.local_id);
                scope=copy(saved);
              }
              else for(const note of [item.raw,item.draft,...(item.revisions||[]).map(r=>r.snapshot?.note)]){
                check(note?.owner_id===a.scope.owner&&note.local_id===id&&note.source==='wiki-ingest-proposal');
                const doc=await globalThis.NowNoteWiki.validateDocument(note.content,a.ctx);a.active();check('wiki:'+doc.wiki_id===a.scope.local_id);
              }
              const member=members.get(id)||{id,scope,copies:[]};members.set(id,member);
              member.copies.push({store:store.name,path:[...path,'contexts',account,'notes',id],kind:encrypted?'cipher':'plain',
                hash:await P().hashJson(encrypted?item.protection_record:normalized(item,scope))});a.active();
            }
            for(const [n,archive]of (value.recovery_archives||[]).entries())await walk(archive,[...path,'recovery_archives',n]);
            return;
          }
          for(const [key,child]of Object.entries(value))if(key!=='protection_operations')await walk(child,[...path,key]);
        }
        await walk(root,[]);a.active();
      }
      const list=[...members.values()].sort((a,b)=>a.id<b.id?-1:1);
      check(list.length<=1000,'wiki_group_limit');
      return {stores,roots,members:list};
    }
    async function plan(scope){
      const a=action(scope),current=await snapshot(a);a.active();
      const existing=pending(scope),value={schema_version:1,target_scope:copy(scope),members:current.members};
      if(current.members.length||existing){
        check(typeof api.targetStamp==='function','wiki_group_target_status_required');
        value.target_stamp=await api.targetStamp(scope);a.active();
      }
      return {...value,plan_hash:await P().hashJson(value),pending:existing};
    }
    const at=(root,path)=>path.reduce((value,key)=>value?.[key],root);
    async function validateCopies(a,expected,password,resolveKey,requireCipher=false){
      const current=await snapshot(a);a.active();
      check(eq(current.members.map(m=>m.id),expected.members.map(m=>m.id)),'wiki_group_members_changed');
      for(const member of expected.members){
        const live=current.members.find(m=>m.id===member.id);check(eq(live.scope,member.scope));
        check(eq(live.copies.map(c=>[c.store,c.path]),member.copies.map(c=>[c.store,c.path])),'wiki_group_copies_changed');
        for(const original of member.copies){
          const storeIndex=current.stores.findIndex(s=>s.name===original.store),item=at(current.roots[storeIndex],original.path);
          if(!S().protectedRecord(item)){
            check(!requireCipher&&original.kind==='plain'&&await P().hashJson(normalized(item,member.scope))===original.hash,'wiki_group_copy_changed');a.active();continue;
          }
          const record=item.protection_record;
          if(original.kind==='cipher')check(await P().hashJson(record)===original.hash,'wiki_group_copy_changed');a.active();
          let text;
          try{text=await P().decryptContent(record.ciphertext,password);}catch(error){
            if(!resolveKey)throw error;
            text=await P().decryptContent(record.ciphertext,await resolveKey({representation_epoch:'local:'+record.operation_id,operation_id:record.operation_id,output:false}));
          }a.active();
          const archive=P().parseJson(text);check(archive.schema_version===1&&archive.operation_id===record.operation_id&&eq(archive.scope,member.scope));
          if(original.kind==='plain')check(await P().hashJson(normalized(archive.value,member.scope))===original.hash,'wiki_group_archive_changed');a.active();
        }
      }
      return current;
    }
    async function run(scope,password,confirmedHash,executeTarget,resolveKey){
      const a=action(scope);check(typeof password==='string'&&password.length>0,'wiki_group_key_required');
      let marker=pending(scope),bundle;
      const persist=async()=>{
        marker.cipher_bundle=await P().encryptContent(JSON.stringify(bundle),password);a.active();
        await a.h.saveProtection(marker,{active:()=>{a.active();return true;}});a.active();
      };
      if(marker){
        bundle=P().parseJson(await P().decryptContent(marker.cipher_bundle,password));a.active();
        check(bundle.schema_version===1&&bundle.purpose==='wiki_proposal_group'&&bundle.operation_id===marker.id
          &&eq(bundle.scope,marker.scope)&&eq(bundle.plan.target_scope,scope)&&Array.isArray(bundle.stores)&&bundle.stores.length===0);
      }else{
        check(!Object.values(a.h.protectionOperations()).some(m=>S().scopeKey(m.scope)===S().scopeKey(scope)
          &&!['complete','analysis_settled'].includes(m.phase)),'wiki_group_existing_operation');
        const value=await plan(scope);a.active();check(value.members.length&&value.plan_hash===confirmedHash,'wiki_group_confirmation_required');
        const current=await snapshot(a);a.active();
        check(eq(current.members,value.members),'wiki_group_copy_changed');
        await api.verify(current.roots,scope,scope.local_id,{proposalIds:value.members.map(m=>m.id)});a.active();
        const repeated=await snapshot(a);a.active();check(eq(repeated.members,value.members),'wiki_group_copy_changed');
        check(eq(await api.targetStamp(scope),value.target_stamp),'wiki_group_target_changed');a.active();
        marker={schema_version:1,id:crypto.randomUUID(),scope:groupScope(scope),phase:'wiki_group_applying',cipher_bundle:''};
        bundle={schema_version:1,purpose:'wiki_proposal_group',operation_id:marker.id,scope:copy(marker.scope),stores:[],
          plan:{schema_version:1,target_scope:copy(scope),members:copy(value.members),target_stamp:copy(value.target_stamp)},
          excluded_target_ids:Object.values(a.h.protectionOperations()).filter(m=>S().scopeKey(m.scope)===S().scopeKey(scope)).map(m=>m.id),target_operation_id:null};
        await persist();
      }
      await validateCopies(a,bundle.plan,password,resolveKey);
      for(const member of bundle.plan.members){
        let current=await validateCopies(a,bundle.plan,password,resolveKey);a.active();
        const live=current.members.find(m=>m.id===member.id);
        if(live.copies.every(c=>c.kind==='cipher'))continue;
        const context=()=>{a.active();return {...api.context(),instance:member.scope.instance,local_id:member.id};};
        const client=globalThis.NowNoteProtectionClient.create({context,stores:api.stores});
        const copies=await client.copies(member.scope);a.active();
        await client.confirm(member.scope,copies,copies.map(c=>c.id));a.active();
        const controller=S().create({context,journal:a.h,stores:api.stores,
          remote:new Proxy({},{get:()=>()=>{throw Error('wiki_group_alias_network_forbidden');}}),
          preflight:async()=>{await validateCopies(a,bundle.plan,password,resolveKey);a.active();}});
        const old=Object.values(a.h.protectionOperations()).filter(m=>S().scopeKey(m.scope)===S().scopeKey(member.scope)&&m.phase!=='complete');
        check(old.length<=1,'wiki_group_alias_ambiguous');
        const id=old[0]?.id||await controller.startLocalWiki(member.scope,password,resolveKey);a.active();
        await controller.resume(id,password,undefined,resolveKey);a.active();check(controller.status(id).phase==='complete');
      }
      await validateCopies(a,bundle.plan,password,resolveKey,true);a.active();
      const candidates=Object.values(a.h.protectionOperations()).filter(m=>S().scopeKey(m.scope)===S().scopeKey(scope)&&!bundle.excluded_target_ids.includes(m.id));
      check(candidates.length<=1,'wiki_group_target_ambiguous');
      if(!candidates.length){
        check(bundle.plan.target_stamp!==undefined,'wiki_group_target_unverifiable');
        check(eq(await api.targetStamp(scope),bundle.plan.target_stamp),'wiki_group_target_changed');a.active();
      }
      if(candidates[0]){
        const original=P().parseJson(await P().decryptContent(candidates[0].cipher_bundle,password));a.active();
        check(original.operation_id===candidates[0].id&&eq(original.scope,scope)
          &&['conversion','local_wiki_protection'].includes(original.intent?.purpose),'wiki_group_target_kind');
      }
      const result=await executeTarget(candidates[0]?copy(candidates[0]):null);a.active();
      const completed=a.h.protectionOperations()[result?.operation_id];
      check(completed?.phase==='complete'&&S().scopeKey(completed.scope)===S().scopeKey(scope)
        &&!bundle.excluded_target_ids.includes(completed.id),'wiki_group_target_unconfirmed');
      const targetBundle=P().parseJson(await P().decryptContent(completed.cipher_bundle,password));a.active();
      check(targetBundle.schema_version===1&&targetBundle.operation_id===completed.id&&eq(targetBundle.scope,scope)
        &&['conversion','local_wiki_protection'].includes(targetBundle.intent?.purpose)&&eq(targetBundle.receipt,result.receipt),'wiki_group_target_receipt');
      await validateCopies(a,bundle.plan,password,resolveKey,true);a.active();
      bundle.target_operation_id=completed.id;marker.phase='complete';await persist();return copy(result);
    }
    return {plan,pending,run};
  }
  globalThis.NowWikiProtectionGroup=Object.freeze({create,targetOf,proposalTarget,relatedTarget,blockedTarget});
})();
