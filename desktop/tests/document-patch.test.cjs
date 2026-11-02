const {test}=require('node:test');
const assert=require('node:assert/strict');
const parts=require('../../web/vendor/document-parts.js');
function plan(records,path,expected,next){
  const steps=parts.replaceSteps(path,expected,next),reads=[];let step=steps.next();
  while(!step.done){reads.push(step.value);step=steps.next(records.get(step.value));}
  return {...step.value,reads};
}
test('subtree patch preserves sibling documents, histories and unknown fields without reading their bodies',()=>{
  const original={contexts:{A:{notes:{one:{draft:{content:'old'},extra:{keep:1}},two:{body:'OTHER'}}},B:{history:[{content:'FOREIGN'}]}},unknown:[1,null]};
  const records=parts.encode(original),path=['contexts','A','notes','one'];
  const next={draft:{content:'new'},extra:{keep:1},revisions:[{snapshot:{body:'added'}}]};
  const result=plan(records,path,original.contexts.A.notes.one,next);
  assert.ok(result.reads.every(id=>!id.includes('"two"')&&!id.includes('"B"')));
  for(const change of result.changes)change.remove?records.delete(change.id):records.set(change.id,change.value);
  const expected=structuredClone(original);expected.contexts.A.notes.one=next;
  assert.deepEqual(parts.decode(records),expected);
});
test('patch handles primitive/container replacement and refuses missing, root or stale baseline',()=>{
  const records=parts.encode({a:{old:{content:'plain'}},b:false});
  const result=plan(records,['a'],{old:{content:'plain'}},'sealed');
  assert.ok(result.changes.some(change=>change.remove&&change.id==='["a","old"]'));
  for(const change of result.changes)change.remove?records.delete(change.id):records.set(change.id,change.value);
  assert.deepEqual(parts.decode(records),{a:'sealed',b:false});
  assert.throws(()=>plan(records,['a'],'old','new'),/conflict/i);
  assert.throws(()=>plan(records,['missing'],null,{}),/conflict/i);
  assert.throws(()=>plan(records,[],{},{}),/path/i);
});
