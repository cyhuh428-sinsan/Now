const {app,BrowserWindow,session}=require('electron');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),own=path.resolve(process.argv[2]);
if(!own.startsWith(path.resolve('D:/tmp/now-240-protected-view')+path.sep))throw Error('profile_boundary');
app.setPath('userData',path.join(own,'profile'));app.disableHardwareAcceleration();
app.whenReady().then(async()=>{
  let window;let result;let outbound=0;
  try{
    session.defaultSession.webRequest.onBeforeRequest((d,done)=>{const cancel=!d.url.startsWith('data:');if(cancel)outbound++;done({cancel});});
    window=new BrowserWindow({show:false,width:1100,height:800,webPreferences:{contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}});
    await window.loadURL('data:text/html,<html><body></body></html>');
    await window.webContents.executeJavaScript('document.head.append(Object.assign(document.createElement("style"),{textContent:'+JSON.stringify(fs.readFileSync(path.join(root,'web/styles.css'),'utf8'))+'}));void 0;');
    for(const name of ['marked.umd.js','purify.min.js','document-renderer.js','note-protection-ui.js'])await window.webContents.executeJavaScript(fs.readFileSync(path.join(root,'web/vendor',name),'utf8')+'\n;void 0;');
    result=await window.webContents.executeJavaScript(`(async()=>{
      const assert=(v,m)=>{if(!v)throw Error(m);},wait=()=>new Promise(r=>setTimeout(r,10));
      const original='# View test\\n\\n<details><summary>Fold</summary>\\n\\n**Bold**\\n\\n</details>\\n\\nhttps://example.invalid/page\\n\\n[File](D:/synthetic-only.md)\\n\\n<script>globalThis.BAD=true</script>\\n<img src="https://example.invalid/image" onerror="globalThis.BAD=true">';
      let drafts=[],files=[],locked=0,transcriptSaves=0,transcriptValues=[],analysisApplied=[];
      const scope={url:'https://synthetic.invalid',owner:'alice',local_id:'one',instance:'synthetic'};
      const info={scope,status:{crypto_epoch:1},catalog:{context:{base:{current_exists:true},current_mode:'protected'}},rows:[],pending:null};
      const ui=mountNoteProtection({contextKey:()=> 'one',canMutate:()=>true,targets:async()=>['one'],target:()=> 'one',selectTarget:()=>{},inspect:async()=>info,copies:async()=>[],lock:()=>{locked++;},edit:async()=>({title:'View',content:original}),draft:async(i,n)=>{drafts.push(n.content);},openFile:p=>{files.push(p);},transcriptEdit:async(i,row)=>({descriptor:row.descriptor,value:'TRANSCRIPT-ORIGINAL'}),transcriptSave:async(i,e,value,password)=>{assert(password==='transcript-journal-key','transcript_journal_key');transcriptSaves++;transcriptValues.push(value);}});
      await ui.open();
      const dialog=document.querySelector('#noteProtectionDialog'),button=n=>dialog.querySelector('[data-action="'+n+'"]');
      assert(button('analysis-prepare'),'analysis_prepare_missing');
      assert(button('analysis-publish'),'analysis_publish_missing');
      assert(button('analysis-replan')&&button('analysis-replan-confirm'),'analysis_replan_controls_missing');
      const idle=async()=>{for(let i=0;i<100&&button('edit').disabled;i++)await wait();};
      button('edit').click();await idle();
      const editor=dialog.querySelector('.protection-draft');assert(editor.value===original,'editor_source');
      assert(button('editor-preview'),'preview_control_missing');
      editor.focus();editor.setSelectionRange(editor.value.length,editor.value.length);
      document.execCommand('insertText',false,'\\nNATIVE-UNDO');await wait();
      const edited=editor.value;assert(edited.endsWith('NATIVE-UNDO'),'native_insert_failed');
      const selection=[editor.selectionStart,editor.selectionEnd],beforeDrafts=drafts.length;
      button('editor-preview').click();await idle();
      const preview=dialog.querySelector('.protection-preview');
      assert(!preview.classList.contains('hidden')&&preview.querySelector('h1')?.textContent==='View test','rendered_heading');
      assert([...preview.querySelectorAll('details summary')].some(s=>s.textContent.trim()==='Fold'),'details_missing');
      assert(preview.querySelector('strong')?.textContent==='Bold','bold_missing');
      assert(preview.querySelector('a')?.href==='https://example.invalid/page','url_missing');
      assert(!preview.querySelector('script,[onerror],img[src],iframe')&&!globalThis.BAD,'unsafe_preview');
      preview.querySelector('[data-local-path]').click();assert(files[0]==='D:/synthetic-only.md','file_route');
      assert(editor.value===edited&&drafts.length===beforeDrafts,'view_changed_raw_or_draft');
      button('editor-source').click();await idle();
      assert(editor.value===edited&&editor.selectionStart===selection[0]&&editor.selectionEnd===selection[1],'view_lost_selection');
      editor.focus();assert(document.execCommand('undo'),'native_undo_failed');await wait();
      assert(editor.value===original,'view_lost_undo');
      assert(document.execCommand('redo'),'native_redo_failed');await wait();assert(editor.value===edited,'redo_changed_raw');
      button('editor-preview').click();await idle();ui.lock();
      const clean=dialog.querySelector('.protection-draft');
      assert(!editor.value&&!clean.value&&clean!==editor&&!preview.textContent,'lock_plaintext_or_native_history_retained');
      clean.focus();document.execCommand('undo');assert(!clean.value,'lock_undo_resurrected_plaintext');
      assert(locked>0,'lock_missing');
      assert(button('transcript-edit')&&button('transcript-save'),'transcript_controls_missing');
      info.rows=[{kind:'typed',label:'Transcript',descriptor:{key:{kind:'recording_transcript',id:'7',slot:'transcript'}}}];await ui.open();
      assert(!button('transcript-edit').disabled,'transcript_edit_disabled');button('transcript-edit').click();await idle();
      let td=dialog.querySelector('.protection-transcript-draft'),tn=dialog.querySelector('[name="transcript-null"]');
      assert(td.value==='TRANSCRIPT-ORIGINAL'&&!button('transcript-save').disabled,'transcript_editor_missing');
      td.dispatchEvent(new CompositionEvent('compositionstart'));assert(button('transcript-save').disabled,'transcript_composition_save_enabled');td.dispatchEvent(new CompositionEvent('compositionend'));assert(!button('transcript-save').disabled,'transcript_composition_save_stuck');
      td.value='TRANSCRIPT-REPLACEMENT';td.dispatchEvent(new Event('input'));button('transcript-save').click();
      for(let i=0;i<100&&!dialog.querySelector('form.library-confirm');i++)await wait();
      let tf=dialog.querySelector('form.library-confirm');assert(tf,'transcript_confirm_missing');tf.querySelector('input').value='transcript-journal-key';tf.requestSubmit();await idle();
      assert(transcriptSaves===1&&transcriptValues[0]==='TRANSCRIPT-REPLACEMENT','transcript_save_not_typed');
      button('transcript-edit').click();await idle();td=dialog.querySelector('.protection-transcript-draft');tn=dialog.querySelector('[name="transcript-null"]');tn.checked=true;tn.dispatchEvent(new Event('change'));
      assert(td.disabled,'transcript_null_draft_enabled');button('transcript-save').click();for(let i=0;i<100&&!dialog.querySelector('form.library-confirm');i++)await wait();
      tf=dialog.querySelector('form.library-confirm');assert(tf,'transcript_null_confirm_missing');tf.querySelector('input').value='transcript-journal-key';tf.requestSubmit();await idle();
      assert(transcriptSaves===2&&transcriptValues[1]===null,'transcript_null_collapsed_to_empty');
      button('transcript-edit').click();await idle();td=dialog.querySelector('.protection-transcript-draft');td.focus();document.execCommand('insertText',false,'PRIVATE-TRANSCRIPT');ui.lock();
      const clearedTranscript=dialog.querySelector('.protection-transcript-draft');assert(!td.value&&!clearedTranscript.value&&td!==clearedTranscript,'transcript_lock_retained_history');clearedTranscript.focus();document.execCommand('undo');assert(!clearedTranscript.value,'transcript_undo_resurrection');
      globalThis.renderTranscriptPreview=async()=>{
        for(const other of document.querySelectorAll('#noteProtectionDialog'))if(other!==dialog){other.close();other.remove();}
        if(!dialog.isConnected)document.body.append(dialog);info.pending=null;info.analysisOperations=[];
        info.rows=[{kind:'typed',label:'Transcript',descriptor:{key:{kind:'recording_transcript',id:'7',slot:'transcript'}}}];await ui.open();button('transcript-edit').click();await idle();
        const section=dialog.querySelector('.protection-transcript');section.scrollIntoView({block:'center'});
        const text=dialog.querySelector('.protection-transcript-draft');text.value='합성 전사문 편집 · 실제 사용자 자료 없음';
        const rect=section.getBoundingClientRect(),input=text.getBoundingClientRect(),save=button('transcript-save').getBoundingClientRect();
        assert(rect.left>=0&&rect.right<=innerWidth&&input.right<=rect.right&&save.top>=input.bottom,'transcript_layout_overlap:'+JSON.stringify({viewport:innerWidth,section:rect.toJSON(),input:input.toJSON(),save:save.toJSON()}));
      };
      ui.invalidate();dialog.remove();info.rows=[];
      const applyUI=mountNoteProtection({contextKey:()=> 'one',canMutate:()=>true,targets:async()=>['one'],target:()=> 'one',selectTarget:()=>{},inspect:async()=>info,copies:async()=>[],lock:()=>{},analysisApply:async(i,row,mode,password)=>{assert(password==='apply-key'&&row.descriptor.key.kind==='analysis_result','typed_apply_confirmation');analysisApplied.push(mode);}});
      info.rows=[{kind:'typed',label:'Analysis result',descriptor:{key:{kind:'analysis_result',id:'7',slot:'result_json'},is_null:false}}];await applyUI.open();
      const ap=document.querySelector('#noteProtectionDialog'),applyButton=name=>ap.querySelector('[data-action="analysis-'+name+'"]');
      assert(applyButton('append')&&applyButton('approve'),'typed_apply_commands_missing');
      for(const mode of ['append','approve']){
        applyButton(mode).click();for(let i=0;i<100&&!ap.querySelector('form.library-confirm');i++)await wait();
        const form=ap.querySelector('form.library-confirm');assert(form&&analysisApplied.length===(mode==='append'?0:1),'typed_apply_before_confirmation');form.querySelector('input').value='apply-key';form.requestSubmit();
        for(let i=0;i<100&&applyButton(mode).disabled;i++)await wait();
      }
      assert(analysisApplied.join(',')==='append,approve','typed_apply_command_modes');
      info.rows=[{kind:'typed',label:'Null',descriptor:{key:{kind:'analysis_result',id:'7',slot:'result_json'},is_null:true}}];await applyUI.open();
      assert(applyButton('append').disabled&&applyButton('approve').disabled,'typed_null_result_apply_enabled');
      applyUI.invalidate();ap.remove();info.rows=[];
      let invoked=0,recorded=0,unavailable=0,published=0,replanned=0,replanResumed=0,release;
      const replanView={operation_id:'fixture-run',scope,catalog:{context:{base:{crypto_epoch:2,history_generation:7}}},original_source_context:{base:{base:{crypto_epoch:1,history_generation:3}}}};
      const plan={scope,operation_id:null,input:'SYNTHETIC-ANALYSIS-INPUT',route:{provider:'omniroute',endpoint:'http://127.0.0.1:1/v1',model:'auto'}};
      const analysis=mountNoteProtection({contextKey:()=> 'one',canMutate:()=>true,targets:async()=>['one'],target:()=> 'one',selectTarget:()=>{},inspect:async()=>info,copies:async()=>[],lock:()=>{},phaseLabel:phase=>phase,
        analysisPrepare:async()=>structuredClone(plan),analysisBegin:async(p,r,k)=>{assert(k==='fixture-key'&&r.model==='combo-name','analysis_confirmation_changed');return {operation_id:'fixture-run',provider_state:'ready'};},
        analysisInvoke:async()=>{invoked++;return new Promise(r=>{release=()=>r({provider_terminal_observed:true,outcome:'done',result_json:'SYNTHETIC-RESULT'});});},
        analysisRecord:async(h,o,k)=>{assert(k==='new-output-key','analysis_key_reused_across_provider');recorded++;info.pending={id:'fixture-run',phase:'analysis_settled'};info.analysisOperations=[info.pending];},analysisFinish:async()=>'<script>not HTML</script> SYNTHETIC-RESULT',
        analysisPublish:async(id,k)=>{assert(id==='fixture-run'&&k==='publication-key','analysis_publication_binding');published++;info.pending=null;info.analysisOperations=[];return 'SERVER-SYNTHETIC-RESULT';},
        analysisReplanPrepare:async(i,id,k)=>{assert(id==='fixture-run'&&k==='replan-original-key','replan_prepare_binding');return structuredClone(replanView);},
        analysisReplanBegin:async(p,k,c,resolve)=>{assert(p.operation_id==='fixture-run'&&k==='replan-original-key'&&c.confirmed_reuse_original_result===true&&c.target_epoch===2,'replan_explicit_confirmation');const target=await resolve({representation_epoch:2,output:true});assert(target==='replan-target-key','replan_target_key');replanned++;info.pending=null;info.analysisOperations=[];return 'REPLANNED-SYNTHETIC-RESULT';},
        analysisResume:async(id,k,resolve)=>{assert(id==='fixture-run'&&k==='replan-original-key'&&typeof resolve==='function','replan_resume_binding');assert(await resolve({representation_epoch:2,output:true})==='replan-target-key','replan_resume_key');replanResumed++;info.pending=null;info.analysisOperations=[];return 'RECOVERED-SYNTHETIC-RESULT';},
        analysisUnavailable:async()=>{unavailable++;},
      });await analysis.open();
      const panel=document.querySelector('#noteProtectionDialog'),ab=n=>panel.querySelector('[data-action="'+n+'"]'),field=n=>panel.querySelector('[name="analysis-'+n+'"]');
      assert(field('operation').getBoundingClientRect().width>panel.clientWidth*0.8,'analysis_execution_selector_squeezed');
      const until=async(predicate,label)=>{for(let i=0;i<200;i++){if(predicate())return;await wait();}throw Error(label);};
      const key=k=>{const form=panel.querySelector('form.library-confirm');assert(form,'analysis_key_prompt_missing');form.querySelector('input').value=k;form.requestSubmit();};
      ab('analysis-prepare').click();await until(()=>!ab('analysis-prepare').disabled,'analysis_prepare_wait');
      assert(field('input').value===plan.input&&field('input').readOnly&&ab('analysis-run').disabled&&invoked===0,'analysis_unconfirmed_dispatched');
      field('model').value='combo-name';field('confirm').checked=true;field('confirm').dispatchEvent(new Event('change'));ab('analysis-run').click();
      await until(()=>panel.querySelector('form.library-confirm'),'analysis_initial_key_wait');key('fixture-key');await until(()=>invoked===1,'analysis_invoke_wait');
      assert(!panel.querySelector('form.library-confirm')&&!field('input').value,'analysis_input_retained_during_provider');
      release();await until(()=>panel.querySelector('form.library-confirm'),'analysis_new_key_wait');key('new-output-key');
      await until(()=>recorded===1&&!ab('analysis-prepare').disabled,'analysis_finish_wait');
      assert(panel.querySelector('.protection-analysis-result').textContent.includes('SYNTHETIC-RESULT')&&!panel.querySelector('script'),'analysis_result_unsafe_or_missing');
      assert(!ab('analysis-publish').disabled,'analysis_publish_disabled');ab('analysis-publish').click();await until(()=>panel.querySelector('form.library-confirm'),'analysis_publish_key_wait');key('publication-key');
      await until(()=>published===1&&!ab('analysis-prepare').disabled,'analysis_publish_wait');assert(invoked===1&&panel.querySelector('.protection-analysis-result').textContent==='SERVER-SYNTHETIC-RESULT'&&ab('analysis-publish').disabled,'analysis_publish_reinvoked_provider_or_state');
      info.pending={id:'fixture-run',phase:'analysis_settled'};info.analysisOperations=[info.pending];await analysis.open();
      ab('analysis-replan').click();await until(()=>panel.querySelector('form.library-confirm'),'replan_old_key_wait');key('replan-original-key');
      await until(()=>!panel.querySelector('.protection-replan').classList.contains('hidden')&&!ab('analysis-replan').disabled,'replan_confirmation_wait');
      assert(ab('analysis-replan-confirm').disabled&&replanned===0&&invoked===1,'replan_without_confirmation');
      assert(panel.querySelector('.protection-replan-context').textContent.includes('2'),'replan_target_missing');
      const reuse=panel.querySelector('[name="analysis-reuse-confirm"]');reuse.checked=true;reuse.dispatchEvent(new Event('change'));ab('analysis-replan-confirm').click();
      await until(()=>panel.querySelector('form.library-confirm'),'replan_target_key_wait');key('replan-target-key');
      await until(()=>replanned===1&&!ab('analysis-prepare').disabled,'replan_finish_wait');assert(invoked===1&&panel.querySelector('.protection-analysis-result').textContent==='REPLANNED-SYNTHETIC-RESULT','replan_called_provider_or_lost_result');
      info.pending={id:'fixture-run',phase:'analysis_replan_committing'};info.analysisOperations=[info.pending];await analysis.open();ab('analysis-resume').click();
      await until(()=>panel.querySelector('form.library-confirm'),'replan_resume_old_key');key('replan-original-key');await until(()=>panel.querySelector('form.library-confirm'),'replan_resume_target_key');key('replan-target-key');
      await until(()=>replanResumed===1&&!ab('analysis-prepare').disabled,'replan_resume_finish');assert(invoked===1,'replan_resume_called_provider');
      replanView.original_source_context={base:{crypto_epoch:1,history_generation:3}};
      info.pending={id:'fixture-run',phase:'analysis_settled'};info.analysisOperations=[info.pending];await analysis.open();ab('analysis-replan').click();
      await until(()=>panel.querySelector('form.library-confirm'),'legacy_replan_old_key');key('replan-original-key');
      await until(()=>!panel.querySelector('.protection-replan').classList.contains('hidden')&&!ab('analysis-replan').disabled,'legacy_replan_context_wait');
      assert(panel.querySelector('.protection-replan-context').textContent.includes('보호 세대 1 · 이력 3')&&ab('analysis-replan-confirm').disabled&&replanned===1&&invoked===1,'legacy_replan_source_or_confirmation');
      analysis.lock();info.pending=null;info.analysisOperations=[];await analysis.open();
      ab('analysis-prepare').click();await until(()=>!ab('analysis-prepare').disabled,'analysis_second_prepare_wait');field('model').value='combo-name';field('confirm').checked=true;field('confirm').dispatchEvent(new Event('change'));ab('analysis-run').click();
      await until(()=>panel.querySelector('form.library-confirm'),'analysis_second_key_wait');key('fixture-key');await until(()=>invoked===2,'analysis_second_invoke_wait');
      analysis.lock();release();await until(()=>unavailable===1,'analysis_locked_terminal_wait');
      assert(recorded===1&&!panel.querySelector('.protection-analysis-result').textContent&&!field('input').value,'analysis_late_raw_after_lock');analysis.invalidate();
      globalThis.renderReplanPreview=async()=>{
        document.documentElement.dataset.theme='dark';
        info.pending={id:'fixture-run',phase:'analysis_settled'};info.analysisOperations=[info.pending];await analysis.open();
        ab('analysis-replan').click();await until(()=>panel.querySelector('form.library-confirm'),'capture_replan_key');key('replan-original-key');
        await until(()=>!panel.querySelector('.protection-replan').classList.contains('hidden')&&!ab('analysis-replan').disabled,'capture_replan_ready');
        panel.querySelector('.protection-replan').scrollIntoView({block:'center'});
        const rect=panel.querySelector('.protection-replan').getBoundingClientRect();assert(rect.width>0&&rect.left>=0&&rect.right<=innerWidth,'replan_panel_overflow');
        const label=panel.querySelector('.protection-replan label').getBoundingClientRect(),submit=ab('analysis-replan-confirm').getBoundingClientRect();
        assert(submit.top>=label.bottom&&submit.right<=innerWidth,'replan_confirmation_overlap');
        const rgb=s=>s.match(/[0-9.]+/g).slice(0,3).map(Number),lum=c=>c.map(v=>{v/=255;return v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4;}).reduce((sum,v,i)=>sum+v*[0.2126,0.7152,0.0722][i],0);
        const a=lum(rgb(getComputedStyle(ab('analysis-replan')).color)),b=lum(rgb(getComputedStyle(panel).backgroundColor));
        assert((Math.max(a,b)+0.05)/(Math.min(a,b)+0.05)>=4.5,'replan_command_contrast');
      };
      return {ok:true,sanitizedPreview:true,sourceSelectionPreserved:true,nativeUndoRedo:true,lockCleared:true,transcriptEdit:true,transcriptNull:true,transcriptLockUndo:true,analysisConfirmation:true,freshOutputKey:true,publicationCommand:true,replanConfirmation:true,replanDistinctKeys:true,replanResume:true,lateTerminalMetadataOnly:true,transport:'none',osIME:'not run'};
    })()`,true);
    const capture=async name=>{
      const dir=process.env.NOWNOTE_QA_MANIFEST_DIR;if(!dir)return;
      if(path.resolve(dir)!==path.resolve('D:/Project/Now/docs/2.4.0/qa'))throw Error('capture_directory_boundary');
      await window.webContents.executeJavaScript('renderReplanPreview()');
      await window.webContents.executeJavaScript('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
      fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'protected-replan-'+name+'.png'),(await window.webContents.capturePage()).toPNG());
    };
    await capture('desktop');window.setContentSize(390,844);await capture('mobile');
    const mobile=await window.webContents.executeJavaScript(`(()=>{const d=document.querySelector('#noteProtectionDialog');if(!d.open)d.showModal();const s=d.querySelector('[name="analysis-operation"]');return {width:d.clientWidth,selectorWidth:s.getBoundingClientRect().width,dialogRight:d.getBoundingClientRect().right,viewport:innerWidth};})()`);
    if(mobile.selectorWidth<=mobile.width*0.8||mobile.dialogRight>mobile.viewport)throw Error('analysis_mobile_layout');
    result.mobileLayout=true;
    const captureTranscript=async name=>{
      await window.webContents.executeJavaScript('renderTranscriptPreview()');
      await window.webContents.executeJavaScript('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
      const dir=process.env.NOWNOTE_QA_MANIFEST_DIR;
      if(dir){if(path.resolve(dir)!==path.resolve('D:/Project/Now/docs/2.4.0/qa'))throw Error('capture_directory_boundary');fs.writeFileSync(path.join(dir,'protected-transcript-'+name+'.png'),(await window.webContents.capturePage()).toPNG());}
    };
    window.setContentSize(1100,800);await captureTranscript('desktop');window.setContentSize(390,844);await captureTranscript('mobile');
    if(outbound)throw Error('preview_outbound_request');
    result.outboundRequests=outbound;
  }catch(error){result={ok:false,error:error.message};}
  finally{fs.writeFileSync(path.join(own,'result.json'),JSON.stringify(result));window?.destroy();app.exit(result.ok?0:1);}
});
