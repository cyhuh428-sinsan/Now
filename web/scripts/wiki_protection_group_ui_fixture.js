/* Actual dialog component; metadata-only synthetic adapters, not a domain/HTTP proof. */
(async()=>{
  const config=globalThis.__PROTECTION_QA__,check=(value,code)=>{if(!value)throw Error('wiki_group_ui_'+code);};
  let generation=1,conversions=0;
  const scope={url:'https://synthetic.invalid',owner:'qa-wiki-group',device:'one',instance:'00000000-0000-4000-8000-000000000001',local_id:'wiki:00000000-0000-4000-8000-000000000002'};
  const info={scope,status:{crypto_epoch:0},pending:null,analysisOperations:[],rows:[],wikiGroup:{plan_hash:'synthetic-confirmed-plan',pending:null,
    members:[3,4].map(n=>({id:'wiki-proposal:00000000-0000-4000-8000-00000000000'+n+':00000000-0000-4000-8000-000000000002',copies:['history','fallback'].map(store=>({kind:'plain',store,path:['contexts','synthetic-account','notes','proposal-'+n],hash:String(n).repeat(64)}))}))}};
  const ui=mountNoteProtection({contextKey:()=>generation,canMutate:()=>true,lock:()=>{},targets:async()=>[scope.local_id],target:()=>scope.local_id,
    targetLabel:()=>scope.local_id,selectTarget:id=>check(id===scope.local_id,'target'),inspect:async()=>structuredClone(info),copies:async()=>[],
    convert:async(value,purpose,key,resolve,hash)=>{check(purpose==='conversion'&&key==='synthetic-key'&&hash===info.wikiGroup.plan_hash,'confirmed_call');conversions++;},
    phaseLabel:phase=>phase});
  const dialog=document.querySelector('#noteProtectionDialog'),button=name=>dialog.querySelector('[data-action="'+name+'"]');
  const until=async(test,code)=>{for(let i=0;i<200;i++){if(test())return;await new Promise(resolve=>setTimeout(resolve,10));}throw Error('wiki_group_ui_'+code);};
  await ui.open();
  let consent=dialog.querySelector('.protection-wiki-confirm');check(consent&&!consent.checked&&button('conversion').disabled,'initial_gate');
  check(dialog.querySelectorAll('.protection-wiki-proposals li').length===2,'all_members');check(conversions===0,'no_automatic_call');
  for(const [index,member]of info.wikiGroup.members.entries()){
    const text=dialog.querySelectorAll('.protection-wiki-proposals li')[index].textContent;
    for(const copy of member.copies)check(text.includes('저장소: '+copy.store)&&text.includes('경로: '+copy.path.join(' / '))
      &&text.includes('SHA-256: '+copy.hash),'all_copy_bindings_visible');
  }
  consent.click();check(!button('conversion').disabled,'explicit_gate');button('conversion').click();
  await until(()=>dialog.querySelector('form.library-confirm'),'cancel_form');
  dialog.querySelector('form.library-confirm button[type=button]').click();
  await until(()=>!dialog.querySelector('form.library-confirm')&&!button('refresh').disabled,'cancel_done');check(conversions===0,'cancel_no_call');
  button('conversion').click();await until(()=>dialog.querySelector('form.library-confirm'),'key_form');
  const form=dialog.querySelector('form.library-confirm');form.querySelector('input').value='synthetic-key';form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
  await until(()=>conversions===1&&!button('refresh').disabled,'confirmed_done');
  check(!dialog.querySelector('.protection-wiki-confirm').checked,'new_plan_requires_confirmation');
  ui.lock();check(dialog.querySelector('.protection-wiki-proposals').textContent==='','lock_conceals');
  await ui.open();
  const closed=new Promise(resolve=>dialog.addEventListener('close',resolve,{once:true}));generation++;ui.check();await closed;
  check(!dialog.open&&dialog.querySelector('.protection-wiki-proposals').textContent==='','context_conceals');
  await ui.open();check(![...dialog.querySelectorAll('input[type=password]')].some(input=>input.value),'no_key_for_capture');
  return {ok:true,mode:config.mode,phase:1,syntheticComponentOnly:true,groupUiVerified:true,consentRequired:true,cancelNoWrites:true,contextConceal:true,modelCalls:0,serverWrites:0};
})();
