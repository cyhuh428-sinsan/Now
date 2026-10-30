(async()=>{
  const assert=(v,m)=>{if(!v)throw Error(m);},delay=()=>new Promise(r=>setTimeout(r,5));
  let cases=0,normal=0;
  for(const action of ['read','conversion','resume'])for(const stop of ['lock','close','account','target']) {
    let context='account-one/target-one',target='one',release,reached=false,rejected=false,mutation=0,plainResult=false,normalRead=false;
    const gate=new Promise(r=>release=r);
    const delayed=async key=>{
      await key({representation_epoch:1});reached=true;await gate;
      try{await key({representation_epoch:2});mutation++;plainResult=true;return 'LATE-RESULT';}
      catch(e){rejected=true;throw e;}
    };
    const info={scope:{url:'https://synthetic.invalid',owner:'account-one',local_id:'one',instance:'synthetic-instance'},status:{crypto_epoch:0},pending:action==='resume'?{id:'op',phase:'applying'}:null,rows:[{label:'Synthetic source',kind:'synthetic'}]};
    const view=mountNoteProtection({contextKey:()=>context,canMutate:()=>true,targets:()=>['one','two'],target:()=>target,selectTarget:id=>{target=id;context='account-one/target-'+id;},lock:()=>{},inspect:async()=>info,copies:async()=>[],phaseLabel:()=> '합성 정착 대기',
      read:async(_info,_row,key)=>normalRead?(await key({representation_epoch:2}),'NORMAL-READ'):delayed(key),
      convert:async(_info,_purpose,_password,key)=>delayed(key),resume:async(_info,_password,key)=>delayed(key),confirm:async()=>{}});
    await view.open();
    const dialog=document.querySelector('#noteProtectionDialog'),button=name=>dialog.querySelector('[data-action="'+name+'"]');
    button(action).click();
    for(let i=0;i<500&&!reached;i++) {const form=dialog.querySelector('form.library-confirm');if(form){form.querySelector('input').value='synthetic-key';form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));}await delay();}
    assert(reached,action+'/'+stop+' first key/crypto gate not reached');
    if(stop==='lock')button('lock').click();
    else if(stop==='close')button('close').click();
    else {context=stop==='account'?'account-two/target-one':'account-one/target-two';view.check();}
    await delay();release();
    for(let i=0;i<500;i++) {
      await delay();
      assert(!dialog.querySelector('form.library-confirm'),action+'/'+stop+' late key request created a password form');
      if(!button('refresh').disabled)break;
      if(i===499)throw Error(action+'/'+stop+' stale action did not settle');
    }
    assert(rejected&&mutation===0&&!plainResult,action+'/'+stop+' late callback obtained key or mutated');
    assert(dialog.querySelector('.protection-plain').textContent==='','late plaintext remained in DOM');
    // A new user action still needs its own prompt; an old callback must not populate this cache.
    context='account-one/target-one-new';normalRead=true;await view.open();button('read').click();
    let prompted=false;
    for(let i=0;i<500;i++) {
      const form=dialog.querySelector('form.library-confirm');
      if(form){prompted=true;form.querySelector('input').value='fresh-user-key';form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));}
      await delay();
      if(!button('refresh').disabled)break;
      if(i===499)throw Error('fresh read did not settle');
    }
    assert(prompted&&dialog.querySelector('.protection-plain').textContent==='NORMAL-READ','fresh action was blocked or reused stale key cache');
    view.invalidate();await delay();dialog.remove();cases++;normal++;
  }
  for(const stop of ['lock','close','account','target']) {
    let context='one',writes=0;
    const view=mountNoteProtection({contextKey:()=>context,canMutate:()=>true,targets:()=>['one'],target:()=> 'one',selectTarget:()=>{},lock:()=>{},
      inspect:async()=>({scope:{url:'https://synthetic.invalid',owner:'one',local_id:'one',instance:'synthetic'},status:{crypto_epoch:0},rows:[{label:'Synthetic'}]}),copies:async()=>[],
      read:async(_i,_r,key)=>{await key({representation_epoch:3});writes++;return 'FRESH-ONLY';}});
    await view.open();const dialog=document.querySelector('#noteProtectionDialog'),button=name=>dialog.querySelector('[data-action="'+name+'"]');button('read').click();
    for(let i=0;i<500&&!dialog.querySelector('form');i++)await delay();
    const old=dialog.querySelector('form');assert(old,'initial key form absent');
    if(stop==='lock')button('lock').click();else if(stop==='close')button('close').click();else {context=stop;view.check();}
    for(let i=0;i<500&&button('refresh').disabled;i++)await delay();
    assert(writes===0&&!dialog.querySelector('form'),'cancelled pending key completed');
    context='fresh';await view.open();button('read').click();
    for(let i=0;i<500&&!dialog.querySelector('form');i++)await delay();
    const fresh=dialog.querySelector('form');assert(fresh,'new read reused stale cached key');
    old.querySelector('input').value='stale-event-key';old.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
    assert(dialog.querySelector('form')===fresh&&!fresh.querySelector('input').value,'detached old submit affected fresh form');
    fresh.querySelector('input').value='fresh-key';fresh.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
    for(let i=0;i<500&&button('refresh').disabled;i++)await delay();
    assert(writes===1&&dialog.querySelector('.protection-plain').textContent==='FRESH-ONLY','fresh key request failed');
    view.invalidate();await delay();dialog.remove();cases++;normal++;
  }
  return {ok:true,mode:globalThis.__PROTECTION_QA__.mode,phase:1,stage:'action-bound-key-requests',staleCases:cases,freshReads:normal};
})();
