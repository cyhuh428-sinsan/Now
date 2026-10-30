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
      assert(locked>0,'lock_missing');ui.invalidate();
      return {ok:true,sanitizedPreview:true,sourceSelectionPreserved:true,nativeUndoRedo:true,lockCleared:true,transport:'none',osIME:'not run'};
    })()`,true);
    if(outbound)throw Error('preview_outbound_request');
    result.outboundRequests=outbound;
  }catch(error){result={ok:false,error:error.message};}
  finally{fs.writeFileSync(path.join(own,'result.json'),JSON.stringify(result));window?.destroy();app.exit(result.ok?0:1);}
});
