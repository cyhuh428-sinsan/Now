const {test}=require('node:test');
const assert=require('node:assert/strict');
const {encode,decode,delta}=require('../../web/vendor/document-parts.js');
test('all JSON fields, account boundaries, protected archives and hostile keys round trip',()=>{
  const value=JSON.parse('{"schema_version":1,"contexts":{"A":{"notes":{"a":{"revisions":[{"snapshot":{"note":{"content":"old"}}}],"outbox":[],"extra":null}},"unknown":true},"a":{"notes":{"a":{"protection_record":{"ciphertext":"NOW_ENCRYPTED_V1:opaque"}}}}},"protection_operations":{"x":{"archive":[1,false,"x"]}},"__proto__":{"kept":true}}');
  assert.deepEqual(decode(encode(value)),value);
  assert.equal(Object.getPrototypeOf(decode(encode(value))),Object.prototype);
});
test('one draft update does not write any unrelated note or history part',()=>{
  const value={contexts:{A:{notes:{a:{draft:{content:'one'},revisions:[{body:'history'.repeat(100000)}]},b:{draft:{content:'other'.repeat(100000)}}}}}};
  const before=encode(value);value.contexts.A.notes.a.draft.content='two';
  const changes=delta(before,encode(value));
  assert.equal(changes.length,1);assert.match(changes[0].id,/draft/);
  assert(JSON.stringify(changes).length<200);
});
test('protection replacement deletes every previous plaintext part atomically',()=>{
  const old=encode({a:{draft:{content:'plain'},revisions:[{body:'old'}]}});
  const after=encode({a:{protection_record:{ciphertext:'sealed'}}});
  for(const change of delta(old,after))change.remove?old.delete(change.id):old.set(change.id,change.value);
  assert.deepEqual(decode(old),{a:{protection_record:{ciphertext:'sealed'}}});
  assert(!JSON.stringify([...old]).includes('plain'));
});
test('missing, orphan and cyclic parts fail closed',()=>{
  const parts=encode({a:{x:1}});parts.delete('["a"]');assert.throws(()=>decode(parts));
  const orphan=encode({});orphan.set('orphan',{});assert.throws(()=>decode(orphan));
  const cycle=new Map([['$root',{ref:'x'}],['x',{type:'object',entries:[['x',{ref:'x'}]]}]]);assert.throws(()=>decode(cycle));
});
test('restored note undefined fields and sparse arrays retain legacy JSON meaning',()=>{
  const value={deletedAt:undefined,content:'restored',extra:[undefined,,NaN,Infinity],nested:{ignored:undefined,keep:null}};
  assert.deepEqual(decode(encode(value)),JSON.parse(JSON.stringify(value)));
});
