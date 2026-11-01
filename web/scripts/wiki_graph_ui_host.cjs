const {app,BrowserWindow,session}=require('electron');
const fs=require('node:fs'),path=require('node:path');
const c=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
if(!path.resolve(c.own).startsWith(path.resolve('D:/tmp/now-240-wiki-graph')+path.sep)||!['web','desktop'].includes(c.mode))throw Error('qa_boundary');
app.setPath('userData',path.join(c.own,c.mode));app.disableHardwareAcceleration();
let window,network=0;
app.whenReady().then(async()=>{
  try{
    session.defaultSession.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*']},(_d,done)=>{network++;done({cancel:true});});
    window=new BrowserWindow({show:false,width:1280,height:900,webPreferences:{contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}});
    await window.loadFile(path.join(c.root,c.mode==='web'?'web/index.html':'desktop/app/index.html'));
    const run=async code=>{
      const value=await window.webContents.executeJavaScript('(async()=>{try{return await ('+code+');}catch(error){return {__qa_error:error.message,stack:error.stack};}})()');
      if(value?.__qa_error)throw Error(value.__qa_error+' | '+value.stack);return value;
    };
    for(let i=0;i<300;i++){if(await run('typeof wikiUI!=="undefined"&&Boolean(wikiUI)'))break;await new Promise(r=>setTimeout(r,20));if(i===299)throw Error('app_init');}
    await run(`(async()=>{
      wikiUI.close();document.querySelector('#wikiDialog').remove();
      globalThis.__graphCatalog=${JSON.stringify(c.catalog)};globalThis.__graphDocuments=${JSON.stringify(c.documents)};
      globalThis.__graphKey='one';globalThis.__graphUnlocked=true;
      const mount=mountWikiGraph;globalThis.mountWikiGraph=options=>(globalThis.__graphHandle=mount(options));
      globalThis.__graphUi=mountNowWiki({contextKey:()=>__graphKey,list:async()=>__graphDocuments.map(document=>({document})),
        canRead:()=>__graphUnlocked,sourceStatus:async()=>({available:true,stale:false}),notes:()=>[],approvedCatalog:async()=>__graphCatalog});
      await __graphUi.open();document.querySelector('[data-wiki-action=graph]').click();
    })()`);
    for(let i=0;i<300;i++){if(await run('Boolean(globalThis.__graphHandle?.instance)'))break;await new Promise(r=>setTimeout(r,20));if(i===299)throw Error('graph_missing');}
    const captures=[];
    for(const [label,width,height]of [['wide',1280,900],['narrow',390,844]]){
      window.setContentSize(width,height);
      await run(`new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`);
      const evidence=await run(`(async()=>{
        const cy=__graphHandle.instance,canvas=document.querySelector('.wiki-graph-canvas');
        cy.resize();cy.fit(undefined,36);
        await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
        const controls=document.querySelector('.wiki-graph-controls'),r=canvas.getBoundingClientRect(),d=document.querySelector('#wikiDialog').getBoundingClientRect();
        const pixels=[...canvas.querySelectorAll('canvas')].reduce((count,c)=>{const values=c.getContext('2d').getImageData(0,0,c.width,c.height).data;for(let i=3;i<values.length;i+=4)if(values[i])count++;return count;},0);
        if(pixels<100||r.width<100||r.right>d.right+1||controls.getBoundingClientRect().right>d.right+1)throw Error('graph_frame_or_pixels_'+JSON.stringify({pixels,width:r.width,right:r.right,dialogRight:d.right,controlsRight:controls.getBoundingClientRect().right}));
        if(cy.nodes().length!==2||cy.edges().length!==2||!cy.nodes().every(n=>n.data('label')&&n.renderedWidth()>2))throw Error('graph_labels');
        const before=cy.zoom();[...controls.querySelectorAll('button')].find(b=>b.title==='확대').click();if(!(cy.zoom()>before))throw Error('graph_zoom');
        [...controls.querySelectorAll('button')].find(b=>b.title==='그래프 맞춤').click();
        return {pixels,width:r.width,height:r.height,nodes:cy.nodes().map(n=>n.data('label')),edges:cy.edges().length};
      })()`);
      await new Promise(r=>setTimeout(r,70));
      const name='wiki-graph-'+c.run+'-'+c.mode+'-'+label+'.png';fs.writeFileSync(path.join(c.directory,name),(await window.webContents.capturePage()).toPNG());captures.push({label,...evidence,screenshot:name});
    }
    await run(`(async()=>{
      const controls=document.querySelector('.wiki-graph-controls'),selection=controls.querySelector('[data-wiki-graph=selection]');
      selection.value=__graphCatalog.nodes[0].wiki_id;selection.dispatchEvent(new Event('change'));
      if(!document.querySelector('.wiki-graph-relations').textContent.includes('들어오는 관계'))throw Error('graph_selection');
      controls.querySelector('[data-wiki-graph=from]').value=__graphCatalog.nodes[0].wiki_id;
      controls.querySelector('[data-wiki-graph=to]').value=__graphCatalog.nodes[1].wiki_id;
      [...controls.querySelectorAll('button')].find(b=>b.textContent==='경로 찾기').click();
      if(!document.querySelector('.wiki-graph-relations').textContent.includes('1개 관계')||__graphHandle.instance.nodes('.wiki-path').length!==2)throw Error('graph_path');
      [...document.querySelectorAll('.wiki-graph-relations button')].find(b=>b.textContent==='Beta').click();
      for(let i=0;i<300;i++){if(document.querySelector('.wiki-body'))break;await new Promise(r=>setTimeout(r,10));}
      if(!document.querySelector('.wiki-body')||!__graphHandle.instance.destroyed())throw Error('graph_open_or_dispose');
      document.querySelector('[data-wiki-action=graph]').click();
      for(let i=0;i<300;i++){if(!__graphHandle.instance.destroyed())break;await new Promise(r=>setTimeout(r,10));}
      const old=__graphHandle.instance;__graphUnlocked=false;__graphUi.check();
      if(document.querySelector('#wikiDialog').open||!old.destroyed()||document.querySelector('#wikiDialog').textContent)throw Error('graph_lock_leak');
      __graphUnlocked=true;await __graphUi.open();document.querySelector('[data-wiki-action=graph]').click();
      for(let i=0;i<300;i++){if(!__graphHandle.instance.destroyed())break;await new Promise(r=>setTimeout(r,10));}
      const next=__graphHandle.instance;__graphKey='other';__graphUi.check();
      if(document.querySelector('#wikiDialog').open||!next.destroyed()||document.querySelector('#wikiDialog').textContent)throw Error('graph_account_leak');
      __graphCatalog={...__graphCatalog,nodes:[],edges:[]};await __graphUi.open();document.querySelector('[data-wiki-action=graph]').click();
      for(let i=0;i<300;i++){if(document.querySelector('.wiki-detail').textContent.includes('표시할 승인 위키가 없습니다.'))break;await new Promise(r=>setTimeout(r,10));}
      if([...document.querySelectorAll('.wiki-graph-controls button')].some(b=>!b.disabled))throw Error('graph_empty_controls');
      __graphUi.close();
    })()`);
    fs.writeFileSync(c.result,JSON.stringify({ok:true,captures,blockedNetwork:network,externalCalls:0}));window.destroy();app.exit(0);
  }catch(error){fs.writeFileSync(c.result,JSON.stringify({ok:false,code:error.message}));window?.destroy();app.exit(1);}
});
