/* Explicit browse metadata, never a journal write or source/body proof. */
(() => {
  'use strict';
  async function read({stamp,account,metadata,directory,read,guard}){
    const fail=()=>Error('위키 목록의 저장 상태가 변경되었습니다. 원본을 보존했으며 다시 확인하세요.');
    const active=()=>{if(guard?.active&&!guard.active())throw fail();};
    if(typeof stamp!=='string'||typeof account!=='string'||!Array.isArray(metadata)||metadata.length>2||new Set(metadata).size!==metadata.length
      ||metadata.some(key=>!['wiki_lifecycle','wiki_ingest_operations'].includes(key)))throw fail();
    const checked=async(path,shallow)=>{
      active();const result=await (shallow?directory:read)(path);active();
      if(result?.projection!=='path_v1'||result.stamp!==stamp||result.found!==true)throw fail();
      if(shallow&&(result.part?.type!=='object'||!Array.isArray(result.part.entries)))throw fail();
      return result;
    };
    if(metadata.includes('wiki_ingest_operations')){
      const operations=await checked(['contexts',account,'wiki_ingest_operations'],true);
      if(operations.part.entries.length)return null;
    }
    const lifecycle=metadata.includes('wiki_lifecycle')
      ?NowWikiLifecycle.validateMap((await checked(['contexts',account,'wiki_lifecycle'],false)).value):{};
    await checked(['contexts',account],true);active();return {lifecycle};
  }
  globalThis.NowWikiIndex={read};
})();
