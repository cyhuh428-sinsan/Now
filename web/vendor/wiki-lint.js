/* Deterministic audit only: no model, repair, persistence or content projection. */
(() => {
  'use strict';
  const W=NowNoteWiki,P=NowNoteProtectionProtocol;
  const check=(value,code='wiki_lint_invalid')=>{if(!value)throw Error(code);};
  const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(value);
  const equal=(a,b)=>P.canonicalJson(a)===P.canonicalJson(b);
  const latest=doc=>doc.drafts.find(d=>d.id===doc.approvals.at(-1)?.draft_id);
  async function lintWikiCatalog(snapshot,selection={}){
    check(snapshot&&snapshot.scope&&typeof snapshot.scope.owner==='string'&&snapshot.scope.owner&&typeof snapshot.scope.url==='string');
    check(Array.isArray(snapshot.rows)&&snapshot.rows.length<=100&&new Set(snapshot.rows.map(r=>r.id)).size===snapshot.rows.length);
    check(selection&&Object.keys(selection).every(k=>['wiki_ids','topic'].includes(k)));
    const ids=selection.wiki_ids??[],topic=selection.topic??'';
    check(Array.isArray(ids)&&ids.length<=100&&ids.every(uuid)&&new Set(ids).size===ids.length&&typeof topic==='string'&&topic.length<=240);
    check(!Object.hasOwn(selection,'wiki_ids')||ids.length>0);
    check(ids.every(id=>snapshot.rows.some(r=>r.id===id)),'wiki_lint_selection_unavailable');
    const report={checked:0,excluded:0,out_of_scope:0,errors:0,warnings:0,information:0,
      source_checked:0,source_excluded:0,relation_checked:0,relation_excluded:0,findings:[]};
    const valid=new Map(),state=new Map();
    for(const row of snapshot.rows){
      check(uuid(row.id));
      if(row.document?.scope&&!equal(row.document.scope,snapshot.scope)){state.set(row.id,'foreign');continue;}
      if(row.protected||row.deleted||row.unavailable||row.pending||!row.document){state.set(row.id,'excluded');continue;}
      if(![1,2].includes(row.document.schema_version)){state.set(row.id,'unsupported');continue;}
      try{
        const document=await W.validateDocument(row.document,snapshot.scope);check(document.wiki_id===row.id);
        valid.set(row.id,document);state.set(row.id,'valid');
      }catch{state.set(row.id,'invalid');}
    }
    const selected=new Set(snapshot.rows.filter(row=>(!ids.length||ids.includes(row.id))&&(!topic||latest(valid.get(row.id)||{drafts:[],approvals:[]})?.topic===topic)).map(r=>r.id));
    const finding=(row,rule,severity,observation,recommendation,extra={})=>{
      check(report.findings.length<5000,'wiki_lint_limit');
      report.findings.push({rule_code:rule,wiki_id:row?.id??null,document_version:valid.get(row?.id)?.document_version??null,
        severity,observation,recommendation,...extra});
      report[{error:'errors',warning:'warnings',information:'information'}[severity]]++;
    };
    const rows=new Map(snapshot.rows.map(r=>[r.id,r])),connected=new Set(),titles=new Map();
    for(const row of snapshot.rows){
      if(!selected.has(row.id)){report.out_of_scope++;continue;}
      const kind=state.get(row.id);
      if(kind==='foreign'){report.excluded++;finding(null,'wiki_lint_scope_excluded','information','현재 계정 밖의 자료를 제외했습니다.','현재 계정의 범위를 확인하세요.');continue;}
      if(row.origin==='server'&&row.index_status==='missing')finding(row,'wiki_lint_index_missing','error','서버 위키 색인을 확인하지 못했습니다.','현재 메모와 색인을 대조하세요.');
      if(kind==='excluded'||kind==='unsupported'){
        report.excluded++;finding(row,kind==='unsupported'?'wiki_lint_schema_unsupported':'wiki_lint_unreadable_excluded','information',
          kind==='unsupported'?'지원하지 않는 문서 형식입니다.':'보호·삭제·접근·미확정 상태로 본문을 검사하지 않았습니다.','접근 상태 또는 지원 버전을 확인하세요.');continue;
      }
      report.checked++;
      if(kind==='invalid'){finding(row,'wiki_lint_document_invalid','error','문서 형식·계정·판본·해시·승인 연결 검사에 실패했습니다.','원본을 보존하고 검증된 판본과 비교하세요.');continue;}
      const document=valid.get(row.id),approved=latest(document);
      if(document.schema_version===1)finding(row,'wiki_lint_legacy_document','information','기존 v1 문서입니다.','v1 읽기는 유지되며 확장은 명시 검토하세요.');
      if(!approved)finding(row,'wiki_lint_unapproved','information','승인된 판본이 없습니다.','초안과 출처를 검토하세요.');
      if(row.index_status==='unavailable')finding(row,'wiki_lint_index_unavailable','warning','색인 접근 결과를 확정할 수 없습니다.','연결·권한을 확인한 후 다시 검사하세요.');
      const sources=row.source_checks||[],relations=row.relation_checks||[];
      check(Array.isArray(sources)&&sources.length<=20000&&Array.isArray(relations)&&relations.length<=20000);
      let missing=false;
      for(const draft of document.drafts){
        for(const ref of W.evidenceOf(draft)){
          const outcome=sources.filter(v=>v.draft_id===draft.id&&v.evidence_id===ref.id);check(outcome.length<=1);
          const status=outcome[0]?.status;
          if(!status){missing=true;report.source_excluded++;continue;}
          check(['ok','changed','missing','quote_mismatch','foreign','unavailable','invalid','locked','unsupported'].includes(status));
          const excluded=['unavailable','locked','unsupported'].includes(status);
          if(excluded)report.source_excluded++;else report.source_checked++;
          if(ref.kind==='wiki'&&['ok','changed'].includes(status)&&approved?.id===draft.id){
            const target=valid.get(ref.wiki_id),chosen=target?.drafts.find(d=>d.id===ref.draft_id&&d.draft_hash===ref.content_hash);
            if(chosen&&target.approvals.some(a=>a.id===ref.approval_id&&a.draft_id===ref.draft_id)){connected.add(row.id);connected.add(ref.wiki_id);}
          }
          if(status==='ok')continue;
          const rule={changed:'source_changed',missing:'source_missing',quote_mismatch:'citation_mismatch',foreign:'foreign_reference',unavailable:'source_unavailable',invalid:'source_invalid',locked:'source_locked',unsupported:'source_unsupported'}[status];
          finding(row,'wiki_lint_'+rule,status==='changed'||excluded?'warning':'error','고정 출처 검사: '+status,
            status==='changed'?'고정 출처와 현재 판본을 비교하고 재적재를 검토하세요.':'출처의 계정·판본·인용·접근을 확인하세요.',{draft_id:draft.id,evidence_id:ref.id});
        }
        for(const relation of draft.relations||[]){
          const outcomes=relations.filter(r=>r.draft_id===draft.id&&r.relation_id===relation.id);check(outcomes.length<=1);
          let status=outcomes[0]?.status;
          const target=valid.get(relation.to_ref.wiki_id),targetRow=rows.get(relation.to_ref.wiki_id);
          if(!targetRow)status='missing_target';
          else if(state.get(targetRow.id)!=='valid')status='unavailable';
          else{
            const chosen=target.drafts.find(d=>d.id===relation.to_ref.draft_id),approval=target.approvals.find(a=>a.draft_id===chosen?.id);
            if(!chosen||!approval)status='unapproved';
            else if(relation.to_ref.kind==='approved'&&(relation.to_ref.draft_hash!==chosen.draft_hash
              ||!target.approvals.some(a=>a.id===relation.to_ref.approval_id&&a.draft_id===chosen.id)))status='binding_invalid';
            else if(relation.to_ref.section_id!==null&&!chosen.sections.some(s=>s.id===relation.to_ref.section_id))status='missing_section';
          }
          if(!status){missing=true;report.relation_excluded++;continue;}
          check(['ok','missing_target','missing_section','binding_invalid','unapproved','unavailable','stale'].includes(status));
          if(status==='unavailable')report.relation_excluded++;else report.relation_checked++;
          if(['ok','stale'].includes(status)&&approved?.id===draft.id){connected.add(row.id);connected.add(relation.to_ref.wiki_id);}
          if(status==='ok')continue;
          const rule={missing_target:'relation_target_missing',missing_section:'relation_section_missing',binding_invalid:'relation_binding_invalid',unapproved:'relation_unapproved',unavailable:'relation_unavailable',stale:'relation_stale'}[status];
          finding(row,'wiki_lint_'+rule,['unavailable','stale','unapproved'].includes(status)?'warning':'error','관계 검사: '+status,
            '관계 끝점의 승인 판본과 절을 확인하세요.',{draft_id:draft.id,relation_id:relation.id});
        }
      }
      if(missing)finding(row,'wiki_lint_verification_missing','warning','일부 출처·관계의 실제 조회 검증 결과가 없습니다.','제외된 검사 수를 확인하고 연결 후 다시 검사하세요.');
      if(approved)for(const key of new Set([approved.title,...(approved.aliases||[])].map(s=>s.normalize('NFKC').toLocaleLowerCase('ko').replace(/\s+/gu,' ').trim()).filter(Boolean))){
        const group=titles.get(key)||[];group.push(row);titles.set(key,group);
      }
    }
    for(const [id,doc]of valid)if(selected.has(id)&&latest(doc)&&!connected.has(id))
      finding(rows.get(id),'wiki_lint_orphan','information','검사 범위에서 검증된 연결이 없는 승인 페이지입니다.','잘못된 지식이라는 뜻은 아닙니다. 범위와 연결 필요성을 검토하세요.');
    const peers=new Map();
    for(const group of titles.values())if(group.length>1)for(const row of group){
      const related=peers.get(row.id)||new Set();for(const other of group)if(other.id!==row.id)related.add(other.id);peers.set(row.id,related);
    }
    for(const [id,related]of peers)finding(rows.get(id),'wiki_lint_duplicate_candidate','information','정규화한 제목·별칭이 같은 다른 승인 페이지가 있습니다.',
      '본문·출처를 비교하세요. 자동 병합하지 않습니다.',{related_wiki_ids:[...related].sort()});
    return report;
  }
  globalThis.NowWikiLint=Object.freeze({lintWikiCatalog});
})();
