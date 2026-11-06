const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
for(const surface of ['web','desktop/app']){
 const source=fs.readFileSync(require('node:path').resolve(__dirname,'../../'+surface+'/app.js'),'utf8').replace(/\r\n/g,'\n');
 const start=source.indexOf('function isEditorComposing('),end=source.indexOf('\nconst WRITING_TEMPLATES',start);
 function fixture(){
  let key='document-a',allowed=true,writes=0;const handlers={},saved=[];
  const editor={_value:'old',selectionStart:1,selectionEnd:1,scrollTop:120,addEventListener:(k,f)=>handlers[k]=f,
   get value(){return this._value;},set value(v){writes++;this._value=v;this.selectionStart=v.length;this.selectionEnd=v.length;this.scrollTop=0;}};
  const box=vm.createContext({composingEditors:new Set(),pendingEditorInputFlush:new Set(),pendingEditorValueWrite:new Map(),elements:{treeContent:null}});
  vm.runInContext(source.slice(start,end),box);
  box.bindEditorComposition(editor,()=>saved.push(editor.value),{context:()=>key,writable:()=>allowed});
  return {box,editor,handlers,saved,writes:()=>writes,key:v=>key=v,allowed:v=>allowed=v};
 }
 test(surface+': same-document render cannot overwrite composing input or discard its final save',()=>{
  const f=fixture();f.handlers.compositionstart();f.editor._value='old 마지막';
  f.box.handleEditorInput(f.editor,{isComposing:true},()=>{});f.box.setEditorValue(f.editor,'old');f.handlers.compositionend();
  assert.equal(f.editor.value,'old 마지막');assert.deepEqual(f.saved,['old 마지막']);assert.equal(f.writes(),0);
 });
 test(surface+': equal render never rewrites the value or moves selection and scroll',()=>{
  const f=fixture();f.box.setEditorValue(f.editor,'old');assert.equal(f.writes(),0);
  assert.equal(f.editor.selectionStart,1);assert.equal(f.editor.scrollTop,120);
 });
 test(surface+': changed document or revoked editing applies the authoritative value without saving into the new target',()=>{
  for(const change of [f=>f.key('document-b'),f=>f.allowed(false)]){
   const f=fixture();f.handlers.compositionstart();f.editor._value='old 마지막';f.box.handleEditorInput(f.editor,{isComposing:true},()=>{});
   change(f);f.box.setEditorValue(f.editor,'authoritative');f.handlers.compositionend();
   assert.equal(f.editor.value,'authoritative');assert.equal(f.saved.length,0);
  }
 });
 test(surface+': blur settles edited composition once; a later compositionend does not overwrite it',()=>{
  const f=fixture();f.handlers.compositionstart();f.editor._value='old 마지막';f.box.handleEditorInput(f.editor,{isComposing:true},()=>{});
  f.box.setEditorValue(f.editor,'old');f.handlers.blur();f.handlers.compositionend();
  assert.deepEqual(f.saved,['old 마지막']);assert.equal(f.editor.value,'old 마지막');
 });
 test(surface+': a late composition end without a queued render cannot save into another document',()=>{
  const f=fixture();f.handlers.compositionstart();f.editor._value='old 마지막';f.box.handleEditorInput(f.editor,{isComposing:true},()=>{});
  f.key('document-b');f.handlers.compositionend();assert.equal(f.saved.length,0);
 });
 test(surface+': source editing never parses or populates the hidden formatted preview',()=>{
  let parses=0,hydrations=0,hidden=true;const panel={innerHTML:'preserved',classList:{contains:()=>hidden}};
  const box=vm.createContext({elements:{markdownPreview:panel},markdownToHtml:()=>{parses++;return '<p>formatted</p>';},hydrateNoteAttachmentImages:()=>hydrations++});
  const start=source.indexOf('function renderMarkdownPreview('),end=source.indexOf('\nfunction revealDocumentHeading(',start);
  vm.runInContext(source.slice(start,end),box);box.renderMarkdownPreview('large synthetic input');
  assert.equal(parses,0);assert.equal(hydrations,0);assert.equal(panel.innerHTML,'preserved');
  hidden=false;box.renderMarkdownPreview('current');assert.equal(parses,1);assert.equal(panel.innerHTML,'<p>formatted</p>');assert.equal(hydrations,1);
 });
 function resumeFixture(){
  let release;const pending=new Promise(r=>release=r),notes=[];const history={suspended:()=>false,matches:()=>true,currentEntries:()=>({a:{draft:{level:1,title:'saved'}}})};
  const box=vm.createContext({noteHistory:history,noteHistoryCaptureChain:pending,noteHistoryCaptureEpoch:1,
   noteHistoryContext:()=>({enabled:true}),contextKey:()=>box.key,elements:{treeContent:{}},isEditorComposing:()=>box.composing,
   noteHistoryProjection:false,noteHistoryProject:n=>notes.push(n),render:()=>{},key:'account-a',composing:false});
  const start=source.indexOf('    async resume({renderView=true,projectView=true}={})',source.indexOf('  noteHistoryController = {'));
  const end=source.indexOf('\n    },\n  };',start)+7;
  assert.ok(start>=0&&end>start,'history resume method');
  const method=vm.runInContext('({'+source.slice(start,end)+'})',box);
  return {box,notes,release,run:()=>method.resume()};
 }
 test(surface+': asynchronous projection waits for captured edits rather than overwriting their editor model',async()=>{
  const f=resumeFixture(),pending=f.run();assert.equal(f.notes.length,0);f.release();await pending;assert.equal(f.notes.length,1);
 });
 test(surface+': composition or a newer capture starting during projection wait cancels the stale repaint',async()=>{
  for(const change of [f=>f.box.composing=true,f=>f.box.noteHistoryCaptureChain=Promise.resolve(),f=>f.box.key='account-b']){
   const f=resumeFixture(),pending=f.run();change(f);f.release();await pending;assert.equal(f.notes.length,0);
  }
 });
}
