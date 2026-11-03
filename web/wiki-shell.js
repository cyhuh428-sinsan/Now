/* Independent Wiki host. Memo editors and their application bootstrap are not loaded. */
(() => {
  'use strict';
  const HISTORY='nownote.history.v1',SETTINGS='nownote.web.settings.v1';
  const $=selector=>document.querySelector(selector),native=globalThis.nownoteDesktop?.storage;
  const session=NowWebSessionStorage.create({session:()=>sessionStorage,persistent:()=>localStorage});
  const hosted=['http:','https:'].includes(location.protocol)&&!['localhost','127.0.0.1','::1'].includes(location.hostname);
  let settings={},server={},authenticated=false,generation=0,history=null,runtime=null,workspace=null,browser=null,backend=null,frozen=false,settingsRead=0;
  const remoteSources=new Map();
  const parse=value=>typeof value==='string'?JSON.parse(value):value;
  const storageRead=async key=>native?parse(await native.read(key)):parse(localStorage.getItem(key));
  const status=message=>{$('#wikiShellStatus').textContent=message||'';};
  function context(){
    const token=hosted?server.webSessionToken:server.userToken||'',headers={
      ...(server.token?{Authorization:'Bearer '+server.token}:{}),...(hosted&&token?{'X-Now-Web-Session':token}:{}),
      ...(!hosted&&token?{'X-Now-User-Token':token}:{})};
    const saved=hosted?session.load():null;
    const active=!frozen&&(!hosted||authenticated&&saved?.token===server.webSessionToken&&saved?.ownerId===server.ownerId&&!session.invalidated(saved));
    return {url:String(server.url||'').replace(/\/+$/,''),owner:String(server.ownerId||'local_user').trim().toLowerCase(),
      device:server.deviceId||(hosted?'web-client':'web-desktop'),headers,auth:token,enabled:active,
      online:active&&server.mode==='server'&&Boolean(server.url&&(token||server.token))&&navigator.onLine};
  }
  const contextKey=()=>{const ctx=context();return JSON.stringify([NowNoteHistory.key(ctx),ctx.auth,ctx.device,ctx.enabled,generation]);};
  function browserStorage(){
    return browser ||= NowBrowserHistoryStorage.create({indexedDB,localStorage,key:HISTORY,lock:action=>{
      if(!navigator.locks)throw Error('이 브라우저는 안전한 동시 저장을 지원하지 않습니다. 원본을 보존했습니다.');
      return navigator.locks.request(HISTORY,action);
    }});
  }
  async function readPath(path,guard,directory=false){
    if(guard?.active&&!guard.active())throw Error('저장 계정이 변경되었습니다.');
    const value=native?await native[directory?'readDirectory':'readPath'](HISTORY,path):await browserStorage()[directory?'readDirectory':'readPath'](path,guard);
    if(guard?.active&&!guard.active())throw Error('저장 계정이 변경되었습니다.');return value;
  }
  async function request(path,method='GET',body=null){
    const ctx=context(),key=contextKey();if(!ctx.enabled||!ctx.online)throw Error('인증된 서버에 연결하세요.');
    const response=await fetch(ctx.url+path,{method,cache:'no-store',headers:{...ctx.headers,...(body?{'Content-Type':'application/json'}:{})},
      ...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});
    if(key!==contextKey())throw Error('계정·서버가 변경되었습니다. 원본을 보존했습니다.');
    const result=await response.json().catch(()=>null);
    if(key!==contextKey())throw Error('계정·서버가 변경되었습니다. 원본을 보존했습니다.');
    if(!response.ok||!result)throw Object.assign(Error(result?.detail?.code||'요청을 확인하지 못했습니다: HTTP '+response.status),{status:response.status,code:result?.detail?.code});
    return result;
  }
  async function historyRequest(ctx,path,method,body){
    if(history?.legacyPending())throw Error('기존 동기화 응답을 먼저 확인해야 합니다. 편집본은 보존했습니다.');
    const query=new URLSearchParams({owner_id:ctx.owner});
    if(method==='GET')for(const [key,value]of Object.entries(body||{}))if(value!=null)query.set(key,String(value));
    const match=String(body?.local_id||'').match(/^wiki:([0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12})$/);
    const publication=match&&(path==='current'&&method==='PUT'||path==='revisions/import'&&method==='POST');
    if(publication&&workspace?.lifecycle.blocked(body.local_id))throw Error('휴지통 위키의 상태를 먼저 확인하세요.');
    const route=publication?'/api/v1/wikis/'+match[1]+'/'+path:'/api/v2/notes/'+path;
    return request(route+(method==='GET'?'?'+query:''),method,method==='GET'?null:body);
  }
  async function readCurrent(id){
    const value=await historyRequest(context(),'current','GET',{local_id:id}),note=value.snapshot?.note;
    if(note&&note.owner_id===context().owner&&note.local_id===id&&!id.startsWith('wiki:'))remoteSources.set(id,{note,protected:value.crypto_epoch!==0||value.protection_state!=='legacy'});
    return value;
  }
  async function wikiRead(path,{summary=false}={}){
    const query=new URLSearchParams({owner_id:context().owner});
    if(!path)query.set('include_deleted','true');if(summary&&!path)query.set('summary','true');
    return request('/api/v1/wikis'+path+'?'+query);
  }
  async function wikiRequest(path,method,body){
    const read=method==='GET'&&(/^\/api\/v2\/notes\/(current|revisions|revision|crypto-transitions\/status)$/.test(path)||path==='/api/v1/server'||/^\/api\/v1\/wiki-operations\/[0-9a-f-]{36}$/.test(path));
    const write=method==='POST'&&/^\/api\/v1\/wiki-operations\/(prepare|[0-9a-f-]{36}\/(commit|abort))$/.test(path);
    if(!read&&!write)throw Error('허용되지 않은 위키 요청입니다.');
    const query=read?'?'+new URLSearchParams(Object.entries(body||{}).filter(([,value])=>value!=null)):'';
    return request(path+query,method,read?null:body);
  }
  function source(id){
    const ctx=context();if(!ctx.enabled||!history)return null;
    const current=history.currentView(id),remote=remoteSources.get(id),note=current?.draft||remote?.note;
    if(!note||note.owner_id!==ctx.owner||note.deleted_at||note.note_type!=='tree')return null;
    const protectedNote=Boolean(history.blocked(id)||current?.conflicted||current?.base.crypto_epoch>0||remote?.protected||String(note.content).startsWith('NOW_ENCRYPTED_'));
    return {owner:ctx.owner,localId:id,status:protectedNote?'locked':'ok',origin:current?.localOnly?'local':'server',title:note.title,
      content:protectedNote?'':note.content,protected:protectedNote,revisionId:null,headVersion:0};
  }
  function notes(){
    const ids=new Set([...Object.keys(history.currentEntries({excludeWiki:true})),...remoteSources.keys()]);
    return [...ids].filter(id=>!id.startsWith('wiki')).map(id=>{const value=source(id);return value?.status==='ok'?{id,title:value.title}:null;}).filter(Boolean);
  }
  async function loadSources(){
    if(!context().online)return;
    const rows=await request('/api/v1/notes?'+new URLSearchParams({owner_id:context().owner,note_type:'tree'}));
    if(!Array.isArray(rows))throw Error('자료 목록 형식을 확인하세요.');
    remoteSources.clear();
    for(const note of rows)if(note.owner_id===context().owner&&!note.local_id.startsWith('wiki:'))remoteSources.set(note.local_id,{note,protected:String(note.content).startsWith('NOW_ENCRYPTED_')});
  }
  async function openSet(guard){
    const index=history.wikiIndex?.();if(!index)return null;
    const bound=contextKey(),active=()=>bound===contextKey()&&context().enabled&&guard.active();
    return NowWikiReadSet.open({stamp:index.stamp,account:NowNoteHistory.key(context()),guard:{active},
      current:async()=>{const value=await backend.current(NowNoteHistory.key(context()),{active});if(!value?.ok&&native)throw Error(value?.message||'저장 상태를 확인하세요.');return value;},
      directory:path=>readPath(path,{active},true),read:path=>readPath(path,{active})});
  }
  async function prepareBrowse(){
    const prepared=await history.prepareWikiIndex(({stamp,account,metadata,guard})=>NowWikiIndex.read({stamp,account,metadata,guard,
      inspectOperations:rows=>workspace.ingest.inspectOperations(rows),directory:path=>readPath(path,guard,true),read:path=>readPath(path,guard)}));
    if(!prepared)await history.ensure();
  }
  const llmConfig=value=>({provider:'openai',apiKey:'',omniUrl:'',omniApiKey:'',omniModel:'auto',omniReasoning:'',ollamaUrl:'',ollamaModel:'llama3.1',...value.llm});
  const normalizeServer=value=>({mode:'local',url:'',ownerId:'local_user',deviceId:'web-desktop',...value});
  const serverKey=value=>JSON.stringify(['mode','url','ownerId','deviceId','token','userToken','webSessionToken'].map(key=>value[key]??''));
  function appearance(){
    const root=document.documentElement,theme=['light','dark'].includes(settings.theme)?settings.theme:matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';
    root.dataset.theme=theme;root.dataset.client=hosted?'hosted':native?'desktop':'local';
    root.dataset.fontSize=['small','medium','large'].includes(settings.fontSize)?settings.fontSize:'medium';
    root.dataset.lineHeight=['compact','normal','relaxed'].includes(settings.lineHeight)?settings.lineHeight:'normal';
    root.style.setProperty('--blue',({blue:'#2563eb',purple:'#8b5cf6',green:'#14b8a6',orange:'#f97316'})[settings.accent]||'#2563eb');
    for(const [id,token]of Object.entries({heading:'--md-heading',link:'--md-link',inlineCode:'--md-inline-code-text',inlineCodeBg:'--md-inline-code-bg',codeBlockBg:'--md-code-block-bg',codeBlockText:'--md-code-block-text'})){
      const value=settings.markdownColors?.[theme]?.[id];if(typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value))root.style.setProperty(token,value);else root.style.removeProperty(token);
    }
  }
  async function refreshSettings(){
    const token=++settingsRead,value=await storageRead(SETTINGS)||{};if(token!==settingsRead)return;
    if(typeof value!=='object'||Array.isArray(value))throw Error('설정 저장본을 확인하세요.');
    if(!hosted&&serverKey(normalizeServer(value.server))!==serverKey(server)){
      frozen=true;generation++;workspace?.view.close();history?.invalidate();remoteSources.clear();
      status('연결 설정이 변경되었습니다. 창을 다시 불러와 확인하세요. 원본은 보존했습니다.');return;
    }
    settings=value;appearance();
  }
  function connection(purpose){
    const bound=contextKey(),config=JSON.stringify(llmConfig(settings));let transmissionStamp=null;
    return NowWikiConnection.create({purpose,contextKey,readConfig:()=>llmConfig(settings),verify:async()=>{
      const active=()=>bound===contextKey()&&context().enabled;
      if(!active()||history.deferred())throw Error('자료·계정 검증을 먼저 완료하세요. 전송하지 않았습니다.');
      const fresh=await storageRead(SETTINGS)||{};
      if(!active()||JSON.stringify(llmConfig(fresh))!==config||!hosted&&serverKey(normalizeServer(fresh.server))!==serverKey(server))
        throw Error('등록된 연결 설정이 변경되었습니다. 전송 범위를 다시 확인하세요.');
      const expected=transmissionStamp??backend.stamp(),current=await readPath([],{active},true);
      if(typeof expected!=='string'||backend.stamp()!==expected||current.stamp!==expected||!active())
        throw Error('다른 창에서 자료 또는 보호 상태가 변경되었습니다. 다시 열어 확인하세요.');
      transmissionStamp=expected;
    }});
  }
  async function navigateMemo(action='note',id=null){
    if(action!=='wiki-protection'&&workspace&&await workspace.view.requestLeave()!==true)return;
    workspace?.view.close();
    const ctx=context(),navigation=NowWorkspaceNavigation.validate({schema_version:1,action,local_id:id,owner:ctx.owner,url:ctx.url,created_at:Date.now()},ctx);
    if(native)return globalThis.nownoteDesktop.openWorkspace('note',navigation);
    sessionStorage.setItem('nownote.workspace.navigation.v1',JSON.stringify(navigation));location.assign(new URL(hosted?'../app/':'../index.html',location.href));
  }
  async function initialize(){
    const ctx=context();if(!ctx.enabled)return;
    backend=await NowHistoryPersistence.create({native,browser:browserStorage,readLegacy:()=>storageRead(HISTORY),key:HISTORY});
    runtime=await NowHistoryClient.create({backend,context,request:historyRequest,legacyStrings:Boolean(native),change:error=>status(error.message)});
    history=runtime.history;
    workspace=NowWikiWorkspace.create({context,contextKey,history:()=>history,source,notes,readCurrent,
      request:wikiRequest,readRemote:id=>wikiRead('/'+encodeURIComponent(id)),listRemote:async options=>(await wikiRead('',options)).items,
      openSet,prepareBrowse,viewGeneration:()=>generation,connection,openSource:ref=>navigateMemo('source',ref.local_id),openProtection:id=>navigateMemo('wiki-protection','wiki:'+id),
      lifecycleRequest:async(ctx,local,operation,body)=>{
        if(!ctx.enabled||!ctx.online||!['trash','restore'].includes(operation))throw Error('서버 연결과 위키 상태를 확인하세요.');
        return request('/api/v1/wikis/'+encodeURIComponent(local.slice(5))+'/'+operation,'POST',body);
      },mountOptions:{host:$('#wikiWorkspaceHost'),standalone:true}});
    document.documentElement.dataset.auth='unlocked';$('#wikiLogin').hidden=true;$('#wikiShell').hidden=false;
    $('#wikiLogout').hidden=!hosted;$('#wikiAccount').textContent=ctx.owner+(ctx.online?' · 서버 연결':' · 오프라인');
    const requested=new URLSearchParams(location.search).get('view');
    await open(['sources','build','lint','browse','query','graph'].includes(requested)?requested:'browse');
  }
  async function open(view){
    if(!context().enabled)return;
    status('');
    if(view!=='browse'){await history.ensure();await loadSources();}
    await workspace.view.open(view);
    for(const button of document.querySelectorAll('[data-wiki-view]'))button.setAttribute('aria-current',button.dataset.wikiView===view?'page':'false');
  }
  function invalidate(){
    generation++;authenticated=false;workspace?.view.close();history?.invalidate();history=null;workspace=null;runtime=null;remoteSources.clear();
    $('#wikiWorkspaceHost').replaceChildren();$('#wikiShell').hidden=true;$('#wikiLogin').hidden=false;document.documentElement.dataset.auth='locked';
  }
  async function login(event){
    event.preventDefault();const button=event.currentTarget.querySelector('button[type=submit]');button.disabled=true;
    const owner=$('#wikiLoginOwner').value.trim().toLowerCase(),password=$('#wikiLoginPassword').value,code=$('#wikiLoginFactor').value.trim(),bound=generation;
    try{
      const response=await fetch(location.origin+'/api/v1/auth/web-login',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({owner_id:owner,password,device_id:'web-client',...(code?{two_factor_code:code}:{})})});
      const payload=await response.json();if(bound!==generation)throw Error('로그인 상태가 변경되었습니다.');
      if(!response.ok||!payload.session_token)throw Error('로그인 정보를 확인하세요: HTTP '+response.status);
      session.save({ownerId:owner,token:payload.session_token,deviceId:'web-client',expiresAt:payload.expires_at});
      server={...server,mode:'server',url:location.origin,ownerId:owner,deviceId:'web-client',token:'',userToken:'',webSessionToken:payload.session_token};
      authenticated=true;await initialize();$('#wikiLoginPassword').value='';$('#wikiLoginFactor').value='';
    }catch(error){$('#wikiLoginStatus').textContent=error.message;}finally{button.disabled=false;}
  }
  async function start(){
    settings=await storageRead(SETTINGS)||{};if(typeof settings!=='object'||Array.isArray(settings))throw Error('설정 저장본을 확인하세요.');
    server=normalizeServer(settings.server);appearance();
    $('#wikiLoginForm').addEventListener('submit',login);
    for(const button of document.querySelectorAll('[data-wiki-view]'))button.addEventListener('click',()=>open(button.dataset.wikiView).catch(error=>status(error.message)));
    $('#wikiOpenMemo').addEventListener('click',()=>navigateMemo().catch(error=>status(error.message)));$('#wikiSettings').addEventListener('click',()=>navigateMemo('settings').catch(error=>status(error.message)));
    $('#wikiLogout').addEventListener('click',async()=>{
      const ctx=context();session.markLoggedOut();session.clear();invalidate();
      try{await fetch(ctx.url+'/api/v1/auth/web-logout',{method:'POST',headers:ctx.headers});}catch{}
    });
    window.addEventListener('storage',event=>{if(['nownote.web.logout.v1','nownote.web.auth.active.v1'].includes(event.key)&&hosted&&session.invalidated(session.load()))invalidate();});
    window.addEventListener('focus',()=>refreshSettings().catch(error=>status(error.message)));
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change',appearance);
    if(!hosted){await initialize();return;}
    const saved=session.load();if(!saved?.ownerId||!saved.token||session.invalidated(saved)){session.clear();$('#wikiLogin').hidden=false;return;}
    server={...server,mode:'server',url:location.origin,token:'',userToken:'',webSessionToken:saved.token,ownerId:saved.ownerId,deviceId:saved.deviceId||'web-client'};
    const response=await fetch(location.origin+'/api/v1/auth/web-session?'+new URLSearchParams({owner_id:saved.ownerId}),{cache:'no-store',headers:{'X-Now-Web-Session':saved.token}});
    const currentSession=session.load();
    if(!response.ok||session.invalidated(saved)||currentSession?.token!==saved.token||currentSession?.ownerId!==saved.ownerId){session.clear();invalidate();return;}
    authenticated=true;await initialize();
  }
  start().catch(error=>{
    if(hosted&&!authenticated){
      $('#wikiShell').hidden=true;$('#wikiLogin').hidden=false;
      $('#wikiLoginStatus').textContent='서버 연결과 로그인 상태를 확인하세요. 저장된 자료는 보존했습니다.';
    }else{status(error.message);$('#wikiShell').hidden=false;}
  });
  if(isSecureContext&&'serviceWorker' in navigator&&['http:','https:'].includes(location.protocol)){
    const worker=location.pathname.startsWith('/wiki')?new URL('/wiki/sw.js',location.origin):new URL('./sw.js',location.href);
    navigator.serviceWorker.register(worker.href).catch(()=>{});
  }
})();
