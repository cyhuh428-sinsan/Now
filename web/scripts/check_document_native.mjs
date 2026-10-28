import { promises as fs } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';
import { launchApp, evaluate, stopProcess } from '../../desktop/scripts/check-desktop-storage.mjs';
const out='D:/tmp/now-240-stage-b';
const profile=await fs.mkdtemp(out+'/native-');
const sample=out+'/NowNote-StageB-QA.txt';
await fs.writeFile(sample,'NowNote Stage B synthetic local document.\n');
const spaced=out+'/한글 hello world.md';
await fs.writeFile(spaced,'# NowNote Stage B synthetic encoded document\n');
const literal=out+'/hello%20world.md';
await fs.writeFile(literal,'# NowNote Stage B literal percent document\n');
const inputs={absolute:sample,relative:'./NowNote-StageB-QA.txt',
  'encoded-path':out+'/'+encodeURIComponent('한글 hello world.md'),
  'encoded-url':pathToFileURL(spaced).href,'literal-percent':literal};
const command=out+'/native-command.json';
await fs.writeFile(command,JSON.stringify({action:'wait'}));
let app;
try {
  app=await launchApp(profile);
  await evaluate(app.page,`(() => { document.title='NowNote Stage B native QA';const note=createNode('Native QA',${JSON.stringify('[절대 파일](file:///'+sample+')\n\n[상대 파일](./NowNote-StageB-QA.txt)\n\n[테스트 URL](https://example.com/?nownote-stage-b-qa)')},null,1);state.data.tree=[note];state.selectedTreeId=note.id;setView('tree');setDocumentMode(true); })()`);
  console.log('Native QA ready: '+app.app.pid);
  const results=[];
  const deadline=Date.now()+10*60*1000;
  while(Date.now()<deadline){
    const {action}=JSON.parse(await fs.readFile(command,'utf8'));
    if(action==='finish')break;
    if(action==='wait'){await delay(200);continue;}
    await fs.writeFile(command,JSON.stringify({action:'wait'}));
    if(Object.hasOwn(inputs,action)){
      const input=inputs[action];
      // 지원 UI 도구가 네이티브 선택·확인창을 조작하는 동안 기다린다.
      const result=await evaluate(app.page,`window.nownoteDesktop.openDocumentFile(${JSON.stringify(input)})`);
      results.push({action,...result});console.log({action,...result});
    }else if(action==='external'){
      await evaluate(app.page,"elements.markdownPreview.querySelector('a[href^=\"https:\"]').click()");
      results.push({action,requested:true});console.log('External URL requested');
    }
    await fs.writeFile(out+'/native.json',JSON.stringify(results,null,2));
  }
}finally{
  app?.client.close();stopProcess(app?.app);await delay(300);
  await fs.rm(profile,{recursive:true,force:true});
}
