/* Only the bundled protocol runs here. No storage, network, key cache or second job. */
(() => {
  'use strict';
  let used=false;
  globalThis.onmessage=async event=>{
    const request=event.data;
    if(used){close();return;}used=true;
    try{
      if(!request||Object.keys(request).sort().join(',')!=='id,operation,password,schema_version,value'||request.schema_version!==1
        ||typeof request.id!=='string'||!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(request.id)
        ||!['encrypt','decrypt','parse'].includes(request.operation)||typeof request.value!=='string'||typeof request.password!=='string'||request.operation!=='parse'&&!request.password.length)throw Error('request');
      const method=request.operation==='encrypt'?'encryptContent':'decryptContent';
      const value=request.operation==='parse'?JSON.stringify(NowNoteProtectionProtocol.parseJson(request.value)):await NowNoteProtectionProtocol[method](request.value,request.password);
      postMessage({schema_version:1,id:request.id,value});
    }catch(error){postMessage({schema_version:1,id:typeof request?.id==='string'?request.id:null,
      error:/^note_protection:[a-z0-9_]+$/.test(error?.message)?error.message:'note_crypto_worker:failed'});}
    finally{if(request&&typeof request==='object'){request.value=request.password='';}globalThis.onmessage=null;close();}
  };
})();
