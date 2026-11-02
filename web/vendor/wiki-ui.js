/* Wiki text stays in the existing Note journal; this view holds no durable cache. */
globalThis.mountNowWiki = function mountNowWiki(api,{host=null,onActivate=null}={}) {
  const embedded=Boolean(host),dialog=document.createElement(embedded?'section':'dialog');
  dialog.id='wikiDialog';dialog.className='library-dialog wiki-dialog';
  dialog.setAttribute('aria-labelledby','wikiTitle');
  if(embedded){dialog.classList.add('wiki-workspace');dialog.open=false;dialog.hidden=true;}
  let workspaceView='build';
  const tabs=embedded?document.createElement('div'):null;
  function activate(active){
    if(!embedded)return;
    if(!active)confirmation?.(false);
    host.classList.toggle('wiki-workspace-active',active);
    dialog.hidden=!active;
    for(const [id,selected]of [['wikiMemoTab',!active],['wikiWorkspaceTab',active]]){
      const button=tabs.querySelector('#'+id);button.setAttribute('aria-selected',String(selected));button.tabIndex=selected?0:-1;
    }
  }
  function show(){if(embedded){onActivate?.();dialog.open=true;tabs.hidden=false;host.classList.add('wiki-workspace-mounted');activate(true);}else dialog.showModal();}
  let rows=[],doc=null,dirty=false,busy=false,readable=false,epoch=0,bound='',message='',topic='',question='',confirmation=null,previous=null;
  let viewId='',beforeId='',comparing=false,readOnly=false,trashMode=false;
  let sourceMode=false,sourceRows=[],sourceFiles=[],sourcePreview='';
  let ingestPlan=null,ingestProposal=null,ingestOps=[];
  let graphCatalog=null,graphMount=null,graphSection='';
  let relationEditor=null;
  let queryMode=false,queryText='',queryScope='all',querySnapshot=null,queryAnswer=null,queryConnection=null;
  let queryOriginal=null;
  let protectedQueryAccess=null;
  let queryPrimary=6,queryRelated=3;
  let semanticReview=false;
  let lintMode=false,lintScope='all',lintSnapshot=null,lintReport=null,lintSelection=null;
  let lintOriginal=null;
  const lintIds=new Set();
  const queryIds=new Set();
  const ingestFiles=new Set(),ingestNotes=new Set();
  const selected=new Set();
  const node=(tag,text,className)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(className)n.className=className;return n;};
  const valid=token=>dialog.open&&token===epoch&&bound===api.contextKey();
  const preferred=value=>value&&(value.drafts.find(d=>d.id===value.approvals.at(-1)?.draft_id)||value.drafts.at(-1));
  const heading=row=>preferred(row.document)||(row.summary?.readable&&api.canReadSummary?.(row)?row.summary:null);
  const approvedRow=row=>Boolean(row.document?.approvals.length||heading(row)?.approved);
  const loadRows=options=>(api.listIndex||api.list)(options);
  async function fullRows(token){
    if(api.listIndex){const next=await api.list();requireActive(token);rows=next;}
  }
  async function catalog(token){
    await fullRows(token);const result=await api.approvedCatalog();requireActive(token);return result;
  }
  const current=()=>doc&&(doc.drafts.find(d=>d.id===viewId)||preferred(doc));
  const draftStatus=(value,draft)=>value.approvals.some(a=>a.draft_id===draft.id)?'승인본':value.rejected_draft_ids.includes(draft.id)?'반려됨':'초안';
  function choose(id){
    if(!doc?.drafts.some(d=>d.id===id))throw Error('선택한 위키 판본이 없습니다.');
    viewId=id;
    if(!beforeId||beforeId===id||!doc.drafts.some(d=>d.id===beforeId))
      beforeId=[...doc.drafts].reverse().find(d=>d.id!==id)?.id||'';
    selected.clear();for(const ref of NowNoteWiki.evidenceOf(current()))if(ref.kind!=='wiki')selected.add(ref.note_ref.local_id);
  }
  const draftText=draft=>[draft.title,draft.topic,...draft.sections.map(s=>s.title+'\n'+s.markdown),
    ...draft.citations.map(c=>'> '+c.quote)].join('\n\n');
  function close(){
    api.releaseReadPage?.();
    lintOriginal=null;
    semanticReview=false;
    lintMode=false;lintScope='all';lintSnapshot=null;lintReport=null;lintSelection=null;lintIds.clear();
    queryMode=false;queryText='';queryScope='all';querySnapshot=null;queryAnswer=null;queryConnection=null;queryOriginal=null;protectedQueryAccess=null;queryPrimary=6;queryRelated=3;queryIds.clear();
    graphMount?.destroy();graphMount=null;graphCatalog=null;graphSection='';relationEditor=null;
    epoch++;confirmation?.(false);confirmation=null;rows=[];doc=null;dirty=false;busy=false;readable=false;selected.clear();message='';question='';topic='';
    viewId='';beforeId='';comparing=false;readOnly=false;trashMode=false;
    sourceMode=false;sourceRows=[];sourceFiles=[];sourcePreview='';
    ingestPlan=null;ingestProposal=null;ingestOps=[];ingestFiles.clear();ingestNotes.clear();
    if(embedded){dialog.open=false;activate(false);tabs.hidden=true;host.classList.remove('wiki-workspace-mounted');}
    else if(dialog.open)dialog.close();
    dialog.replaceChildren();previous?.focus();
  }
  function check(){
    if(dialog.open&&rows.some(row=>row.summary?.readable&&!api.canReadSummary?.(row))){close();return;}
    if(dialog.open&&readOnly&&protectedQueryAccess){try{protectedQueryAccess.guard();}catch{close();return;}}
    if(dialog.open&&querySnapshot&&!readOnly&&querySnapshot.pages.some(page=>!api.canRead(rows.find(row=>row.document?.wiki_id===page.wiki_id)?.document||{scope:{},drafts:[]}))){close();return;}
    if(dialog.open&&api.canRead){
      const sensitive=new Set([...(relationEditor?.targets||[]).map(r=>r.wiki_id),...(current()?.relations||[]).map(r=>r.to_ref.wiki_id)]);
      if(rows.some(row=>sensitive.has(row.document?.wiki_id)&&!api.canRead(row.document))){close();return;}
    }
    if(dialog.open&&graphCatalog&&graphCatalog.nodes.some(page=>!api.canRead(rows.find(row=>row.document?.wiki_id===page.wiki_id)?.document||{scope:{},drafts:[]})))close();
    if(dialog.open&&(bound!==api.contextKey()||(!readOnly&&readable&&doc&&api.canRead&&!api.canRead(doc))))close();
  }
  function conceal(){
    lintOriginal=null;lintSelection=null;semanticReview=false;
    lintMode=false;lintSnapshot=null;lintReport=null;lintIds.clear();
    queryMode=false;queryText='';querySnapshot=null;queryAnswer=null;queryIds.clear();
    relationEditor=null;
    rows=rows.map(row=>({id:row.id||row.document?.wiki_id,unavailable:true,error:'출처·보호 상태 확인 필요'}));
    doc=null;dirty=false;readable=false;selected.clear();question='';topic='';
    viewId='';beforeId='';comparing=false;
    message='출처를 확인할 수 없어 내용을 표시하지 않습니다. 저장된 자료는 변경하지 않았습니다.';
  }
  function command(action,label,fn,disabled=false){
    const b=node('button',label,'secondary-btn');b.type='button';b.dataset.wikiAction=action;b.disabled=disabled||busy;
    b.onclick=()=>{
      if(!action.startsWith('lint')){lintMode=false;lintSnapshot=null;lintReport=null;}
      if(!readOnly||action.startsWith('query'))void execute(fn);
    };return b;
  }
  async function execute(fn,{hydrate=true}={}){
    check();if(!dialog.open||busy)return;
    const token=epoch;busy=true;readable=false;render();
    try{if(hydrate)await api.prepare?.();requireActive(token);await fn(token);}catch(error){if(valid(token))message=error.message;}
    finally{
      if(valid(token)&&doc&&readOnly){readable=true;message='보호된 저장 판본 · 읽기 전용';}
      if(valid(token)&&doc&&!readOnly){
        try{
          const state=await api.sourceStatus(current(),doc);requireActive(token);
          if(state.available!==true)conceal();
          else{readable=true;if(state.stale){const notice='원본 변경 · 갱신 검토가 필요합니다.';if(!message.includes(notice))message=(message?message+'\n':'')+notice;}else if(!message)message='출처 확인 완료';}
        }catch{if(valid(token))conceal();}
      }
      if(valid(token)){busy=false;render();}
    }
  }
  async function changeView(view,token){
    if(!['sources','build','lint','browse','query','graph'].includes(view))throw Error('위키 메뉴를 확인하세요.');
    if(dirty&&!await ask('저장하지 않은 초안을 닫고 이동할까요?'))return;
    requireActive(token);
    lintMode=false;lintSnapshot=null;lintReport=null;queryMode=false;querySnapshot=null;queryAnswer=null;queryOriginal=null;
    graphCatalog=null;sourceMode=false;trashMode=false;relationEditor=null;semanticReview=false;dirty=false;message='';
    workspaceView=view;doc=null;readable=false;
    if(view==='sources'){
      sourceRows=await api.sources.list();requireActive(token);
      if(api.ingest)await refreshOperations(token);
      sourceMode=true;
    }else if(view==='query')queryMode=true;
    else if(view==='lint')lintMode=true;
    else if(view==='graph'){graphCatalog=await catalog(token);requireActive(token);}
  }
  function requireActive(token){if(!valid(token))throw Error('계정·서버 또는 선택이 변경되었습니다.');}
  function requestClose(){
    if(confirmation){confirmation(false);return;}
    void execute(async token=>{
      if(dirty&&!await ask('저장하지 않은 초안을 닫을까요?'))return;
      requireActive(token);close();
    },{hydrate:false});
  }
  function ask(text,{send=false}={}){
    return new Promise(resolve=>{
      const panel=node('section',undefined,'library-confirm');panel.setAttribute('role','alertdialog');panel.setAttribute('aria-label','자료 전송 확인');
      const p=node('p',text),cancel=node('button','취소','secondary-btn'),ok=node('button',send?'전송 후 생성':'확인','primary-btn');
      cancel.type=ok.type='button';ok.dataset.wikiAction=send?'confirm-send':'confirm-change';cancel.dataset.wikiAction='cancel-send';
      const siblings=[...dialog.children];siblings.forEach(n=>{n.inert=true;});
      const finish=value=>{siblings.forEach(n=>{n.inert=false;});panel.remove();confirmation=null;resolve(value);};
      confirmation=finish;cancel.onclick=()=>finish(false);ok.onclick=()=>finish(true);
      panel.append(p,cancel,ok);dialog.prepend(panel);cancel.focus();
    });
  }
  async function generate(token){
    if(doc?.schema_version===2)throw Error('v2 위키 갱신은 자료 적재에서 원본과 계획을 검토하세요.');
    const snapshot=await api.capture([...selected]);requireActive(token);
    const connection=api.connection();
    const prompt=NowNoteWiki.prompt(snapshot,{question}),inputBytes=new TextEncoder().encode(prompt).length;
    if(inputBytes>524288)throw Error('전송 텍스트 합계는 512KiB를 넘을 수 없습니다. 자료를 줄여 다시 검토하세요.');
    const names=snapshot.sources.map(s=>s.title||s.manifest.note_ref.local_id).join(', ');
    const accepted=await ask(connection.provider+' · '+connection.model+'\n'+connection.endpoint+'\n자료 '+snapshot.sources.length+'개 · 전송 UTF-8 '+inputBytes+' bytes\n'+names
      +'\n요청 출력 상한 '+(connection.outputTokens||4096)+' tokens · 요청 1회'+(connection.reasoning?' · 추론 '+connection.reasoning:'')
      +(question.trim()?'\n질문: '+question.trim():'')+'\n선택한 원문을 전송하며 제공업체 비용이 발생할 수 있습니다. 정확한 과금과 모델 전체 context 한도는 확인되지 않았습니다.',{send:true});
    requireActive(token);if(!accepted)return;
    const latest=await api.capture([...selected]);requireActive(token);
    if(NowNoteProtectionProtocol.canonicalJson(latest)!==NowNoteProtectionProtocol.canonicalJson(snapshot))throw Error('원본 판본이 변경되었습니다. 전송 범위를 다시 확인하세요.');
    const answer=await connection.invoke(prompt);requireActive(token);
    const draft=await NowNoteWiki.validateDraft(answer,snapshot,connection,{baseApprovedRevisionId:doc?.approvals.at(-1)?.id||null});
    requireActive(token);
    if(doc){
      if(NowNoteProtectionProtocol.canonicalJson(doc.scope)!==NowNoteProtectionProtocol.canonicalJson(draft.scope))throw Error('기존 위키와 계정·서버가 다릅니다.');
      doc={...structuredClone(doc),document_version:doc.document_version+1,drafts:[...doc.drafts,draft]};
    }else doc={schema_version:1,document_version:1,wiki_id:crypto.randomUUID(),scope:structuredClone(draft.scope),drafts:[draft],approvals:[],rejected_draft_ids:[]};
    choose(draft.id);comparing=false;
    dirty=true;message='인용문을 확인한 뒤 초안을 저장하세요.';
  }
  async function queryPlan(token){
    const selection={...(queryScope==='selected'?{wiki_ids:[...queryIds]}:queryScope==='topic'?{topic}:{}),primary_limit:queryPrimary,related_limit:queryRelated};
    if(queryScope==='topic'&&!topic)throw Error('주제를 선택하세요.');
    if(!readOnly)await fullRows(token);
    const snapshot=readOnly?await api.query.planProtected(queryText,doc,protectedQueryAccess):await api.query.plan(queryText,selection);requireActive(token);
    querySnapshot=snapshot;queryAnswer=null;queryOriginal=null;message='';
  }
  async function queryRun(token){
    const snapshot=querySnapshot,connection=api.connection(semanticReview?'wiki-lint':'wiki-query');
    const prompt=await NowWikiQuery.buildWikiQueryPrompt(snapshot);requireActive(token);
    const bytes=new TextEncoder().encode(prompt).length;
    const accepted=await ask(connection.provider+' · '+connection.model+'\n'+connection.endpoint+'\n승인 위키 '+snapshot.pages.length+'개 · '+bytes+' bytes\n'
      +snapshot.pages.map(p=>p.draft.title+' · 판본 '+p.document_version).join('\n')+'\n요청 출력 상한 '+connection.outputTokens+' tokens · 요청 1회'
      +(connection.reasoning?' · 추론 '+connection.reasoning:'')+'\n선택한 승인 위키와 질문을 전송하며 제공업체 비용이 발생할 수 있습니다. 정확한 과금은 확인되지 않았습니다.',{send:true});
    requireActive(token);if(!accepted)return;
    queryAnswer=null;const result=await api.query.run(snapshot,connection,{confirmed:true});requireActive(token);
    if(querySnapshot!==snapshot)throw Error('질문 범위가 변경되었습니다.');
    queryAnswer=result;queryConnection={provider:connection.provider,model:connection.model};message='인용 확인 완료 · 내용의 사실성은 별도 검토가 필요합니다.';
  }
  async function querySave(token){
    const snapshot=querySnapshot,answer=queryAnswer;NowWikiQuery.assertSaveable(snapshot);
    if(!answer||!await ask('답변을 새 위키 초안으로 검토할까요? 사용한 모든 위키의 고정 판본과 보호 의존을 보존하며 승인은 별도입니다.'))return;
    requireActive(token);
    const response={query_hash:answer.query_hash,title:answer.title,claims:structuredClone(answer.claims),uncertainties:structuredClone(answer.uncertainties),
      citations:answer.citations.map(({originals,...cite})=>structuredClone(cite))};
    const result=await api.ingest.derive(snapshot,response,queryConnection);requireActive(token);
    ingestPlan={operation_id:result.operation_id,selection:result.selection,plan:result.proposal.plan};ingestProposal=result;
    sourceRows=await api.sources.list();requireActive(token);await refreshOperations(token);
    queryMode=false;querySnapshot=null;queryAnswer=null;queryConnection=null;sourceMode=true;message='초안의 인용과 보호 의존을 검토하세요.';
  }
  async function queryReadOriginal(ref,sectionId,quote,token){
    const proof=await api.readOriginal(ref);requireActive(token);
    const content=proof.kind==='note'?proof.content:proof.draft.sections.find(s=>s.id===sectionId)?.markdown;
    if(typeof content!=='string'||!content.includes(quote))throw Error('원본 판본·정확 인용이 다릅니다.');
    const links=proof.kind==='wiki'?proof.draft.citations.filter(c=>proof.draft.sections.find(s=>s.id===sectionId).citation_ids.includes(c.id))
      .map(c=>({ref:NowNoteWiki.evidenceOf(proof.draft).find(r=>r.id===(c.evidence_id||c.source_id)),section:c.section_id??null,quote:c.quote})):[];
    queryOriginal={content,hash:ref.content_hash,revision:ref.source_revision_id||ref.draft_id||'local',links};
  }
  function renderQuery(detail){
    const invalidate=()=>{
      querySnapshot=null;queryAnswer=null;queryOriginal=null;
      for(const element of detail.querySelectorAll('[data-wiki-query-preview],[data-wiki-query-answer],[data-wiki-query-original],[data-wiki-action=query-run]'))element.remove();
    };
    detail.append(node('h3',semanticReview?'AI 의미 검토 후보':'위키에 질문'));
    if(semanticReview)detail.append(node('p','모순·연결 누락은 AI의 검토 후보입니다. 결정적 Lint 결과와 구별하며 사실성은 원문으로 확인하세요.'));
    if(readOnly)detail.append(node('p','보호된 승인 판본 · 메모리에서만 사용 · 원본 최신성은 별도 확인'));
    const label=node('label','질문'),input=node('textarea',undefined,'settings-input');
    input.name='wiki-query-question';input.rows=3;input.maxLength=4000;input.value=queryText;input.disabled=busy;
    input.oninput=()=>{queryText=input.value;invalidate();};label.append(input);detail.append(label);
    const range=node('label','범위'),select=node('select',undefined,'settings-select');select.name='wiki-query-scope';select.disabled=busy||readOnly;
    for(const [value,title]of [['all','전체 승인 위키'],['topic','선택 주제'],['selected','선택 위키']]){const option=node('option',title);option.value=value;select.append(option);}
    select.value=queryScope;select.onchange=()=>{queryScope=select.value;querySnapshot=null;queryAnswer=null;render();};range.append(select);detail.append(range);
    if(!readOnly)for(const [name,title,value,min,max,change]of [
      ['wiki-query-primary','주요 위키 수',queryPrimary,1,6,v=>{queryPrimary=v;}],['wiki-query-related','관계 위키 수',queryRelated,0,3,v=>{queryRelated=v;}]
    ]){
      const label=node('label',title),number=node('input',undefined,'settings-input');number.type='number';number.name=name;number.min=min;number.max=max;number.step=1;number.value=value;number.disabled=busy;
      number.oninput=()=>{change(Number(number.value));invalidate();};label.append(number);detail.append(label);
    }
    if(queryScope==='selected')for(const row of rows){
      if(!approvedRow(row)||row.protected||row.deleted||row.unavailable)continue;
      const label=node('label'),input=node('input');input.type='checkbox';input.name='wiki-query-page';input.value=row.id||row.document.wiki_id;
      input.checked=queryIds.has(input.value);input.disabled=busy;
      input.onchange=()=>{if(input.checked)queryIds.add(input.value);else queryIds.delete(input.value);invalidate();};
      label.append(input,document.createTextNode(heading(row).title));detail.append(label);
    }
    detail.append(command('query-plan','근거 후보 확인',queryPlan));
    if(querySnapshot&&!busy){
      const preview=node('section',undefined,'wiki-query-preview');preview.dataset.wikiQueryPreview='';preview.append(node('h4','전송 자료'));
      for(const page of querySnapshot.pages)preview.append(node('p',page.draft.title+' · 판본 '+page.document_version+' · '+page.draft_hash.slice(0,12)));
      if(querySnapshot.relations.length){
        const paths=node('ul');paths.dataset.wikiQueryRelations='';
        const confidence={explicit:'직접 근거',inferred:'추론',uncertain:'불확실'},type={related_to:'관련',supports:'지지',contradicts:'반대',extends:'확장',depends_on:'의존'};
        for(const relation of querySnapshot.relations){
          const from=querySnapshot.pages.find(p=>p.wiki_id===relation.source),to=querySnapshot.pages.find(p=>p.wiki_id===relation.target);
          paths.append(node('li',from.draft.title+' -> '+to.draft.title+' · '+type[relation.type]+' · '+confidence[relation.confidence]));
        }
        preview.append(paths);
      }
      preview.append(node('p',new TextEncoder().encode(NowNoteProtectionProtocol.canonicalJson(querySnapshot)).length+' bytes'));
      detail.append(preview,command('query-run','전송 범위 확인',queryRun));
    }
    if(queryAnswer&&!busy){
      const answer=node('section');answer.dataset.wikiQueryAnswer='';answer.append(node('h3',queryAnswer.title));
      const status={supported:'인용 근거 있음',inferred:'추론',uncertain:'불확실',unsupported:'근거 없음'};
      for(const claim of queryAnswer.claims){
        const paragraph=node('p',claim.statement);paragraph.append(node('small',' · '+status[claim.assessment]));
        for(const id of claim.citation_ids){
          const link=node('a',' ['+id+']');link.href='#wiki-query-citation-'+id;
          link.onclick=event=>{event.preventDefault();document.getElementById('wiki-query-citation-'+id)?.scrollIntoView({block:'nearest'});};paragraph.append(link);
        }
        answer.append(paragraph);
      }
      for(const cite of queryAnswer.citations){
        const quote=node('blockquote','['+cite.id+'] '+cite.quote),page=querySnapshot.pages.find(p=>p.wiki_id===cite.wiki_id);quote.id='wiki-query-citation-'+cite.id;
        quote.append(command('query-wiki-source',page.draft.title+' · '+cite.section_id,async token=>{
          const ref={id:'query-source',kind:'wiki',origin:page.origin,owner_id:querySnapshot.scope.owner,wiki_id:page.wiki_id,draft_id:page.draft_id,
            approval_id:page.approval_id,document_version:page.document_version,content_hash:page.draft_hash};
          let proof;
          if(page.protected){
            protectedQueryAccess.guard();await protectedQueryAccess.revalidate();requireActive(token);protectedQueryAccess.guard();
            proof={currentDocument:doc,draft:doc.drafts.find(d=>d.id===page.draft_id&&d.draft_hash===page.draft_hash)};
          }else proof=await api.readEvidence(ref);requireActive(token);
          if(!proof.draft.sections.find(s=>s.id===cite.section_id)?.markdown.includes(cite.quote))throw Error('인용 판본·절이 다릅니다.');
          doc=structuredClone(proof.currentDocument);choose(proof.draft.id);graphSection=cite.section_id;queryMode=false;querySnapshot=null;queryAnswer=null;dirty=false;
        }));
        if(api.readOriginal)for(const source of cite.originals)quote.append(command('query-original-source','원본 고정 판본',token=>queryReadOriginal(source.evidence,source.section_id,source.quote,token)));
        answer.append(quote);
      }
      for(const value of queryAnswer.uncertainties)answer.append(node('p',value));
      if(api.ingest?.derive)answer.append(command('query-save','답변을 위키 초안으로 저장',querySave,queryAnswer.memory_only||!queryAnswer.citations.length));
      detail.append(answer);
      if(queryOriginal){
        const source=node('section');source.dataset.wikiQueryOriginal=queryOriginal.hash;source.append(node('h4','원본 고정 판본'),node('small',queryOriginal.revision+' · '+queryOriginal.hash));
        source.append(node('pre',queryOriginal.content,'wiki-source-preview'));
        for(const link of queryOriginal.links)source.append(command('query-original-source','원본 고정 판본',token=>queryReadOriginal(link.ref,link.section,link.quote,token)));
        detail.append(source);
      }
    }
  }
  function renderLint(detail){
    detail.append(node('h3','위키 점검'));
    const label=node('label','범위'),select=node('select',undefined,'settings-select');select.name='wiki-lint-scope';select.disabled=busy;
    for(const [value,title]of [['all','전체 위키'],['topic','선택 주제'],['selected','선택 위키']]){const option=node('option',title);option.value=value;select.append(option);}
    select.value=lintScope;select.onchange=()=>{lintScope=select.value;lintSnapshot=null;lintReport=null;render();};label.append(select);detail.append(label);
    if(lintScope==='selected')for(const row of rows){
      const id=row.id||row.document?.wiki_id;if(!id)continue;
      const label=node('label'),input=node('input');input.type='checkbox';input.name='wiki-lint-page';input.value=id;input.checked=lintIds.has(id);input.disabled=busy;
      input.onchange=()=>{if(input.checked)lintIds.add(id);else lintIds.delete(id);lintSnapshot=null;lintReport=null;render();};
      label.append(input,document.createTextNode(heading(row)?.title||'위키 '+id));detail.append(label);
    }
    detail.append(command('lint-run','점검',async token=>{
      if(lintScope==='topic'&&!topic)throw Error('주제를 선택하세요.');
      const selection=lintScope==='selected'?{wiki_ids:[...lintIds]}:lintScope==='topic'?{topic}:{};
      await fullRows(token);const snapshot=await api.lintSnapshot();requireActive(token);
      const report=await NowWikiLint.lintWikiCatalog(snapshot,selection);requireActive(token);
      lintSnapshot=snapshot;lintReport=report;lintSelection=structuredClone(selection);lintOriginal=null;message='';
    }));
    if(!lintReport||busy)return;
    const report=node('section');report.dataset.wikiLintReport='';
    report.append(node('h4','점검 결과'),node('p','검사 '+lintReport.checked+' · 제외 '+lintReport.excluded+' · 범위 밖 '+lintReport.out_of_scope),
      node('p','오류 '+lintReport.errors+' · 검토 '+lintReport.warnings+' · 정보 '+lintReport.information),
      node('p','출처 확인 '+lintReport.source_checked+' · 미확인/제외 '+lintReport.source_excluded+' · 관계 확인 '+lintReport.relation_checked+' · 미확인/제외 '+lintReport.relation_excluded));
    if(api.query)report.append(command('lint-ai','선택형 AI 의미 검토',async token=>{
      const snapshot=lintSnapshot,selection=lintSelection;
      const selected=snapshot.rows.filter(row=>(!selection.wiki_ids||selection.wiki_ids.includes(row.id))
        &&(!selection.topic||row.document?.drafts.find(d=>d.id===row.document.approvals.at(-1)?.draft_id)?.topic===selection.topic));
      if(selected.length!==lintReport.checked||selected.length>6||lintReport.excluded)throw Error('선택한 승인 위키 1~6개의 범위를 다시 확인하세요.');
      requireActive(token);semanticReview=true;queryMode=true;querySnapshot=null;queryAnswer=null;queryOriginal=null;
      queryText='선택한 위키의 내용 모순과 누락된 연결을 검토해 주세요. 정확한 인용을 붙이고, 근거가 없는 추론은 불확실한 후보로 구별하세요. 오류가 있다고 단정하거나 수정하지 마세요.';
      queryScope='selected';queryIds.clear();for(const row of selected)queryIds.add(row.id);queryPrimary=selected.length;queryRelated=0;
      lintMode=false;message='전송할 고정 판본을 확인한 뒤 별도로 동의하세요.';
    },lintReport.checked===0||lintReport.excluded>0||lintReport.checked>6));
    if(api.ingest?.deriveLint)report.append(command('lint-save','보고서를 위키 초안으로 저장',async token=>{
      const snapshot=lintSnapshot,selection=lintSelection,resultReport=lintReport;
      if(!await ask('점검 보고서를 새 위키 초안으로 검토할까요? 검사한 위키의 고정 판본과 보호 의존을 보존하며 승인은 별도입니다.'))return;
      requireActive(token);const result=await api.ingest.deriveLint(snapshot,selection,resultReport);requireActive(token);
      ingestPlan={operation_id:result.operation_id,selection:result.selection,plan:result.proposal.plan};ingestProposal=result;
      sourceRows=await api.sources.list();requireActive(token);await refreshOperations(token);
      lintMode=false;lintSnapshot=null;lintReport=null;lintSelection=null;sourceMode=true;message='보고서 초안과 인용·의존을 검토하세요.';
    },lintReport.checked===0||lintReport.excluded>0||lintReport.checked>30));
    const severities={error:'오류',warning:'검토 필요',information:'정보'};
    for(const finding of lintReport.findings){
      const item=node('section');item.dataset.lintRule=finding.rule_code;
      item.append(node('h4',severities[finding.severity]+' · '+finding.rule_code),node('p',finding.observation),node('p',finding.recommendation));
      if(finding.wiki_id){
        item.append(node('small',finding.wiki_id+' · 판본 '+(finding.document_version??'미확인')));
        const row=lintSnapshot.rows.find(r=>r.id===finding.wiki_id);
        const draft=finding.evidence_id&&Array.isArray(row?.document?.drafts)?row.document.drafts.find(d=>d?.id===finding.draft_id):null;
        const ref=draft&&NowNoteWiki.evidenceOf(draft).find(r=>r.id===finding.evidence_id);
        if(ref&&api.readOriginal&&!row.protected&&!row.deleted&&!row.unavailable)item.append(command('lint-original','원본 고정 판본',async token=>{
          const proof=await api.readOriginal(ref);requireActive(token);
          lintOriginal={hash:ref.content_hash,revision:ref.source_revision_id||ref.draft_id||'local',
            content:proof.kind==='note'?proof.content:proof.draft.sections.map(s=>s.title+'\n'+s.markdown).join('\n\n')};
        }));
        const openRow=async token=>{
          const value=await NowNoteWiki.validateDocument(row.document,lintSnapshot.scope);requireActive(token);
          if(!api.canRead(value))throw Error('위키 접근 상태가 변경되었습니다.');
          workspaceView='browse';lintMode=false;lintSnapshot=null;lintReport=null;doc=structuredClone(value);choose(preferred(doc).id);dirty=false;message='';
        };
        if(row?.document&&!row.protected&&!row.deleted&&!row.unavailable){
          item.append(command('lint-open','위키 검토',openRow));
          if(api.ingest?.integrate&&api.approvedCatalog&&row.document.approvals?.length)item.append(command('lint-integrate','관계 검토',async token=>{
            const value=await NowNoteWiki.validateDocument(row.document,lintSnapshot.scope),draft=preferred(value);
            const graph=await catalog(token);requireActive(token);
            const source=graph.nodes.find(n=>n.wiki_id===value.wiki_id),targets=graph.nodes.filter(n=>n.wiki_id!==value.wiki_id);
            if(!source||source.draft_hash!==draft.draft_hash||source.document_version!==value.document_version||!targets.length)throw Error('현재 승인 판본과 관계 대상을 다시 점검하세요.');
            await openRow(token);
            workspaceView='build';
            relationEditor={wiki_id:value.wiki_id,draft_id:draft.id,targets,target:targets[0].wiki_id,type:'related_to',confidence:'inferred',from:'',to:'',citations:draft.citations.slice(0,1).map(c=>c.id)};
          }));
        }
        if(api.sources&&api.ingest)item.append(command('lint-reingest','재적재 검토',async token=>{
          const next=await api.sources.list();requireActive(token);await refreshOperations(token);
          lintMode=false;lintSnapshot=null;lintReport=null;lintOriginal=null;doc=null;dirty=false;sourceMode=true;trashMode=false;graphCatalog=null;relationEditor=null;
          sourceRows=next;sourceFiles=[];sourcePreview='';ingestPlan=null;ingestProposal=null;ingestFiles.clear();ingestNotes.clear();message='';
        }));
      }
      report.append(item);
    }
    if(lintOriginal){
      const original=node('section');original.dataset.wikiLintOriginal='';original.append(node('h4','원본 고정 판본'),node('small',lintOriginal.revision+' · '+lintOriginal.hash),node('pre',lintOriginal.content,'wiki-source-preview'));report.append(original);
    }
    detail.append(report);
  }
  async function refreshOperations(token){ingestOps=await api.ingest.operations();requireActive(token);}
  async function saveServer(operationId,token){
    // Advance only receipt-confirmed stages; uncertain outcomes require an explicit status check.
    for(let step=0;step<3;step++){
      await refreshOperations(token);
      const operation=ingestOps.find(item=>item.operation_id===operationId),phase=operation?.remote?.phase;
      const method={staged:'prepareServer',prepared:'commitServer',server_committed:'applyServer'}[phase];
      if(!method)break;
      await api.ingest[method](operationId);requireActive(token);
    }
    await refreshOperations(token);rows=await loadRows();requireActive(token);
    const operation=ingestOps.find(item=>item.operation_id===operationId);
    message=operation?.remote?.phase==='settled'
      ?operation.action==='approve'?'서버·로컬 승인 반영 완료':'서버·로컬 초안 반영 완료 · 승인 전'
      :'저장 상태 확인 필요 · 자동 재전송하지 않았습니다.';
  }
  function relationText(draft){
    const names=new Map(rows.filter(r=>r.document&&!r.protected&&!r.deleted).map(r=>[r.document.wiki_id,preferred(r.document)?.title||'위키']));
    const types={related_to:'관련',supports:'뒷받침',contradicts:'상충',extends:'확장',depends_on:'의존'},confidence={explicit:'직접 근거',inferred:'추론',uncertain:'불확실'};
    return (draft?.relations||[]).map(r=>[r.id,types[r.type],confidence[r.confidence],names.get(r.to_ref.wiki_id)||'대상 확인 필요',r.to_ref.draft_id,r.to_ref.section_id||'전체',r.citation_ids.join(', ')].join(' · ')).join('\n');
  }
  function renderRelationEditor(detail,draft){
    const editor=relationEditor;if(!editor||editor.wiki_id!==doc.wiki_id||editor.draft_id!==draft.id)return;
    const form=node('fieldset');form.dataset.wikiIntegration='';form.append(node('legend','관계 추가'));
    const select=(name,labelText,values,value,change)=>{
      const label=node('label',labelText),input=node('select',undefined,'settings-select');input.name=name;input.disabled=busy;
      for(const [id,text]of values){const option=node('option',text);option.value=id;input.append(option);}input.value=value;
      input.onchange=()=>{change(input.value);};label.append(input);form.append(label);return input;
    };
    const target=editor.targets.find(r=>r.wiki_id===editor.target);
    select('wiki-relation-target','대상 위키',editor.targets.map(r=>[r.wiki_id,r.title+(r.stale?' · 원본 변경':'')]),editor.target,value=>{editor.target=value;editor.to='';render();});
    select('wiki-relation-type','관계 유형',[['related_to','관련'],['supports','뒷받침'],['contradicts','상충'],['extends','확장'],['depends_on','의존']],editor.type,value=>editor.type=value);
    select('wiki-relation-confidence','근거 상태',[['explicit','직접 근거'],['inferred','추론'],['uncertain','불확실']],editor.confidence,value=>editor.confidence=value);
    select('wiki-relation-from','시작 절',[['','페이지 전체'],...draft.sections.map(s=>[s.id,s.title])],editor.from,value=>editor.from=value);
    select('wiki-relation-to','대상 절',[['','페이지 전체'],...(target?.draft.sections||[]).map(s=>[s.id,s.title])],editor.to,value=>editor.to=value);
    const citations=node('fieldset');citations.append(node('legend','인용 근거'));
    for(const c of draft.citations){const label=node('label'),input=node('input');input.type='checkbox';input.name='wiki-relation-citation';input.value=c.id;input.checked=editor.citations.includes(c.id);input.disabled=busy;
      input.onchange=()=>{editor.citations=editor.citations.filter(id=>id!==c.id);if(input.checked)editor.citations.push(c.id);};label.append(input,document.createTextNode(c.quote));citations.append(label);}
    form.append(citations,command('preview-integrate','관계 초안 비교',async token=>{
      const chosen=editor.targets.find(r=>r.wiki_id===editor.target);if(!chosen)throw Error('관계 대상을 선택하세요.');
      const relation={id:crypto.randomUUID(),from_section_id:editor.from||null,to_ref:{kind:'approved',wiki_id:chosen.wiki_id,draft_id:chosen.draft_id,approval_id:chosen.approval_id,draft_hash:chosen.draft_hash,section_id:editor.to||null},
        type:editor.type,confidence:editor.confidence,citation_ids:structuredClone(editor.citations)};
      const result=await api.ingest.integrate(editor.wiki_id,relation);requireActive(token);
      ingestProposal=result;ingestPlan={operation_id:result.operation_id,selection:result.selection,plan:result.proposal.plan};
      sourceRows=await api.sources.list();requireActive(token);await refreshOperations(token);
      sourceMode=true;relationEditor=null;message='관계 변경을 검토한 뒤 초안을 저장하세요. · 모델 호출 없음';
    },!target),command('cancel-integrate','취소',async()=>{relationEditor=null;}));detail.append(form);
  }
  async function generateIngest(token){
    const operation=ingestPlan,connection=api.connection(),prompt=api.ingest.prompt(operation);
    const input=operation.plan.transmission;
    const accepted=await ask(connection.provider+' · '+connection.model+'\n'+connection.endpoint
      +'\n원본 '+input.sources.length+'개 · 근거 위키 '+input.related_wikis.length+'개 · 비교 위키 '+input.comparison_targets.length+'개'
      +'\n'+input.sources.map(s=>s.title).join(', ')+'\n전송 UTF-8 '+new TextEncoder().encode(prompt).length+' bytes'
      +'\n요청 출력 상한 '+connection.outputTokens+' tokens · 요청 1회'+(connection.reasoning?' · 추론 '+connection.reasoning:'')
      +'\n원작업 '+operation.operation_id+'\n선택한 원문을 전송하며 제공업체 비용이 발생할 수 있습니다. 정확한 과금과 모델 전체 context 한도는 확인되지 않았습니다.',{send:true});
    requireActive(token);if(!accepted)return;
    try{const result=await api.ingest.generate(operation,connection);requireActive(token);ingestProposal=result;message='대상별 차이와 인용을 검토하세요.';}
    finally{if(valid(token))await refreshOperations(token);}
  }
  async function lifecycle(row,method,token){
    const id=row.id||row.document?.wiki_id;
    const prompt=method==='trash'?'위키를 휴지통으로 이동할까요? 원문과 저장 이력은 보존됩니다.':method==='restoreWiki'?'위키를 복원할까요?'
      :method==='reconcileLifecycle'?'거부된 요청 대신 서버의 현재 상태를 확인해 반영할까요?':'보존된 같은 요청의 처리 결과를 다시 확인할까요?';
    if(!await ask(prompt+(dirty&&doc?.wiki_id===id?' 저장하지 않은 초안은 닫힙니다.':'')))return;
    requireActive(token);let issue;
    try{await api[method](id);requireActive(token);}catch(error){requireActive(token);issue=error;}
    const next=await loadRows();requireActive(token);rows=next;
    if(doc?.wiki_id===id){doc=null;dirty=false;readable=false;selected.clear();question='';viewId='';beforeId='';comparing=false;}
    trashMode=Boolean(rows.find(r=>(r.id||r.document?.wiki_id)===id)?.deleted);topic='';
    if(issue)throw issue;
    message=rows.find(r=>(r.id||r.document?.wiki_id)===id)?.lifecycle?.pending?'요청 보존 · 처리 결과 확인 필요'
      :method==='trash'?'휴지통으로 이동했습니다.':method==='restoreWiki'?'위키를 복원했습니다.':'현재 상태를 확인했습니다.';
  }
  function render(){
    if(!dialog.open)return;
    check();if(!dialog.open)return;
    graphMount?.destroy();graphMount=null;dialog.replaceChildren();
    const activeView=sourceMode?'sources':lintMode?'lint':queryMode?'query':graphCatalog?'graph':workspaceView;
    dialog.dataset.wikiView=activeView;
    for(const button of document.querySelectorAll('#wikiActionGroup [data-wiki-view]'))button.setAttribute('aria-current',String(button.dataset.wikiView===activeView));
    const titles={sources:'자료함',build:'위키 작성·검토',lint:'위키 점검',browse:'위키 찾아보기',query:'위키에 질문',graph:'관계 탐색'};
    const header=node('header',undefined,'library-header');header.append(node('h2',embedded?titles[activeView]:'AI 지식 위키'));
    header.firstChild.id='wikiTitle';
    header.firstChild.tabIndex=-1;
    const exit=node('button','닫기','ghost-btn');exit.type='button';exit.disabled=busy;exit.onclick=requestClose;header.append(exit);
    const toolbar=node('div',undefined,'library-toolbar');
    if(!readOnly&&api.lintSnapshot)toolbar.append(command('lint','위키 점검',async token=>{
      if(dirty&&!await ask('저장하지 않은 초안을 닫고 점검할까요?'))return;
      requireActive(token);workspaceView='lint';lintMode=true;lintSnapshot=null;lintReport=null;queryMode=false;querySnapshot=null;queryAnswer=null;graphCatalog=null;sourceMode=false;doc=null;dirty=false;trashMode=false;message='';
    }));
    if(!readOnly)toolbar.append(command('new','새 위키',async token=>{
      if(dirty&&!await ask('저장하지 않은 초안을 버리고 새 위키를 만들까요?'))return;
      requireActive(token);workspaceView='build';sourceMode=false;queryMode=false;querySnapshot=null;queryAnswer=null;graphCatalog=null;doc=null;dirty=false;selected.clear();message='';question='';viewId='';beforeId='';comparing=false;trashMode=false;
    }),command('refresh','동기화',async token=>{const next=await loadRows({sync:true});requireActive(token);rows=next;graphCatalog=null;message='목록을 갱신했습니다.';}));
    if(!readOnly&&api.approvedCatalog)toolbar.append(command('graph','관계 탐색',async token=>{
      if(dirty&&!await ask('저장하지 않은 초안을 닫고 관계를 탐색할까요?'))return;
      requireActive(token);const graph=await catalog(token);requireActive(token);
      workspaceView='graph';queryMode=false;querySnapshot=null;queryAnswer=null;graphCatalog=graph;sourceMode=false;doc=null;dirty=false;readable=false;trashMode=false;selected.clear();
      message=graph.excluded?'표시 제외 '+graph.excluded+'개':'';
    }));
    if(api.query&&(!readOnly||protectedQueryAccess))toolbar.append(command('query','위키에 질문',async token=>{
      if(dirty&&!await ask('저장하지 않은 초안을 닫고 질문할까요?'))return;
      requireActive(token);workspaceView='query';semanticReview=false;queryMode=true;querySnapshot=null;queryAnswer=null;graphCatalog=null;sourceMode=false;if(!readOnly)doc=null;dirty=false;trashMode=false;message='';
    }));
    if(!readOnly&&api.sources)toolbar.append(command('sources',sourceMode?'지식 탐색':'자료 적재',async token=>{
      const next=sourceMode?[]:await api.sources.list();requireActive(token);
      queryMode=false;querySnapshot=null;queryAnswer=null;graphCatalog=null;
      if(api.ingest)await refreshOperations(token);
      sourceRows=next;sourceMode=!sourceMode;workspaceView=sourceMode?'sources':'build';sourcePreview='';sourceFiles=[];message='';
    },dirty));
    if(!readOnly&&api.trash&&api.restoreWiki){
      const label=node('label','휴지통','wiki-trash-toggle'),input=node('input');input.type='checkbox';input.name='wiki-trash';input.checked=trashMode;input.disabled=busy;
      input.onchange=()=>{const value=input.checked;void execute(async token=>{
        if(dirty&&!await ask('저장하지 않은 초안을 닫고 목록을 바꿀까요?'))return;
        requireActive(token);graphCatalog=null;trashMode=value;doc=null;dirty=false;readable=false;selected.clear();question='';topic='';viewId='';beforeId='';comparing=false;
      });};label.prepend(input);toolbar.append(label);
    }
    const status=node('p',message);status.setAttribute('role','status');status.setAttribute('aria-live','polite');
    const layout=node('div',undefined,'library-layout wiki-layout'),nav=node('nav');nav.setAttribute('aria-label','주제별 위키');
    const filter=node('select',undefined,'settings-select');filter.setAttribute('aria-label','주제');
    for(const name of ['',...new Set((busy?[]:rows).map(r=>heading(r)?.topic).filter(Boolean))]){
      const option=node('option',name||'전체 주제');option.value=name;filter.append(option);
    }
    filter.value=topic;filter.disabled=busy;filter.onchange=()=>{
      topic=filter.value;if(queryMode){querySnapshot=null;queryAnswer=null;queryOriginal=null;queryConnection=null;}if(lintMode){lintSnapshot=null;lintReport=null;}render();
    };nav.append(filter);
    for(const row of rows){
      if(Boolean(row.deleted)!==trashMode)continue;
      if(workspaceView==='browse'&&!trashMode&&!approvedRow(row)&&!row.protected&&!row.unavailable)continue;
      const last=heading(row),pendingCheck=busy||(doc&&(row.document?.wiki_id||row.id)===doc.wiki_id&&!readable);
      if(topic&&last?.topic!==topic)continue;
      const item=node('button',undefined,'library-item');item.type='button';item.disabled=busy||Boolean(row.deleted||row.lifecycle?.pending);
      const title=node('span',pendingCheck?'위키 확인 중':last?.title||(row.protected?'보호된 위키':'위키 '+(row.id||'')));
      const info=node('small',pendingCheck?'출처 확인 중':row.lifecycle?.pending?(row.lifecycle.pending.rejected?'현재 상태 확인 필요':'처리 결과 확인 필요'):row.deleted?'휴지통':row.error|| (row.protected?'잠금 상태':row.pending?'전송 대기':row.localOnly?'이 기기에 보관':last?.topic||''));
      item.append(title,info);item.setAttribute('aria-current',String(Boolean(doc&&doc.wiki_id===(row.document?.wiki_id||row.id))));
      item.onclick=()=>execute(async token=>{
        if(dirty&&!await ask('저장하지 않은 초안을 버리고 선택한 위키를 열까요?'))return;
        requireActive(token);
        let page=row;
        if(row.deferred&&api.readPage){
          page=await api.readPage(row.id);requireActive(token);
          rows=rows.map(value=>value===row?page:value);
        }
        if(page.protected||!page.document){
          if(page.protected&&api.openProtection){await api.openProtection(page.id);return;}
          doc=null;dirty=false;selected.clear();message=page.error||'보호된 위키입니다. 전체 보호 화면에서 잠금을 해제하세요.';return;
        }
        lintMode=false;lintSnapshot=null;lintReport=null;queryMode=false;querySnapshot=null;queryAnswer=null;graphCatalog=null;doc=structuredClone(page.document);dirty=false;selected.clear();question='';
        sourceMode=false;sourceFiles=[];sourceRows=[];sourcePreview='';
        if(!['build','browse'].includes(workspaceView))workspaceView='browse';
        choose(workspaceView==='build'?doc.drafts.at(-1).id:preferred(doc).id);comparing=false;
        message='';
      },{hydrate:!row.deferred||!api.readPage});
      const entry=node('div',undefined,'wiki-entry');entry.append(item);
      if(!readOnly&&api.trash&&api.restoreWiki){
        const controls=node('div',undefined,'wiki-entry-controls'),id=row.id||row.document?.wiki_id;entry.dataset.wikiId=id;
        if(row.lifecycle?.pending){
          const method=row.lifecycle.pending.rejected?'reconcileLifecycle':'retryLifecycle';
          controls.append(command(method,row.lifecycle.pending.rejected?'현재 상태':'다시 확인',token=>lifecycle(row,method,token)));
        }else controls.append(command(row.deleted?'restore':'trash',row.deleted?'복원':'휴지통',token=>lifecycle(row,row.deleted?'restoreWiki':'trash',token)));
        entry.append(controls);
      }
      nav.append(entry);
    }
    if(!nav.querySelector('.wiki-entry'))nav.append(node('p',trashMode?'휴지통이 비어 있습니다.':workspaceView==='browse'?'승인된 위키 없음':'저장된 위키 없음'));
    const detail=node('section',undefined,'wiki-detail');detail.setAttribute('aria-label','위키 검토');
    if(lintMode)renderLint(detail);
    if(queryMode)renderQuery(detail);
    if(sourceMode&&api.sources){
      detail.append(node('h3','원본 자료'));
      const label=node('label','파일 선택'),files=node('input');files.type='file';files.name='wiki-files';files.accept='.md,.txt';files.multiple=true;files.disabled=busy;
      const sourceToken=epoch,sourceContext=bound;
      files.onchange=()=>{
        if(!valid(sourceToken)||bound!==sourceContext||!sourceMode||!files.isConnected)return;
        sourceFiles=Array.from(files.files||[]);message='';render();
      };label.append(files);detail.append(label);
      if(sourceFiles.length)detail.append(node('p',sourceFiles.map(f=>f.name).join(', ')));
      detail.append(command('capture-files','원본 저장',async token=>{
        try{
          const result=await api.sources.captureFiles([...sourceFiles]);requireActive(token);
          sourceRows=await api.sources.list();requireActive(token);
          message='이 기기에 원본 '+result.created+'개 저장 · 변경 없음 '+result.unchanged+'개';
        }finally{if(valid(token))sourceFiles=[];}
      },!sourceFiles.length));
      const list=node('ul',undefined,'wiki-source-list');list.setAttribute('aria-label','저장된 원본 자료');
      for(const source of sourceRows){
        const row=node('li'),button=node('button',source.protected?'보호된 원본':source.title,'ghost-btn');button.type='button';button.disabled=busy||source.protected;
        button.dataset.wikiSourceId=source.id;button.onclick=()=>{sourcePreview=source.id;render();};
        if(api.ingest){const label=node('label'),input=node('input');input.type='checkbox';input.name='wiki-ingest-file';input.value=source.id;
          input.checked=ingestFiles.has(source.id);input.disabled=busy||source.protected||Boolean(ingestPlan);
          input.onchange=()=>{if(!valid(sourceToken)||!input.isConnected||!sourceMode||busy)return;if(input.checked)ingestFiles.add(source.id);else ingestFiles.delete(source.id);};
          label.append(input,button);row.append(label);
        }else row.append(button);
        if(!source.protected)row.append(node('small',(source.unavailable?'서버 확인 필요':source.manifest.origin==='server'?'서버 판본 '+source.manifest.head_version:'이 기기')+' · '+source.extraction.range.total+' bytes'));list.append(row);
      }
      detail.append(list);
      const preview=sourceRows.find(s=>s.id===sourcePreview&&!s.protected);
      if(preview){const text=node('pre',preview.content,'history-diff wiki-source-preview');text.tabIndex=0;text.setAttribute('aria-label','원본 텍스트');detail.append(text);}
      if(!sourceRows.length)detail.append(node('p','저장된 원본 없음'));
      if(api.ingest){
        if(api.sources.publishFiles)detail.append(command('publish-sources','선택 텍스트 게시',async token=>{
          const ids=[...ingestFiles],info=await api.sources.publicationInfo(ids);requireActive(token);
          if(!await ask(info.server+'\n계정 '+info.owner+'\n'+info.names.join(', ')+'\n추출 텍스트 '+info.bytes+' bytes를 서버 메모로 게시할까요? 원본 파일 자체는 전송하지 않습니다.'))return;
          requireActive(token);const result=await api.sources.publishFiles(ids,{confirmed:true});requireActive(token);
          sourceRows=await api.sources.list();requireActive(token);message='서버 판본 확보 '+result.published+'개 · 확인 필요 '+result.pending+'개';
        },Boolean(ingestPlan)));
        const notes=node('fieldset');notes.append(node('legend','NowNote 메모'));
        for(const source of api.notes()){
          const label=node('label'),input=node('input');input.type='checkbox';input.name='wiki-ingest-note';input.value=source.id;
          input.checked=ingestNotes.has(source.id);input.disabled=busy||Boolean(ingestPlan);
          input.onchange=()=>{if(!valid(sourceToken)||!input.isConnected||!sourceMode||busy)return;if(input.checked)ingestNotes.add(source.id);else ingestNotes.delete(source.id);};
          label.append(input,document.createTextNode(source.title||'제목 없음'));notes.append(label);
        }detail.append(notes);
        if(!ingestPlan)detail.append(command('plan-ingest','적재 계획 검토',async token=>{
          const result=await api.ingest.plan({fileIds:[...ingestFiles],noteIds:[...ingestNotes]});requireActive(token);
          ingestPlan=result;ingestProposal=null;await refreshOperations(token);message=result.plan.calls?'적재 계획을 확인하세요.':'변경 없음 · 모델 호출 없음';
        }));
        if(ingestPlan){
          const plan=ingestPlan.plan,summary=node('ul');summary.setAttribute('aria-label','적재 계획');
          for(const candidate of plan.candidates){const source=plan.snapshot.sources.find(s=>s.id===candidate.source_id);
            summary.append(node('li',(source?.title||candidate.source_id)+' · '+({new:'신규',augment:'보강 후보',unchanged:'변경 없음'}[candidate.action])));}
          detail.append(summary);
          if(plan.calls&&!ingestProposal&&ingestOps.find(o=>o.operation_id===ingestPlan.operation_id)?.state==='reserved')
            detail.append(command('generate-ingest','전송 범위 확인',generateIngest));
          if(!plan.calls)detail.append(command('clear-ingest','다른 자료 선택',async()=>{ingestPlan=null;}));
        }
        if(ingestProposal){
          for(const entry of ingestProposal.proposal.documents){
            const draft=entry.document.drafts.at(-1),section=node('section');section.dataset.wikiProposal=entry.wiki_id;
            section.append(node('h3',draft.title));
            const old=ingestPlan.plan.targets.find(t=>t.document.wiki_id===entry.wiki_id),before=old?preferred(old.document):null;
            const diff=node('pre',undefined,'history-diff wiki-diff');diff.tabIndex=0;diff.setAttribute('aria-label','적재 제안 차이');
            const changes=Diff.diffLines(before?draftText(before):'',draftText(draft),{timeout:1500});
            if(!changes)diff.textContent='비교 시간이 초과되었습니다. 저장하지 않았습니다.';
            else for(const part of changes)diff.append(node(part.added?'ins':part.removed?'del':'span',part.value));
            section.append(diff);
            const beforeRelations=relationText(before),afterRelations=relationText(draft);
            if(beforeRelations!==afterRelations){const relations=node('pre',undefined,'history-diff wiki-diff');relations.tabIndex=0;relations.setAttribute('aria-label','관계 변경');
              const changes=Diff.diffLines(beforeRelations,afterRelations,{timeout:1500});
              if(changes)for(const part of changes)relations.append(node(part.added?'ins':part.removed?'del':'span',part.value));else relations.textContent='비교 시간을 초과했습니다.';
              section.append(relations);}
            detail.append(section);
          }
          detail.append(command('commit-ingest','초안 일괄 저장',async token=>{
            const remote=ingestProposal.proposal.plan.serverEligible;
            const result=remote?await api.ingest.stageServer(ingestProposal):await api.ingest.commitLocal(ingestProposal);requireActive(token);
            rows=await loadRows();requireActive(token);ingestPlan=null;ingestProposal=null;await refreshOperations(token);
            message=remote?'서버 반영 초안 보존 · 준비 요청 전':'이 기기에 초안 '+result.documents.length+'개 저장 · 승인 전';
          }));
        }
        const pendingOperations=ingestOps.filter(operation=>operation.remote&&['staged','prepared','server_committed'].includes(operation.remote.phase));
        for(const operation of pendingOperations){
          const save=node('div',undefined,'wiki-save-progress');save.append(node('span',operation.action==='approve'?'승인 기록 · 서버 반영 대기':'위키 초안 · 서버 반영 대기'),
            command('save-server','서버에 반영',token=>saveServer(operation.operation_id,token)));
          save.dataset.wikiOperation=operation.operation_id;detail.append(save);
        }
        const operations=node('details');operations.className='wiki-operation-details';operations.append(node('summary','저장 상태·복구 ('+ingestOps.length+')'));
        for(const operation of ingestOps){
          const row=node('div'),label={reserved:'미전송',attempted:'생성 시도됨 · 자동 재호출 안 함',committed:'저장 완료',aborted:'폐기됨'};
          row.dataset.wikiOperation=operation.operation_id;
          row.append(node('p',({ingest:'적재',integrate:'관계 통합',approve:'승인',reject:'반려'}[operation.action]||'')+' '+operation.operation_id+' · '
            +(operation.state==='attempted'&&operation.action!=='ingest'?'검토 작업 진행 중':label[operation.state])));
          if(operation.remote){
            const phase=operation.remote.phase,labels={staged:'서버 전송 전',prepare_uncertain:'준비 결과 확인 필요',prepare_absent:'조회 시 원작업 없음 · 같은 ID로만 재시도',prepared:'서버 준비 완료',commit_uncertain:'확정 결과 확인 필요',
              server_committed:'서버 완료 · 로컬 적용 필요',abort_uncertain:'폐기 결과 확인 필요',aborted:'서버 작업 폐기됨',settled:'서버·로컬 반영 완료'};
            row.append(node('p',labels[phase]));
            const run=(method,notice)=>async token=>{try{await api.ingest[method](operation.operation_id);requireActive(token);message=notice;}
              finally{if(valid(token))await refreshOperations(token);}};
            if(['staged','prepare_absent'].includes(phase))row.append(command('prepare-ingest',phase==='staged'?'서버 준비':'같은 준비 요청 재전송',run('prepareServer','서버 준비 완료 · 아직 게시하지 않았습니다.')));
            if(phase==='prepared')row.append(command('commit-server-ingest','서버 초안 확정',run('commitServer','서버 완료 · 같은 작업의 로컬 적용이 필요합니다.')),
              command('abort-server-ingest','서버 작업 폐기',async token=>{if(!await ask('준비된 서버 작업을 폐기할까요? 원본·기존 위키·초안·원장은 보존됩니다.'))return;requireActive(token);await run('abortServer','서버 작업을 폐기했습니다.')(token);}));
            if(phase!=='staged')row.append(command('status-ingest','원작업 상태 확인',run('statusServer','같은 ID의 원응답을 확인했습니다.')));
            if(phase==='server_committed')row.append(command('apply-server-ingest','로컬 반영',async token=>{
              await api.ingest.applyServer(operation.operation_id);requireActive(token);await refreshOperations(token);rows=await loadRows();requireActive(token);
              message=operation.action==='approve'?'서버·로컬 승인 반영 완료':operation.action==='reject'?'서버·로컬 반려 반영 완료':'서버·로컬 초안 반영 완료 · 승인 전';
            }));
          }else if(['reserved','attempted'].includes(operation.state)){
            if(operation.state==='reserved')row.append(command('resume-ingest','원작업 확인',async token=>{
              const result=await api.ingest.resumeLocal(operation.operation_id);requireActive(token);ingestPlan=result;ingestProposal=null;
              await refreshOperations(token);message='보존된 같은 ID의 계획입니다.';
            }));
            row.append(command('abort-ingest','작업 폐기',async token=>{
              if(!await ask('원작업을 폐기할까요? 원본·기존 위키·작업 ID는 보존됩니다.'))return;requireActive(token);
              await api.ingest.abortLocal(operation.operation_id);requireActive(token);
              if(ingestPlan?.operation_id===operation.operation_id){ingestPlan=null;ingestProposal=null;}
              await refreshOperations(token);message='작업을 폐기했습니다. 자료와 원장은 보존했습니다.';
            }));
          }operations.append(row);
        }detail.append(operations);
      }
    }
    if(!lintMode&&!queryMode&&!graphCatalog&&!sourceMode&&!readOnly&&!trashMode&&workspaceView==='build'){
    const picker=node('details');picker.open=!doc;picker.append(node('summary','자료 선택'));
    const choices=node('div',undefined,'wiki-source-list');
    for(const source of api.notes()){
      const label=node('label'),input=node('input');input.type='checkbox';input.name='wiki-source';input.value=source.id;
      input.checked=selected.has(source.id);input.disabled=busy;
      input.onchange=()=>{if(input.checked)selected.add(source.id);else selected.delete(source.id);};
      label.append(input,document.createTextNode(source.title||'제목 없음'));choices.append(label);
    }
    picker.append(choices);detail.append(picker);
    const questionLabel=node('label','자료에 질문'),questionInput=node('textarea',undefined,'settings-input');
    questionInput.name='wiki-question';questionInput.rows=2;questionInput.maxLength=4000;questionInput.value=question;questionInput.disabled=busy;
    const generateButton=command('generate',question.trim()?'질문 초안 생성':doc?'갱신 초안 생성':'초안 생성',generate,dirty);
    if(dirty)generateButton.title='현재 초안을 먼저 저장하세요.';
    questionInput.oninput=()=>{question=questionInput.value;generateButton.textContent=question.trim()?'질문 초안 생성':doc?'갱신 초안 생성':'초안 생성';};
    questionLabel.append(questionInput);detail.append(questionLabel,generateButton);
    }
    if(!sourceMode&&doc&&readable){
      const draft=current(),approved=doc.approvals.some(a=>a.draft_id===draft.id),rejected=doc.rejected_draft_ids.includes(draft.id);
      const controls=node('div',undefined,'wiki-review-controls');
      const selector=(name,labelText,value,choices,change,disabled=false)=>{
        const label=node('label',labelText),select=node('select',undefined,'settings-select');select.name=name;select.disabled=busy||disabled;
        for(const row of choices){
          const option=node('option',(doc.drafts.indexOf(row)+1)+' · '+draftStatus(doc,row)+' · '+row.title);
          option.value=row.id;option.title=row.generated_at;select.append(option);
        }
        select.value=value;select.onchange=()=>{const id=select.value;void execute(async()=>{change(id);message='';});};
        label.append(select);return label;
      };
      const versions=workspaceView==='browse'?doc.drafts.filter(d=>doc.approvals.some(a=>a.draft_id===d.id)):doc.drafts;
      controls.append(selector('wiki-version','읽는 판본',draft.id,versions,choose,dirty||versions.length<2));
      const compareLabel=node('label','변경 비교','wiki-compare-toggle'),compare=node('input');compare.type='checkbox';compare.name='wiki-compare';
      compare.checked=comparing;compare.disabled=busy||doc.drafts.length<2;
      compare.onchange=()=>{const value=compare.checked;void execute(async()=>{comparing=value;message='';});};
      compareLabel.prepend(compare);controls.append(compareLabel);
      if(comparing)controls.append(selector('wiki-before','비교 기준',beforeId,doc.drafts.filter(d=>d.id!==draft.id),id=>{beforeId=id;},doc.drafts.length<3));
      detail.append(controls);
      detail.append(node('h3',draft.title),node('p',draft.topic+' · '+(approved?'승인본':rejected?'반려됨':'초안')));
      if(!readOnly&&workspaceView==='browse')detail.append(command('edit-wiki','작성·검토',async()=>{workspaceView='build';choose(doc.drafts.at(-1).id);}));
      if(!readOnly&&workspaceView==='build'&&api.ingest?.integrate&&api.approvedCatalog&&approved&&draft.id===doc.approvals.at(-1)?.draft_id){
        const hasTarget=rows.some(row=>(row.id||row.document?.wiki_id)!==doc.wiki_id&&approvedRow(row)&&!row.protected&&!row.deleted&&!row.unavailable);
        detail.append(command('integrate','관계 추가',async token=>{
          const graph=await catalog(token);requireActive(token);
          const targets=graph.nodes.filter(r=>r.wiki_id!==doc.wiki_id);
          if(!targets.length)throw Error('출처가 확인된 다른 승인 위키가 없습니다.');
          relationEditor={wiki_id:doc.wiki_id,draft_id:draft.id,targets,target:targets[0].wiki_id,type:'related_to',confidence:'inferred',from:'',to:'',citations:draft.citations.slice(0,1).map(c=>c.id)};
        },dirty||!hasTarget));
        if(!hasTarget)detail.append(node('p','연결할 다른 승인 위키가 없습니다.','wiki-relation-status'));
        renderRelationEditor(detail,draft);
      }else if(!readOnly&&workspaceView==='build'&&api.ingest?.integrate){
        detail.append(node('p','관계 추가는 최신 승인 판본에서 사용할 수 있습니다.','wiki-relation-status'));
      }
      const toc=node('nav');toc.setAttribute('aria-label','위키 목차');
      const body=node('div',undefined,'markdown-preview wiki-body');
      draft.sections.forEach((section,index)=>{
        const heading=node('h4',section.title);heading.id='wiki-section-'+index;heading.dataset.wikiSection=section.id;
        const jump=node('button',section.title,'ghost-btn');jump.type='button';jump.onclick=()=>heading.scrollIntoView({block:'start'});toc.append(jump);
        const text=node('div');text.innerHTML=NowMarkdown.render(section.markdown,{images:false});
        body.append(heading,text);
        for(const id of section.citation_ids){
          const citation=draft.citations.find(c=>c.id===id),source=NowNoteWiki.evidenceOf(draft).find(s=>s.id===(citation.evidence_id||citation.source_id));
          const quote=node('blockquote',citation.quote),link=command('source','원문 보기',async token=>{
            if(source.kind==='wiki'){
              if(!api.readEvidence)throw Error('근거 위키의 고정 판본 읽기 연결을 확인하세요.');
              const proof=await api.readEvidence(source);requireActive(token);
              const section=proof.draft.sections.find(s=>s.id===citation.section_id);
              if(!section?.markdown.includes(citation.quote))throw Error('위키 인용 판본·절이 다릅니다.');
              doc=structuredClone(proof.currentDocument);choose(proof.draft.id);graphSection=citation.section_id;graphCatalog=null;
              relationEditor=null;sourceMode=false;dirty=false;comparing=false;message='고정된 위키 출처 판본';return;
            }
            if(source.note_ref.local_id.startsWith('wiki-source:')){
              sourceRows=await api.sources.list();requireActive(token);sourcePreview=source.id;sourceMode=true;sourceFiles=[];
              if(api.ingest)await refreshOperations(token);
            }else await api.openSource(source.note_ref);
          });
          if(!readOnly)quote.append(link);body.append(quote);
        }
      });
      if(comparing&&beforeId){
        const before=doc.drafts.find(d=>d.id===beforeId),diff=node('pre',undefined,'history-diff wiki-diff');
        diff.tabIndex=0;diff.setAttribute('aria-label','위키 판본 차이');
        const changes=Diff.diffLines(draftText(before),draftText(draft),{timeout:1500});
        if(!changes)diff.textContent='비교 시간이 초과되었습니다. 저장 판본은 보존되어 있습니다.';
        else for(const part of changes){const span=node(part.added?'ins':part.removed?'del':'span',part.value);diff.append(span);}
        const sourceKey=ref=>NowNoteProtectionProtocol.canonicalJson(ref.kind==='wiki'?{wiki_id:ref.wiki_id}:ref.note_ref);
        const oldSources=new Map(NowNoteWiki.evidenceOf(before).map(ref=>[sourceKey(ref),ref]));
        const newSources=new Map(NowNoteWiki.evidenceOf(draft).map(ref=>[sourceKey(ref),ref]));
        const sourceChanges=node('ul',undefined,'wiki-source-changes'),titles=new Map((readOnly?[]:api.notes()).map(n=>[n.id,n.title]));
        sourceChanges.setAttribute('aria-label','출처 판본 차이');
        for(const key of new Set([...oldSources.keys(),...newSources.keys()])){
          const left=oldSources.get(key),right=newSources.get(key),ref=right||left;
          const changed=left&&right&&(left.content_hash!==right.content_hash||left.source_revision_id!==right.source_revision_id
            ||left.head_version!==right.head_version||left.origin!==right.origin);
          const label=!left?'새 출처':!right?'제외된 출처':changed?'판본 변경':'같은 판본';
          sourceChanges.append(node('li',(ref.kind==='wiki'?ref.wiki_id:titles.get(ref.note_ref.local_id)||ref.note_ref.local_id)+' · '+label));
        }
        detail.append(diff,sourceChanges);
      }else detail.append(toc,body);
      if(draft.relations?.length){
        const relations=node('ul');relations.setAttribute('aria-label','위키 관계');
        const types={related_to:'관련',supports:'뒷받침',contradicts:'상충',extends:'확장',depends_on:'의존'},confidence={explicit:'직접 근거',inferred:'추론',uncertain:'불확실'};
        for(const relation of draft.relations){
          const ref=relation.to_ref,row=rows.find(r=>(r.id||r.document?.wiki_id)===ref.wiki_id&&!r.protected&&!r.deleted),target=row?.document?.drafts.find(d=>d.id===ref.draft_id);
          const approval=row?.document?.approvals.find(a=>a.draft_id===ref.draft_id&&(ref.kind==='proposal'||a.id===ref.approval_id&&target?.draft_hash===ref.draft_hash));
          const item=node('li');item.append(node('span',types[relation.type]+' · '+confidence[relation.confidence]+' · '));
          if(!readOnly&&(approval&&target||row?.deferred&&api.readPage))item.append(command('relation-target',target?.title||heading(row)?.title||'대상 확인',async token=>{
            const page=row.deferred?await api.readPage(ref.wiki_id):row;requireActive(token);
            const fixed=page.document?.drafts.find(d=>d.id===ref.draft_id),approved=page.document?.approvals.find(a=>a.draft_id===ref.draft_id
              &&(ref.kind==='proposal'||a.id===ref.approval_id&&fixed?.draft_hash===ref.draft_hash));
            if(!fixed||!approved||page.protected||page.deleted||page.unavailable)throw Error('관계 대상의 고정 승인 판본을 확인할 수 없습니다.');
            const state=await api.sourceStatus(fixed,page.document);requireActive(token);if(!state.available)throw Error('관계 대상의 출처를 확인할 수 없습니다.');
            rows=rows.map(value=>value===row?page:value);doc=structuredClone(page.document);choose(fixed.id);dirty=false;relationEditor=null;graphSection=ref.section_id||'';message='고정된 관계 판본';
          }));else item.append(node('span','대상 확인 필요'));
          item.append(node('small',' · '+ref.draft_id+(ref.section_id?' / '+ref.section_id:'')));
          for(const id of relation.citation_ids){const citation=draft.citations.find(c=>c.id===id);if(citation)item.append(node('blockquote',citation.quote));}
          relations.append(item);
        }detail.append(relations);
      }
      if(!readOnly&&workspaceView==='build'){
      const actions=node('div',undefined,'library-actions');
      actions.append(command('save-draft','초안 저장',async token=>{
        const result=await api.save(structuredClone(doc));requireActive(token);dirty=false;
        rows=await loadRows();requireActive(token);message=result.error?'초안 보존 · '+result.error:result.pending?'이 기기에 저장됨 · 전송 대기':result.localOnly?'이 기기에 초안 저장 완료':'초안 저장 완료';
      },!dirty),command('approve','검토 후 승인',async token=>{
        const state=await api.sourceStatus(draft,doc);requireActive(token);
        if(!state.available||state.stale)throw Error('원본이 바뀌었거나 사용할 수 없습니다. 갱신 후 다시 검토하세요.');
        const result=await api.approve(structuredClone(doc),draft.id);requireActive(token);doc=result.document;
        rows=await loadRows();requireActive(token);message=result.error?'승인 기록 보존 · '+result.error:result.pending?'승인 기록 보존 · 서버 전송 대기':result.localOnly?'이 기기에 승인 저장 완료':'승인 저장 완료';
        if(result.operation_id&&result.pending){doc=null;sourceMode=true;sourceRows=await api.sources.list();requireActive(token);await refreshOperations(token);message='승인 초안 보존 · 서버 준비·확정 전';}
      },dirty||approved||rejected||draft.base_approved_revision_id!==(doc.approvals.at(-1)?.id||null)),command('reject','반려',async token=>{
        const result=await api.reject(structuredClone(doc),draft.id);requireActive(token);doc=result.document;
        rows=await loadRows();requireActive(token);message=result.pending?'반려 기록 보존 · 서버 전송 대기':'반려 기록 저장 완료';
        if(result.operation_id&&result.pending){doc=null;sourceMode=true;sourceRows=await api.sources.list();requireActive(token);await refreshOperations(token);message='반려 초안 보존 · 서버 준비·확정 전';}
      },dirty||approved||rejected));
      if(api.openProtection)actions.append(command('protect','위키 보호',()=>api.openProtection(doc.wiki_id),dirty));
      detail.append(actions);
      }
    }
    layout.append(nav,detail);dialog.append(header,toolbar,status,layout);
    if(graphCatalog&&!busy){
      const token=epoch;
      graphMount=mountWikiGraph({container:detail,catalog:graphCatalog,guard:()=>{requireActive(token);check();requireActive(token);},
        onOpen:(id,section,draft)=>execute(async active=>{
          const row=rows.find(row=>row.document?.wiki_id===id);if(!row?.document||!api.canRead(row.document))throw Error('위키 출처를 다시 확인하세요.');
          workspaceView='browse';doc=structuredClone(row.document);choose(draft);graphCatalog=null;graphSection=section||'';sourceMode=false;dirty=false;requireActive(active);
        })});
    }
    if(graphSection&&doc&&readable){
      const heading=[...detail.querySelectorAll('[data-wiki-section]')].find(element=>element.dataset.wikiSection===graphSection);
      graphSection='';heading?.scrollIntoView({block:'start'});
    }
  }
  dialog.addEventListener('cancel',event=>{event.preventDefault();requestClose();});
  if(embedded)dialog.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();requestClose();}});
  if(embedded){
    tabs.className='wiki-workspace-tabs';tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','작업 화면');tabs.hidden=true;
    dialog.setAttribute('role','tabpanel');dialog.setAttribute('aria-labelledby','wikiWorkspaceTab');
    for(const [id,title,active]of [['wikiMemoTab','메모',false],['wikiWorkspaceTab','AI 지식 위키',true]]){
      const button=node('button',title,'ghost-btn');button.type='button';button.id=id;button.setAttribute('role','tab');button.setAttribute('aria-selected',String(active));
      if(active)button.setAttribute('aria-controls','wikiDialog');
      button.onclick=()=>{check();if(dialog.open){activate(active);if(active)dialog.querySelector('h2')?.focus();}};tabs.append(button);
    }
    tabs.addEventListener('keydown',event=>{
      if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
      event.preventDefault();const buttons=[...tabs.querySelectorAll('button')],index=buttons.indexOf(document.activeElement);
      const next=event.key==='Home'?0:event.key==='End'?1:1-Math.max(0,index);buttons[next].click();buttons[next].focus();
    });
    host.prepend(tabs);host.append(dialog);
    for(const id of ['treeList','openTabs'])document.getElementById(id)?.addEventListener('click',()=>{if(dialog.open)activate(false);});
  }else document.body.append(dialog);
  return {close,check,openProtected(value,queryAccess=null){
    close();previous=document.activeElement;bound=api.contextKey();epoch++;
    doc=structuredClone(value);rows=[{document:structuredClone(value)}];readOnly=true;readable=true;protectedQueryAccess=queryAccess;
    workspaceView='browse';message='보호된 저장 판본 · 읽기 전용';choose(preferred(doc).id);show();render();
  },async open(view){
    if(dialog.open&&!readOnly&&view!==undefined){activate(true);if(!busy)await execute(token=>changeView(view,token));return;}
    view=view||'build';
    close();previous=document.activeElement;bound=api.contextKey();epoch++;const token=epoch;
    workspaceView=view;show();busy=true;render();
    try{const next=await loadRows();requireActive(token);rows=next;await changeView(view,token);}
    catch(error){if(valid(token))message=error.message;}
    finally{if(valid(token)){busy=false;render();}}
  }};
};
