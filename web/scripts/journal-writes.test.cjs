const {test}=require('node:test');
const assert=require('node:assert/strict');
const {create,eligible}=require('../vendor/journal-writes.js');
const account=JSON.stringify(['https://qa.invalid','alice']);
function initial(){const note=id=>({owner_id:'alice',local_id:id,note_type:'tree',content:'old',source:'manual'});
  return {schema_version:1,contexts:{[account]:{notes:{a:{raw:note('a'),draft:note('a'),base:{crypto_epoch:0},revisions:[],outbox:[],receipts:[]},b:{raw:note('b'),draft:note('b'),base:{crypto_epoch:0},revisions:[],outbox:[],receipts:[]}}}}};}
test('actual journal adapter sends one entry, advances its baseline and keeps whole fallback coherent',async()=>{
  const value=initial(),calls=[];let revision='one';
  const writer=create({initial:value,revision,scoped:true,contextKey:()=>account,
    note:async request=>{calls.push(request);assert.equal(request.revision,revision);revision+='x';return {revision,scoped:true};},
    full:async request=>{assert.equal(request.expected.contexts[account].notes.a.draft.content,'edited');return {revision:'full',scoped:false};}});
  const next=structuredClone(value.contexts[account].notes.a);next.draft.content='edited';
  await writer.writeNote({url:'https://qa.invalid',owner:'alice'},'a',next);
  assert.equal(calls.length,1);assert.equal(calls[0].id,'a');assert.equal(calls[0].expected.draft.content,'old');assert.equal(calls[0].next.draft.content,'edited');
  const whole=structuredClone(value);whole.contexts[account].notes.a=next;whole.extra={preserved:true};await writer.write(whole);
});
test('protected metadata uses whole fallback; changed account and uncertain saves never automatically resend',async()=>{
  const value=initial();value.protection_operations={};let full=0,note=0,key=account;
  const writer=create({initial:value,revision:'one',scoped:true,contextKey:()=>key,note:async()=>{note++;},full:async()=>{full++;return {revision:'two',scoped:false};}});
  assert.equal(eligible(value,account,'a',value.contexts[account].notes.a),false);
  await writer.writeNote({url:'https://qa.invalid',owner:'alice'},'a',value.contexts[account].notes.a);assert.equal(note,0);assert.equal(full,1);
  const bad=create({initial:initial(),revision:'one',scoped:true,contextKey:()=>key,full:async()=>{},note:async()=>{note++;throw Object.assign(Error('lost reply'),{committed:true});}});
  await assert.rejects(bad.writeNote({url:'https://qa.invalid',owner:'alice'},'a',initial().contexts[account].notes.a),/lost reply/);
  await assert.rejects(bad.writeNote({url:'https://qa.invalid',owner:'alice'},'a',initial().contexts[account].notes.a),/다시|확인/);assert.equal(note,1);
  key='other';await assert.rejects(writer.writeNote({url:'https://qa.invalid',owner:'alice'},'a',initial().contexts[account].notes.a));
});
test('late completion from the previous account cannot replace a reset baseline',async()=>{
  let key='alice',release;const requests=[];
  const writer=create({initial:initial(),revision:'A',scoped:true,contextKey:()=>key,full:async()=>{throw Error('unexpected full');},
    note:async request=>{requests.push(request);if(request.revision==='A')return new Promise(resolve=>{release=()=>resolve({revision:'old-late',scoped:true});});return {revision:'new',scoped:true};}});
  const old=assert.rejects(writer.writeNote({url:'https://qa.invalid',owner:'alice'},'a',initial().contexts[account].notes.a),error=>error.committed===true);
  await new Promise(resolve=>setImmediate(resolve));
  const next=initial(),bob=JSON.stringify(['https://qa.invalid','bob']);next.contexts[bob]=next.contexts[account];delete next.contexts[account];
  for(const item of Object.values(next.contexts[bob].notes)){item.raw.owner_id='bob';item.draft.owner_id='bob';}
  key='bob';writer.reset({value:next,revision:'B',scoped:true});release();await old;
  await writer.writeNote({url:'https://qa.invalid',owner:'bob'},'a',next.contexts[bob].notes.a);
  assert.equal(requests[1].revision,'B');assert.equal(requests[1].account,bob);
});
