/* Wiki text stays in the existing Note journal; this view holds no durable cache. */
globalThis.mountNowWiki = function mountNowWiki(api) {
  const dialog=document.createElement('dialog');
  dialog.id='wikiDialog';dialog.className='library-dialog wiki-dialog';
  dialog.setAttribute('aria-labelledby','wikiTitle');
  let rows=[],doc=null,dirty=false,busy=false,readable=false,epoch=0,bound='',message='',topic='',question='',confirmation=null,previous=null;
  let viewId='',beforeId='',comparing=false,readOnly=false;
  const selected=new Set();
  const node=(tag,text,className)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(className)n.className=className;return n;};
  const valid=token=>dialog.open&&token===epoch&&bound===api.contextKey();
  const preferred=value=>value&&(value.drafts.find(d=>d.id===value.approvals.at(-1)?.draft_id)||value.drafts.at(-1));
  const current=()=>doc&&(doc.drafts.find(d=>d.id===viewId)||preferred(doc));
  const draftStatus=(value,draft)=>value.approvals.some(a=>a.draft_id===draft.id)?'승인본':value.rejected_draft_ids.includes(draft.id)?'반려됨':'초안';
  function choose(id){
    if(!doc?.drafts.some(d=>d.id===id))throw Error('선택한 위키 판본이 없습니다.');
    viewId=id;
    if(!beforeId||beforeId===id||!doc.drafts.some(d=>d.id===beforeId))
      beforeId=[...doc.drafts].reverse().find(d=>d.id!==id)?.id||'';
    selected.clear();for(const ref of current().source_manifest)selected.add(ref.note_ref.local_id);
  }
  const draftText=draft=>[draft.title,draft.topic,...draft.sections.map(s=>s.title+'\n'+s.markdown),
    ...draft.citations.map(c=>'> '+c.quote)].join('\n\n');
  function close(){
    epoch++;confirmation?.(false);confirmation=null;rows=[];doc=null;dirty=false;busy=false;readable=false;selected.clear();message='';question='';topic='';
    viewId='';beforeId='';comparing=false;readOnly=false;
    if(dialog.open)dialog.close();dialog.replaceChildren();previous?.focus();
  }
  function check(){
    if(dialog.open&&(bound!==api.contextKey()||(!readOnly&&readable&&doc&&api.canRead&&!api.canRead(doc))))close();
  }
  function conceal(){
    rows=rows.map(row=>({id:row.id||row.document?.wiki_id,unavailable:true,error:'출처·보호 상태 확인 필요'}));
    doc=null;dirty=false;readable=false;selected.clear();question='';topic='';
    viewId='';beforeId='';comparing=false;
    message='출처를 확인할 수 없어 내용을 표시하지 않습니다. 저장된 자료는 변경하지 않았습니다.';
  }
  function command(action,label,fn,disabled=false){
    const b=node('button',label,'secondary-btn');b.type='button';b.dataset.wikiAction=action;b.disabled=disabled||busy;
    b.onclick=()=>{if(!readOnly)void execute(fn);};return b;
  }
  async function execute(fn){
    check();if(!dialog.open||busy)return;
    const token=epoch;busy=true;readable=false;render();
    try{await fn(token);}catch(error){if(valid(token))message=error.message;}
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
  function requireActive(token){if(!valid(token))throw Error('계정·서버 또는 선택이 변경되었습니다.');}
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
    const snapshot=await api.capture([...selected]);requireActive(token);
    const connection=api.connection();
    const names=snapshot.sources.map(s=>s.title||s.manifest.note_ref.local_id).join(', ');
    const accepted=await ask(connection.provider+' · '+connection.model+'\n'+connection.endpoint+'\n자료 '+snapshot.sources.length+'개 · UTF-8 '+snapshot.bytes+' bytes\n'+names+(question.trim()?'\n질문: '+question.trim():'')+'\n선택한 원문을 전송하며 제공업체 비용이 발생할 수 있습니다.',{send:true});
    requireActive(token);if(!accepted)return;
    const answer=await connection.invoke(NowNoteWiki.prompt(snapshot,{question}));requireActive(token);
    const draft=await NowNoteWiki.validateDraft(answer,snapshot,connection,{baseApprovedRevisionId:doc?.approvals.at(-1)?.id||null});
    requireActive(token);
    if(doc){
      if(NowNoteProtectionProtocol.canonicalJson(doc.scope)!==NowNoteProtectionProtocol.canonicalJson(draft.scope))throw Error('기존 위키와 계정·서버가 다릅니다.');
      doc={...structuredClone(doc),document_version:doc.document_version+1,drafts:[...doc.drafts,draft]};
    }else doc={schema_version:1,document_version:1,wiki_id:crypto.randomUUID(),scope:structuredClone(draft.scope),drafts:[draft],approvals:[],rejected_draft_ids:[]};
    choose(draft.id);comparing=false;
    dirty=true;message='인용문을 확인한 뒤 초안을 저장하세요.';
  }
  function render(){
    if(!dialog.open)return;
    check();if(!dialog.open)return;
    dialog.replaceChildren();
    const header=node('header',undefined,'library-header');header.append(node('h2','AI 지식 위키'));
    header.firstChild.id='wikiTitle';
    const exit=node('button','닫기','ghost-btn');exit.type='button';exit.onclick=close;header.append(exit);
    const toolbar=node('div',undefined,'library-toolbar');
    if(!readOnly)toolbar.append(command('new','새 위키',async token=>{
      if(dirty&&!await ask('저장하지 않은 초안을 버리고 새 위키를 만들까요?'))return;
      requireActive(token);doc=null;dirty=false;selected.clear();message='';question='';viewId='';beforeId='';comparing=false;
    }),command('refresh','동기화',async token=>{const next=await api.list({sync:true});requireActive(token);rows=next;message='목록을 갱신했습니다.';}));
    const status=node('p',message);status.setAttribute('role','status');status.setAttribute('aria-live','polite');
    const layout=node('div',undefined,'library-layout wiki-layout'),nav=node('nav');nav.setAttribute('aria-label','주제별 위키');
    const filter=node('select',undefined,'settings-select');filter.setAttribute('aria-label','주제');
    for(const name of ['',...new Set((busy?[]:rows).map(r=>preferred(r.document)?.topic).filter(Boolean))]){
      const option=node('option',name||'전체 주제');option.value=name;filter.append(option);
    }
    filter.value=topic;filter.disabled=busy;filter.onchange=()=>{topic=filter.value;render();};nav.append(filter);
    for(const row of rows){
      const last=preferred(row.document),pendingCheck=busy||(doc&&row.document?.wiki_id===doc.wiki_id&&!readable);
      if(topic&&last?.topic!==topic)continue;
      const item=node('button',undefined,'library-item');item.type='button';item.disabled=busy;
      const title=node('span',pendingCheck?'위키 확인 중':last?.title||(row.protected?'보호된 위키':'위키 '+(row.id||'')));
      const info=node('small',pendingCheck?'출처 확인 중':row.error|| (row.protected?'잠금 상태':row.pending?'전송 대기':row.localOnly?'이 기기에 보관':last?.topic||''));
      item.append(title,info);item.setAttribute('aria-current',String(Boolean(doc&&doc.wiki_id===(row.document?.wiki_id||row.id))));
      item.onclick=()=>execute(async token=>{
        if(dirty&&!await ask('저장하지 않은 초안을 버리고 선택한 위키를 열까요?'))return;
        requireActive(token);
        if(row.protected||!row.document){
          if(api.openProtection){await api.openProtection(row.id);return;}
          doc=null;dirty=false;selected.clear();message=row.error||'보호된 위키입니다. 전체 보호 화면에서 잠금을 해제하세요.';return;
        }
        doc=structuredClone(row.document);dirty=false;selected.clear();question='';
        choose(preferred(doc).id);comparing=false;
        message='';
      });nav.append(item);
    }
    if(!rows.length)nav.append(node('p','저장된 위키 없음'));
    const detail=node('section',undefined,'wiki-detail');detail.setAttribute('aria-label','위키 검토');
    if(!readOnly){
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
    if(doc&&readable){
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
      controls.append(selector('wiki-version','읽는 판본',draft.id,doc.drafts,choose,dirty||doc.drafts.length<2));
      const compareLabel=node('label','변경 비교','wiki-compare-toggle'),compare=node('input');compare.type='checkbox';compare.name='wiki-compare';
      compare.checked=comparing;compare.disabled=busy||doc.drafts.length<2;
      compare.onchange=()=>{const value=compare.checked;void execute(async()=>{comparing=value;message='';});};
      compareLabel.prepend(compare);controls.append(compareLabel);
      if(comparing)controls.append(selector('wiki-before','비교 기준',beforeId,doc.drafts.filter(d=>d.id!==draft.id),id=>{beforeId=id;},doc.drafts.length<3));
      detail.append(controls);
      detail.append(node('h3',draft.title),node('p',draft.topic+' · '+(approved?'승인본':rejected?'반려됨':'초안')));
      const toc=node('nav');toc.setAttribute('aria-label','위키 목차');
      const body=node('div',undefined,'markdown-preview wiki-body');
      draft.sections.forEach((section,index)=>{
        const heading=node('h4',section.title);heading.id='wiki-section-'+index;
        const jump=node('button',section.title,'ghost-btn');jump.type='button';jump.onclick=()=>heading.scrollIntoView({block:'start'});toc.append(jump);
        const text=node('div');text.innerHTML=NowMarkdown.render(section.markdown,{images:false});
        body.append(heading,text);
        for(const id of section.citation_ids){
          const citation=draft.citations.find(c=>c.id===id),source=draft.source_manifest.find(s=>s.id===citation.source_id);
          const quote=node('blockquote',citation.quote),link=command('source','원문 보기',()=>api.openSource(source.note_ref));
          if(!readOnly)quote.append(link);body.append(quote);
        }
      });
      if(comparing&&beforeId){
        const before=doc.drafts.find(d=>d.id===beforeId),diff=node('pre',undefined,'history-diff wiki-diff');
        diff.tabIndex=0;diff.setAttribute('aria-label','위키 판본 차이');
        const changes=Diff.diffLines(draftText(before),draftText(draft),{timeout:1500});
        if(!changes)diff.textContent='비교 시간이 초과되었습니다. 저장 판본은 보존되어 있습니다.';
        else for(const part of changes){const span=node(part.added?'ins':part.removed?'del':'span',part.value);diff.append(span);}
        const oldSources=new Map(before.source_manifest.map(ref=>[NowNoteProtectionProtocol.canonicalJson(ref.note_ref),ref]));
        const newSources=new Map(draft.source_manifest.map(ref=>[NowNoteProtectionProtocol.canonicalJson(ref.note_ref),ref]));
        const sourceChanges=node('ul',undefined,'wiki-source-changes'),titles=new Map((readOnly?[]:api.notes()).map(n=>[n.id,n.title]));
        sourceChanges.setAttribute('aria-label','출처 판본 차이');
        for(const key of new Set([...oldSources.keys(),...newSources.keys()])){
          const left=oldSources.get(key),right=newSources.get(key),ref=right||left;
          const changed=left&&right&&(left.content_hash!==right.content_hash||left.source_revision_id!==right.source_revision_id
            ||left.head_version!==right.head_version||left.origin!==right.origin);
          const label=!left?'새 출처':!right?'제외된 출처':changed?'판본 변경':'같은 판본';
          sourceChanges.append(node('li',(titles.get(ref.note_ref.local_id)||ref.note_ref.local_id)+' · '+label));
        }
        detail.append(diff,sourceChanges);
      }else detail.append(toc,body);
      if(!readOnly){
      const actions=node('div',undefined,'library-actions');
      actions.append(command('save-draft','초안 저장',async token=>{
        const result=await api.save(structuredClone(doc));requireActive(token);dirty=false;
        rows=await api.list();requireActive(token);message=result.error?'초안 보존 · '+result.error:result.pending?'이 기기에 저장됨 · 전송 대기':result.localOnly?'이 기기에 초안 저장 완료':'초안 저장 완료';
      },!dirty),command('approve','검토 후 승인',async token=>{
        const state=await api.sourceStatus(draft,doc);requireActive(token);
        if(!state.available||state.stale)throw Error('원본이 바뀌었거나 사용할 수 없습니다. 갱신 후 다시 검토하세요.');
        const result=await api.approve(structuredClone(doc),draft.id);requireActive(token);doc=result.document;
        rows=await api.list();requireActive(token);message=result.error?'승인 기록 보존 · '+result.error:result.pending?'승인 기록 보존 · 서버 전송 대기':result.localOnly?'이 기기에 승인 저장 완료':'승인 저장 완료';
      },dirty||approved||rejected||draft.base_approved_revision_id!==(doc.approvals.at(-1)?.id||null)),command('reject','반려',async token=>{
        const result=await api.reject(structuredClone(doc),draft.id);requireActive(token);doc=result.document;
        rows=await api.list();requireActive(token);message=result.pending?'반려 기록 보존 · 서버 전송 대기':'반려 기록 저장 완료';
      },dirty||approved||rejected));
      if(api.openProtection)actions.append(command('protect','위키 보호',()=>api.openProtection(doc.wiki_id),dirty));
      detail.append(actions);
      }
    }
    layout.append(nav,detail);dialog.append(header,toolbar,status,layout);
  }
  dialog.addEventListener('cancel',event=>{event.preventDefault();if(confirmation)confirmation(false);else close();});
  document.body.append(dialog);
  return {close,check,openProtected(value){
    close();previous=document.activeElement;bound=api.contextKey();epoch++;
    doc=structuredClone(value);rows=[{document:structuredClone(value)}];readOnly=true;readable=true;
    message='보호된 저장 판본 · 읽기 전용';choose(preferred(doc).id);dialog.showModal();render();
  },async open(){
    close();previous=document.activeElement;bound=api.contextKey();epoch++;const token=epoch;
    dialog.showModal();busy=true;render();
    try{const next=await api.list();requireActive(token);rows=next;}
    catch(error){if(valid(token))message=error.message;}
    finally{if(valid(token)){busy=false;render();}}
  }};
};
