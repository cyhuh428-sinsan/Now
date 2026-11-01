globalThis.runWikiLintUiFixture=async function(phase){
  const P=NowNoteProtectionProtocol,check=(value,code)=>{if(!value)throw Error(code);};
  const pause=()=>new Promise(resolve=>setTimeout(resolve,5));
  const button=name=>document.querySelector('#wikiDialog [data-wiki-action="'+name+'"]');
  const wait=async(fn,code)=>{for(let n=0;n<500;n++){if(fn())return;await pause();}throw Error(code);};
  const click=async name=>{check(button(name)&&!button(name).disabled,'lint_button_'+name);button(name).click();await pause();};
  wikiUI.close();await wikiUI.open();await noteHistory.idle();await Promise.all([...storagePendingWrites]);
  const before=P.canonicalJson(noteHistory.export());
  const baseIds=(await wikiNotebook.list()).filter(r=>r.document&&!['위키 점검 보고서','Synthetic answer'].includes(r.document.drafts.at(-1).title)).map(r=>r.document.wiki_id);
  const choose=async()=>{
    const select=document.querySelector('[name=wiki-lint-scope]');select.value='selected';select.dispatchEvent(new Event('change',{bubbles:true}));
    for(const id of baseIds)document.querySelector('[name=wiki-lint-page][value="'+id+'"]').click();
  };
  await click('lint');await wait(()=>button('lint-run'),'lint_controls');
  await choose();
  await click('lint-run');await wait(()=>document.querySelector('[data-wiki-lint-report]'),'lint_report');
  check(document.querySelector('[data-wiki-lint-report]').textContent.includes('검사 2'),'lint_checked_scope');
  check(P.canonicalJson(noteHistory.export())===before,'lint_default_journal_write');
  const report=document.querySelector('[data-wiki-lint-report]');check(report.textContent.includes('오류 0'),'lint_normal_findings');
  const key=state.settings.server.ownerId;state.settings.server.ownerId='qa-lint-other';wikiUI.check();
  check(!document.querySelector('#wikiDialog').open&&!document.querySelector('[data-wiki-lint-report]'),'lint_account_conceal');state.settings.server.ownerId=key;
  await wikiUI.open();check(!document.querySelector('[data-wiki-lint-report]'),'lint_no_auto_restore');wikiUI.close();
  let explicitSaved=0,coldDrafts=0;
  if(phase===1){
    await wikiUI.open();await click('lint');await choose();await click('lint-run');await wait(()=>button('lint-save'),'lint_report_save_button');
    const count=(await wikiNotebook.list()).length;await click('lint-save');await wait(()=>button('confirm-change'),'lint_save_confirmation');await click('confirm-change');
    await wait(()=>button('commit-ingest'),'lint_report_preview');check((await wikiNotebook.list()).length===count,'lint_report_implicit_save');
    await click('commit-ingest');await wait(()=>document.querySelector('#wikiDialog [role=status]')?.textContent.includes('초안 1개 저장'),'lint_report_commit');
    const saved=(await wikiNotebook.list()).find(r=>r.document?.drafts.at(-1).title==='위키 점검 보고서');
    check(saved&&!saved.document.approvals.length&&saved.document.drafts[0].evidence_manifest.length===2,'lint_report_dependencies');explicitSaved=1;
  }else{
    const saved=(await wikiNotebook.list()).filter(r=>r.document?.drafts.at(-1).title==='위키 점검 보고서');
    check(saved.length===1&&!saved[0].document.approvals.length&&saved[0].document.drafts[0].evidence_manifest.length===2,'lint_report_cold');coldDrafts=1;
  }
  wikiUI.close();const afterSave=P.canonicalJson(noteHistory.export());
  const snapshot=await wikiNotebook.lintSnapshot(),known=snapshot.rows.find(row=>row.source_checks?.length);check(known,'lint_source_fixture');known.source_checks[0].status='changed';
  document.querySelector('#wikiDialog').remove();
  const ui=mountNowWiki({...wikiNotebook,contextKey:wikiViewKey,notes:()=>[],lintSnapshot:async()=>structuredClone(snapshot)});
  await ui.open();await click('lint');await click('lint-run');await wait(()=>document.querySelector('[data-wiki-lint-report]'),'lint_changed_report');
  check(document.querySelector('[data-lint-rule=wiki_lint_source_changed]')?.textContent.includes('검토 필요'),'lint_classified_findings');
  check(P.canonicalJson(noteHistory.export())===afterSave,'lint_changed_report_write');ui.close();
  return {checked:2,defaultJournalWrites:0,explicitSaved,coldDrafts,accountConcealed:true,defaultReportPersisted:false,changedClassification:'synthetic source status only'};
};
