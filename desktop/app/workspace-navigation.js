/* Transient, account-bound screen navigation; never a mutation or credential carrier. */
(() => {
  'use strict';
  function shape(value,now=Date.now()){
    const fail=()=>{throw Error('작업 화면 이동 요청을 다시 확인하세요. 자료는 변경하지 않았습니다.');};
    if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join(',')!=='action,created_at,local_id,owner,schema_version,url'
      ||value.schema_version!==1||!['note','source','settings','wiki-protection'].includes(value.action)
      ||typeof value.owner!=='string'||!value.owner||value.owner.length>160||typeof value.url!=='string'
      ||!Number.isSafeInteger(value.created_at)||now-value.created_at>300000||value.created_at-now>5000)fail();
    if(value.url){let url;try{url=new URL(value.url);}catch{fail();}
      if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.search||url.hash)fail();}
    if(['note','settings'].includes(value.action)){if(value.local_id!==null)fail();}
    else if(typeof value.local_id!=='string'||!value.local_id||value.local_id.length>120||/[\x00-\x1f]/.test(value.local_id))fail();
    if(value.action==='wiki-protection'&&!/^wiki:[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(value.local_id))fail();
    return structuredClone(value);
  }
  function validate(value,context,now){
    const result=shape(value,now);
    if(result.owner!==context.owner||result.url.replace(/\/+$/,'')!==String(context.url||'').replace(/\/+$/,''))
      throw Error('이동 요청의 계정·서버가 현재 로그인과 다릅니다. 자료는 변경하지 않았습니다.');
    return result;
  }
  const api={shape,validate};globalThis.NowWorkspaceNavigation=api;
  if(typeof module==='object'&&module.exports)module.exports=api;
})();
