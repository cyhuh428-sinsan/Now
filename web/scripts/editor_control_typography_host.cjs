const {app,BrowserWindow}=require('electron');
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const [root,own]=process.argv.slice(2);app.setPath('userData',path.join(own,'profile'));
app.whenReady().then(async()=>{
  let window;
  try{
    window=new BrowserWindow({show:false,width:1100,height:780,webPreferences:{contextIsolation:true,nodeIntegration:false}});
    for(const mode of ['web','desktop']){
      const base=path.join(root,mode==='web'?'web':'desktop/app');
      const css=await fs.readFile(path.join(base,'styles.css'),'utf8'),source=await fs.readFile(path.join(base,'app.js'),'utf8');
      const begin=source.indexOf('function initializeBlockReferences() {'),end=source.indexOf('\nfunction blockReferenceContext()',begin);
      assert.ok(begin>0&&end>begin);
      const html='<html data-theme="dark"><head><style>'+css+'</style></head><body><section class="tree-editor"><div class="editor-status"><div class="note-action-menu-wrap"><button id="menu">메모 메뉴</button><div id="actions" class="note-action-menu"><button id="reference" class="secondary-btn">Markdown 보기</button></div></div></div><div class="document-mode"><button id="documentSourceBtn" aria-pressed="true">원문 편집</button><button id="documentFormattedBtn" aria-pressed="false">서식 보기</button></div><textarea id="content"></textarea><article id="preview" class="hidden"></article></section></body></html>';
      await window.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent(html));
      await window.webContents.executeJavaScript(`globalThis.elements={noteActionMenuBtn:document.querySelector('#menu'),noteActionMenu:document.querySelector('#actions'),treeContent:document.querySelector('#content'),markdownPreview:document.querySelector('#preview')};${source.slice(begin,end)};initializeBlockReferences();`);
      for(const width of [1100,390]){
        window.setSize(width,780);
        for(const size of ['small','medium','large']){
          const values=await window.webContents.executeJavaScript(`(()=>{document.documentElement.dataset.fontSize=${JSON.stringify(size)};return ['reference','noteBlockCopyBtn','noteBlockInsertBtn','documentSourceBtn','documentFormattedBtn'].map(id=>{const e=document.getElementById(id),s=getComputedStyle(e);return {id,font:s.fontSize,weight:s.fontWeight,family:s.fontFamily,background:s.backgroundColor,border:s.borderWidth,overflow:e.scrollWidth>e.clientWidth};})})()`);
          console.log(JSON.stringify({mode,width,size,font:values[0].font,weight:values[0].weight,controls:values.length}));
          for(const value of values){assert.equal(value.font,values[0].font,value.id+' font');assert.equal(value.weight,values[0].weight,value.id+' weight');assert.equal(value.family,values[0].family,value.id+' family');assert.equal(value.overflow,false,value.id+' overflow');}
          for(const value of values.slice(1,3)){assert.equal(value.background,values[0].background);assert.equal(value.border,values[0].border);}
        }
      }
      const image=await window.webContents.capturePage();
      await fs.writeFile(path.join(own,mode+'.png'),image.toPNG());
      if(process.env.NOWNOTE_TYPE_SCREENSHOTS){await fs.mkdir(process.env.NOWNOTE_TYPE_SCREENSHOTS,{recursive:true});await fs.copyFile(path.join(own,mode+'.png'),path.join(process.env.NOWNOTE_TYPE_SCREENSHOTS,mode+'.png'));}
    }
    console.log('Web/Desktop control typography, dynamic block commands, compact modes and small/medium/large settings PASS');
  }finally{window?.destroy();}
}).then(()=>app.exit(0)).catch(error=>{console.error(error);app.exit(1);});
