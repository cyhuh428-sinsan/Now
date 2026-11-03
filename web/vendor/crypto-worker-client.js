/* Fixed-origin, one-request workers keep large crypto conversions off the editor thread. */
(() => {
  'use strict';
  const page=typeof location==='object'?new URL(location.href):null;
  const script=page&&typeof document==='object'?new URL(document.currentScript?.src||page.href,page):null;
  const endpoint=script?new URL('crypto-worker.js',script):null;
  const pending=new Set();
  const cancelAll=()=>{for(const finish of [...pending])finish(Error('note_crypto_worker:cancelled'));};
  const canRun=value=>typeof document==='object'&&typeof Worker==='function'&&typeof value==='string'&&value.length>=65536;
  function execute(operation,value,password){
    return new Promise((resolve,reject)=>{
      if(!endpoint||endpoint.origin!==page.origin||endpoint.protocol!==page.protocol||!['encrypt','decrypt','parse'].includes(operation)
        ||typeof value!=='string'||typeof password!=='string'||operation!=='parse'&&!password.length){reject(Error('note_crypto_worker:request'));return;}
      let worker,timer,finished=false;
      const finish=(error,result)=>{
        if(finished)return;finished=true;pending.delete(finish);clearTimeout(timer);
        if(worker){worker.onmessage=worker.onerror=worker.onmessageerror=null;worker.terminate();}
        if(error)reject(error);else resolve(result);
      };
      pending.add(finish);
      try{
        worker=new Worker(endpoint.href);const id=crypto.randomUUID();
        timer=setTimeout(()=>finish(Error('note_crypto_worker:timeout')),30000);
        worker.onerror=event=>{event.preventDefault?.();finish(Error('note_crypto_worker:failed'));};
        worker.onmessageerror=()=>finish(Error('note_crypto_worker:message'));
        worker.onmessage=event=>{
          const result=event.data;
          if(!result||result.schema_version!==1||result.id!==id){finish(Error('note_crypto_worker:binding'));return;}
          if(Object.keys(result).sort().join(',')==='id,schema_version,value'&&typeof result.value==='string')finish(null,result.value);
          else if(Object.keys(result).sort().join(',')==='error,id,schema_version'&&/^note_protection:[a-z0-9_]+$/.test(result.error))finish(Error(result.error));
          else finish(Error('note_crypto_worker:failed'));
        };
        const payload={schema_version:1,id,operation,value,password};worker.postMessage(payload);payload.value=payload.password='';
      }catch{finish(Error('note_crypto_worker:start'));}
    });
  }
  globalThis.addEventListener?.('pagehide',cancelAll);
  globalThis.NowNoteCryptoWorker=Object.freeze({canRun,execute,cancelAll});
})();
