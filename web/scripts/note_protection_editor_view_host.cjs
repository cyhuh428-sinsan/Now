const {app,BrowserWindow,session}=require('electron');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),own=path.resolve(process.argv[2]);
if(!own.startsWith(path.resolve('D:/tmp/now-240-protected-view')+path.sep))throw Error('profile_boundary');
app.setPath('userData',path.join(own,'profile'));app.disableHardwareAcceleration();
app.whenReady().then(async()=>{
  let window;let result;let outbound=0;
  try{
    session.defaultSession.webRequest.onBeforeRequest((d,done)=>{const cancel=!d.url.startsWith('data:');if(cancel)outbound++;done({cancel});});
    window=new BrowserWindow({show:false,width:1100,height:800,webPreferences:{contextIsolation:true,nodeIntegration:false}});
    await window.loadURL('data:text/html,<html><body></body></html>');
    await window.webContents.executeJavaScript('document.head.append(Object.assign(document.createElement("style"),{textContent:'+JSON.stringify(fs.readFileSync(path.join(root,'web/styles.css'),'utf8'))+'}));void 0;');
    for(const name of ['marked.umd.js','purify.min.js','document-renderer.js','note-protection-ui.js'])await window.webContents.executeJavaScript(fs.readFileSync(path.join(root,'web/vendor',name),'utf8')+'\n;void 0;');
    result=await window.webContents.executeJavaScript(`(async()=>{
      const assert=(v,m)=>{if(!v)throw Error(m);},wait=()=>new Promise(r=>setTimeout(r,10));
      const original='# View test\\n\\n<details><summary>Fold</summary>\\n\\n**Bold**\\n\\n</details>\\n\\nhttps://example.invalid/page\\n\\n[File](D:/synthetic-only.md)\\n\\n<script>globalThis.BAD=true</script>\\n<img src="https://example.invalid/image" onerror="globalThis.BAD=true">';
      let drafts=[],files=[],locked=0;
      const scope={url:'https://synthetic.invalid',owner:'alice',local_id:'one',instance:'synthetic'};
      const info={scope,status:{crypto_epoch:1},catalog:{context:{base:{current_exists:true},current_mode:'protected'}},rows:[],pending:null};
      const ui=mountNoteProtection({contextKey:()=> 'one',canMutate:()=>true,targets:async()=>['one'],target:()=> 'one',selectTarget:()=>{},inspect:async()=>info,copies:async()=>[],lock:()=>{locked++;},edit:async()=>({title:'View',content:original}),draft:async(i,n)=>{drafts.push(n.content);},openFile:p=>{files.push(p);}});
      await ui.open();
      const dialog=document.querySelector('#noteProtectionDialog'),button=n=>dialog.querySelector('[data-action="'+n+'"]');
      assert(button('analysis-prepare'),'analysis_prepare_missing');
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
      assert(locked>0,'lock_missing');ui.invalidate();dialog.remove();
      let invoked=0,recorded=0,unavailable=0,release;
      const plan={scope,operation_id:null,input:'SYNTHETIC-ANALYSIS-INPUT',route:{provider:'omniroute',endpoint:'http://127.0.0.1:1/v1',model:'auto'}};
      const analysis=mountNoteProtection({contextKey:()=> 'one',canMutate:()=>true,targets:async()=>['one'],target:()=> 'one',selectTarget:()=>{},inspect:async()=>info,copies:async()=>[],lock:()=>{},
        analysisPrepare:async()=>structuredClone(plan),analysisBegin:async(p,r,k)=>{assert(k==='fixture-key'&&r.model==='combo-name','analysis_confirmation_changed');return {operation_id:'fixture-run',provider_state:'ready'};},
        analysisInvoke:async()=>{invoked++;return new Promise(r=>{release=()=>r({provider_terminal_observed:true,outcome:'done',result_json:'SYNTHETIC-RESULT'});});},
        analysisRecord:async(h,o,k)=>{assert(k==='new-output-key','analysis_key_reused_across_provider');recorded++;},analysisFinish:async()=>'<script>not HTML</script> SYNTHETIC-RESULT',
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
      ab('analysis-prepare').click();await until(()=>!ab('analysis-prepare').disabled,'analysis_second_prepare_wait');field('model').value='combo-name';field('confirm').checked=true;field('confirm').dispatchEvent(new Event('change'));ab('analysis-run').click();
      await until(()=>panel.querySelector('form.library-confirm'),'analysis_second_key_wait');key('fixture-key');await until(()=>invoked===2,'analysis_second_invoke_wait');
      analysis.lock();release();await until(()=>unavailable===1,'analysis_locked_terminal_wait');
      assert(recorded===1&&!panel.querySelector('.protection-analysis-result').textContent&&!field('input').value,'analysis_late_raw_after_lock');analysis.invalidate();
      return {ok:true,sanitizedPreview:true,sourceSelectionPreserved:true,nativeUndoRedo:true,lockCleared:true,analysisConfirmation:true,freshOutputKey:true,lateTerminalMetadataOnly:true,transport:'none',osIME:'not run'};
    })()`,true);
    window.setContentSize(390,844);
    const mobile=await window.webContents.executeJavaScript(`(()=>{const d=document.querySelector('#noteProtectionDialog');d.showModal();const s=d.querySelector('[name="analysis-operation"]');return {width:d.clientWidth,selectorWidth:s.getBoundingClientRect().width,dialogRight:d.getBoundingClientRect().right,viewport:innerWidth};})()`);
    if(mobile.selectorWidth<=mobile.width*0.8||mobile.dialogRight>mobile.viewport)throw Error('analysis_mobile_layout');
    result.mobileLayout=true;
    if(outbound)throw Error('preview_outbound_request');
    result.outboundRequests=outbound;
  }catch(error){result={ok:false,error:error.message};}
  finally{fs.writeFileSync(path.join(own,'result.json'),JSON.stringify(result));window?.destroy();app.exit(result.ok?0:1);}
});
