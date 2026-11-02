/* Immutable write snapshots share unchanged JSON containers, never mutable journal objects. */
(() => {
  'use strict';
  function create(){
    const cache=new WeakMap();let metrics={created:0,reused:0};
    return {
      capture(root){
        const ancestors=new Set();metrics={created:0,reused:0};
        function visit(value){
          if(typeof value==='function'||typeof value==='symbol')return structuredClone(value);
          if(value===null||typeof value!=='object')return value;
          if(!Array.isArray(value)&&Object.prototype.toString.call(value)!=='[object Object]')return structuredClone(value);
          if(ancestors.has(value))throw Error('Cyclic history snapshot');
          ancestors.add(value);
          const keys=Object.keys(value),values=keys.map(key=>visit(value[key])),previous=cache.get(value);
          ancestors.delete(value);
          const length=Array.isArray(value)?value.length:null;
          if(previous&&previous.length===length&&previous.keys.length===keys.length
            &&keys.every((key,i)=>previous.keys[i]===key&&Object.is(previous.values[i],values[i]))){
            metrics.reused++;return previous.snapshot;
          }
          const snapshot=Array.isArray(value)?[]:{};
          keys.forEach((key,i)=>Object.defineProperty(snapshot,key,{value:values[i],enumerable:true,writable:true,configurable:true}));
          if(length!==null)snapshot.length=length;
          Object.freeze(snapshot);cache.set(value,{keys,values,length,snapshot});metrics.created++;return snapshot;
        }
        return visit(root);
      },
      stats(){return {...metrics};},
    };
  }
  globalThis.NowHistorySnapshots={create};
})();
