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
  globalThis.NowDocumentParts={encode,decode,delta};
  if(typeof module!=='undefined'&&module.exports)module.exports=globalThis.NowDocumentParts;
})();
