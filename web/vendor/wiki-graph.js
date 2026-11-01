/* Ephemeral projection of verified approved pages, never a second source of truth. */
(() => {
  'use strict';
  const P=NowNoteProtectionProtocol,W=NowNoteWiki,copy=structuredClone;
  const check=(value,code='wiki_graph_invalid')=>{if(!value)throw Error(code);};
  const same=(a,b)=>P.canonicalJson(a)===P.canonicalJson(b);
  const scope=ctx=>({url:String(ctx.url||'').replace(/\/+$/,''),owner:ctx.owner});
  async function buildApprovedWikiCatalog(rows,context,{operations=[]}={}){
    check(Array.isArray(rows)&&Array.isArray(operations)&&context?.owner);
    const nodes=[],edges=[],findings=[],documents=new Map();let excluded=0;
    for(const row of rows){
      if(row?.available!==true||row.protected||row.deleted||row.unavailable||!row.document||!same(row.document.scope,scope(context))){excluded++;continue;}
      let document;
      try{document=await W.validateDocument(row.document,scope(context));}catch{excluded++;findings.push({code:'wiki_graph_invalid_document'});continue;}
      const approval=document.approvals.at(-1),draft=document.drafts.find(d=>d.id===approval?.draft_id);
      if(!draft){excluded++;continue;}
      check(!documents.has(document.wiki_id),'wiki_graph_duplicate');documents.set(document.wiki_id,document);
      nodes.push({wiki_id:document.wiki_id,title:draft.title,topic:draft.topic,summary:draft.summary||'',aliases:copy(draft.aliases||[]),
        document_version:document.document_version,approval_id:approval.id,draft_id:draft.id,draft_hash:draft.draft_hash,stale:row.stale===true,draft:copy(draft)});
      check(nodes.length<=100,'wiki_graph_limit');
    }
    const byId=new Map(nodes.map(node=>[node.wiki_id,node]));
    async function proposalBinding(relation,source,target){
      const ref=relation.to_ref;
      for(const operation of operations){
        if(operation?.operation_id!==ref.operation_id||!['ingest','integrate'].includes(operation.action)||operation.state!=='committed'
          ||!same(operation.scope&&{url:operation.scope.url,owner:operation.scope.owner},scope(context)))continue;
        const binds=node=>operation.documents?.some(d=>d.wiki_id===node.wiki_id&&d.draft_id===node.draft_id&&d.draft_hash===node.draft_hash)
          &&operation.reservation.pages?.some(p=>p.wiki_id===node.wiki_id&&p.draft_id===node.draft_id&&p.generation_id===node.draft.generation_id);
        const manifest=operation.manifest||operation.remote?.manifest;
        if(manifest){
          const unsigned=copy(manifest);delete unsigned.manifest_hash;
          if(manifest.operation_id!==operation.operation_id||manifest.owner_id!==context.owner||await P.hashJson(unsigned)!==manifest.manifest_hash)continue;
          if(![source,target].every(node=>manifest.draft_bindings?.some(b=>b.wiki_id===node.wiki_id&&b.draft_id===node.draft_id&&b.draft_hash===node.draft_hash)))continue;
        }else if(operation.reservation?.operation_id!==operation.operation_id||!binds(source)||!binds(target))continue;
        return true;
      }return false;
    }
    for(const source of nodes)for(const relation of source.draft.relations||[]){
      const ref=relation.to_ref,target=byId.get(ref.wiki_id),document=documents.get(ref.wiki_id);
      if(!target||source.wiki_id===target.wiki_id){findings.push({code:'wiki_graph_target_unavailable',wiki_id:source.wiki_id,relation_id:relation.id});continue;}
      const approval=document.approvals.find(a=>a.draft_id===ref.draft_id&&(ref.kind==='proposal'||a.id===ref.approval_id));
      const draft=document.drafts.find(d=>d.id===ref.draft_id);
      let bound=Boolean(approval&&draft&&(ref.section_id===null||draft.sections.some(s=>s.id===ref.section_id)));
      if(bound&&ref.kind==='approved')bound=draft.draft_hash===ref.draft_hash;
      if(bound&&ref.kind==='proposal')bound=await proposalBinding(relation,source,{...target,draft_id:draft.id,draft_hash:draft.draft_hash,draft});
      if(!bound){findings.push({code:'wiki_graph_binding_unverified',wiki_id:source.wiki_id,relation_id:relation.id});continue;}
      edges.push({id:source.wiki_id+':'+relation.id,source:source.wiki_id,target:target.wiki_id,type:relation.type,confidence:relation.confidence,
        from_section_id:relation.from_section_id,to_section_id:ref.section_id,citation_ids:copy(relation.citation_ids),
        source_draft_id:source.draft_id,target_draft_id:draft.id,target_approval_id:approval.id,target_draft_hash:draft.draft_hash,
        stale:source.stale||target.stale||target.draft_id!==draft.id||target.approval_id!==approval.id});
      check(edges.length<=2000,'wiki_graph_limit');
    }
    return {scope:scope(context),nodes,edges,excluded,findings};
  }
  function projectWikiGraph(catalog){
    return [...catalog.nodes.map(node=>({data:{id:node.wiki_id,label:node.title,stale:node.stale}})),
      ...catalog.edges.map(edge=>({data:{...copy(edge),label:edge.type}}))];
  }
  function planWikiIntegration(wikiId,catalog){
    check(catalog.nodes.some(node=>node.wiki_id===wikiId),'wiki_graph_target');
    return {wiki_id:wikiId,outgoing:copy(catalog.edges.filter(edge=>edge.source===wikiId)),incoming:copy(catalog.edges.filter(edge=>edge.target===wikiId))};
  }
  function findWikiPath(catalog,from,to,{directed=true}={}){
    check(catalog.nodes.some(node=>node.wiki_id===from)&&catalog.nodes.some(node=>node.wiki_id===to),'wiki_graph_target');
    check(typeof globalThis.cytoscape==='function','wiki_graph_library');
    const cy=cytoscape({headless:true,styleEnabled:false,elements:projectWikiGraph(catalog)});
    try{
      const result=cy.elements().dijkstra({root:cy.getElementById(from),directed}),target=cy.getElementById(to);
      if(!Number.isFinite(result.distanceTo(target)))return {nodes:[],edges:[],found:false};
      const path=result.pathTo(target),edgeIds=new Set(path.edges().map(edge=>edge.id()));
      return {nodes:path.nodes().map(node=>node.id()),edges:copy(catalog.edges.filter(edge=>edgeIds.has(edge.id))),found:true};
    }finally{cy.destroy();}
  }
  globalThis.NowWikiGraph=Object.freeze({buildApprovedWikiCatalog,projectWikiGraph,planWikiIntegration,findWikiPath});
})();
