const {test}=require('node:test');
const assert=require('node:assert/strict');
const parts=require('../../web/vendor/document-parts.js');

test('path selection reads only ancestors and the selected subtree, never other histories or accounts',()=>{
  const data={contexts:{A:{notes:{one:{draft:{content:'current'},revisions:[{body:'HISTORY'}]},two:{draft:{content:'OTHER'}}}},B:{notes:{secret:{body:'FOREIGN'}}}}};
  const encoded=parts.encode(data),reads=[];
  const result=parts.select(['contexts','A','notes','one','draft'],id=>{reads.push(id);return encoded.get(id);});
  assert.deepEqual(result,{found:true,value:{content:'current'}});
  assert.deepEqual(reads,['$root','[]','["contexts"]','["contexts","A"]','["contexts","A","notes"]','["contexts","A","notes","one"]','["contexts","A","notes","one","draft"]']);
  assert.deepEqual(parts.select(['contexts','A','notes','missing'],id=>encoded.get(id)),{found:false});
  assert.deepEqual(parts.select([],id=>encoded.get(id)),{found:true,value:data});
});
test('selection preserves array/null/hostile-key values and rejects cross-path or malformed references',()=>{
  const value=JSON.parse('{"__proto__":{"constructor":[null,false,{"x":2}]},"absent":null}'),encoded=parts.encode(value);
  assert.deepEqual(parts.select(['__proto__','constructor','2'],id=>encoded.get(id)),{found:true,value:{x:2}});
  assert.deepEqual(parts.select(['absent'],id=>encoded.get(id)),{found:true,value:null});
  assert.deepEqual(parts.select(['absent','x'],id=>encoded.get(id)),{found:false});
  for(const path of [null,{},['x',1]])assert.throws(()=>parts.select(path,id=>encoded.get(id)),/path/i);
  const wrong=parts.encode({A:{secret:'one'},B:{secret:'two'}});
  wrong.get('[]').entries[0][1].ref='["B"]';
  assert.throws(()=>parts.select(['A'],id=>wrong.get(id)),/reference/i);
  const missing=parts.encode({A:{body:1}});missing.delete('["A"]');
  assert.throws(()=>parts.select(['A'],id=>missing.get(id)),/part/i);
  const inherited=parts.encode({});inherited.set('$root',Object.assign(Object.create({ref:'[]'}),{unexpected:true}));
  assert.throws(()=>parts.select([],id=>inherited.get(id)),/reference/i);
});
