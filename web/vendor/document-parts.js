/* Lossless JSON parts. Stable paths keep unrelated documents out of writes. */
(() => {
  'use strict';
  const encode = value => {
    const parts = new Map(),ancestors=new Set();
    function visit(value, path) {
      if(typeof value?.toJSON==='function')value=value.toJSON(path.at(-1)||'');
      if (value === null || typeof value !== 'object') {
        if (!['string','boolean','number'].includes(typeof value) && value !== null) throw Error('Non-JSON document value');
        if (typeof value === 'number' && !Number.isFinite(value))value=null;
        return {value};
      }
      const id=JSON.stringify(path), array=Array.isArray(value);
      if (!array && ![Object.prototype,null].includes(Object.getPrototypeOf(value))) throw Error('Non-JSON object');
      if(ancestors.has(value))throw Error('Cyclic document value');ancestors.add(value);
      const keys=array?Array.from({length:value.length},(_,i)=>String(i)):Object.keys(value);
      const omitted=item=>['undefined','function','symbol'].includes(typeof item);
      const entries=keys.filter(key=>array||!omitted(value[key])).map(key=>[key,visit(array&&omitted(value[key])?null:value[key],[...path,key])]);
      ancestors.delete(value);
      parts.set(id,{type:array?'array':'object',entries});
      return {ref:id};
    }
    parts.set('$root',visit(value,[]));
    return parts;
  };
  const decode = parts => {
    const seen=new Set();
    function visit(descriptor) {
      if (!descriptor || typeof descriptor!=='object') throw Error('Invalid document part');
      if (Object.keys(descriptor).length===1 && Object.hasOwn(descriptor,'value')) return descriptor.value;
      if (Object.keys(descriptor).join(',')!=='ref' || typeof descriptor.ref!=='string' || seen.has(descriptor.ref)) throw Error('Invalid document reference');
      seen.add(descriptor.ref);
      const part=parts.get(descriptor.ref);
      if (!part || !['array','object'].includes(part.type) || !Array.isArray(part.entries)) throw Error('Missing document part');
      const value=part.type==='array'?[]:{}, keys=new Set();
      for (const entry of part.entries) {
        if (!Array.isArray(entry)||entry.length!==2||typeof entry[0]!=='string'||keys.has(entry[0])) throw Error('Invalid document field');
        const [key,item]=entry;keys.add(key);
        if(part.type==='array' && key!==String(value.length))throw Error('Invalid document array');
        Object.defineProperty(value,key,{value:visit(item),enumerable:true,writable:true,configurable:true});
      }
      return value;
    }
    const result=visit(parts.get('$root'));
    if(seen.size+1!==parts.size)throw Error('Orphan document parts');
    return result;
  };
  const delta = (before,after) => {
    const result=[];
    for(const [id,value] of after)if(JSON.stringify(before.get(id))!==JSON.stringify(value))result.push({id,value});
    for(const id of before.keys())if(!after.has(id))result.push({id,remove:true});
    return result;
  };
  // Yield exact record IDs so both SQLite and IDB can read one consistent subtree.
  function* selectSteps(path){
    if(!Array.isArray(path)||path.some(key=>typeof key!=='string'))throw Error('Invalid document path');
    path=[...path];
    function descriptor(value,expected){
      if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==1)throw Error('Invalid document descriptor');
      if(Object.hasOwn(value,'value')){
        const item=value.value;
        if(item!==null&&!['string','boolean','number'].includes(typeof item)||typeof item==='number'&&!Number.isFinite(item))throw Error('Invalid document value');
        return false;
      }
      if(Object.keys(value)[0]!=='ref'||value.ref!==JSON.stringify(expected))throw Error('Invalid document reference');
      return true;
    }
    function* visit(value,location,offset){
      if(!descriptor(value,location))return offset<path.length?{found:false}:{found:true,value:value.value};
      const part=yield value.ref;
      if(!part||Object.keys(part).sort().join(',')!=='entries,type'||!['array','object'].includes(part.type)||!Array.isArray(part.entries))throw Error('Missing or invalid document part');
      const keys=new Set();
      for(const [index,entry] of part.entries.entries()){
        if(!Array.isArray(entry)||entry.length!==2||typeof entry[0]!=='string'||keys.has(entry[0])
          ||part.type==='array'&&entry[0]!==String(index))throw Error('Invalid document field');
        keys.add(entry[0]);descriptor(entry[1],[...location,entry[0]]);
      }
      if(offset<path.length){
        const entry=part.entries.find(([key])=>key===path[offset]);
        return entry?yield* visit(entry[1],[...location,entry[0]],offset+1):{found:false};
      }
      const result=part.type==='array'?[]:{};
      for(const [key,item] of part.entries){
        const child=yield* visit(item,[...location,key],offset);
        Object.defineProperty(result,key,{value:child.value,enumerable:true,writable:true,configurable:true});
      }
      return {found:true,value:result};
    }
    return yield* visit(yield '$root',[],0);
  }
  function select(path,read){
    const steps=selectSteps(path);let step=steps.next();
    while(!step.done)step=steps.next(read(step.value));
    return step.value;
  }
  globalThis.NowDocumentParts={encode,decode,delta,selectSteps,select};
  if(typeof module!=='undefined'&&module.exports)module.exports=globalThis.NowDocumentParts;
})();
