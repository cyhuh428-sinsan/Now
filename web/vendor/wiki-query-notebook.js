/* Query results stay in the caller's memory; no Note or operation writer is used. */
globalThis.createWikiQueryNotebook=function createWikiQueryNotebook(api){
  'use strict';
  const Q=NowWikiQuery,P=NowNoteProtectionProtocol,tickets=new WeakMap();
  const check=(value,code)=>{if(!value)throw Error(code);};
  function action(){
    const context={...api.context()},key=api.contextKey();
    check(context.enabled&&context.owner,'wiki_query_context');
    const current=()=>check(api.contextKey()===key&&api.context().enabled,'wiki_query_context');
    return {context,key,current};
  }
  async function plan(question,selection={}){
    const a=action(),catalog=await api.book.approvedCatalog();a.current();
    const snapshot=await Q.selectWikiContext(question,catalog,selection);a.current();
    check(snapshot.scope.owner===a.context.owner&&snapshot.scope.url===String(a.context.url||'').replace(/\/+$/,''),'wiki_query_context');
    tickets.set(snapshot,{key:a.key});return snapshot;
  }
  async function planProtected(question,value,access){
    const a=action();check(access&&typeof access.guard==='function'&&typeof access.revalidate==='function'&&['local','server'].includes(access.origin),'wiki_query_protected_access');
    access.guard();await access.revalidate();a.current();access.guard();
    const scope={url:String(a.context.url||'').replace(/\/+$/,''),owner:a.context.owner},document=await NowNoteWiki.validateDocument(value,scope);a.current();access.guard();
    const approval=document.approvals.at(-1),draft=document.drafts.find(d=>d.id===approval?.draft_id);check(draft,'wiki_query_no_context');
    const catalog={scope,nodes:[{wiki_id:document.wiki_id,document_version:document.document_version,approval_id:approval.id,draft_id:draft.id,draft_hash:draft.draft_hash,
      origin:access.origin,protected:true,draft:structuredClone(draft)}],edges:[],excluded:0};
    const snapshot=await Q.selectWikiContext(question,catalog,{wiki_ids:[document.wiki_id],related_limit:0});a.current();access.guard();
    tickets.set(snapshot,{key:a.key,protectedAccess:access,catalog});return snapshot;
  }
  async function recheck(snapshot,a){
    a.current();const ticket=tickets.get(snapshot);check(ticket?.key===a.key,'wiki_query_context');await Q.verifySnapshot(snapshot);a.current();
    const selection=structuredClone(snapshot.selection);if(!selection.wiki_ids.length)delete selection.wiki_ids;
    let catalog;
    if(ticket.protectedAccess){ticket.protectedAccess.guard();await ticket.protectedAccess.revalidate();a.current();ticket.protectedAccess.guard();catalog=ticket.catalog;}
    else catalog=await api.book.approvedCatalog();a.current();
    const latest=await Q.selectWikiContext(snapshot.question,catalog,selection);a.current();
    check(P.canonicalJson(latest)===P.canonicalJson(snapshot),'wiki_query_source_changed');
  }
  async function run(snapshot,connection,options={}){
    check(options.confirmed===true,'wiki_query_consent');const a=action();
    check(connection&&typeof connection.invoke==='function'&&typeof connection.provider==='string'&&connection.provider.length>0
      &&typeof connection.model==='string'&&connection.model.length>0&&typeof connection.endpoint==='string'
      &&Number.isInteger(connection.outputTokens)&&connection.outputTokens>=1&&connection.outputTokens<=4096,'wiki_query_connection');
    await recheck(snapshot,a);const prompt=await Q.buildWikiQueryPrompt(snapshot);a.current();
    const response=await connection.invoke(prompt);a.current();
    await recheck(snapshot,a);const answer=await Q.validateWikiAnswer(response,snapshot);a.current();return answer;
  }
  return Object.freeze({plan,planProtected,run});
};
