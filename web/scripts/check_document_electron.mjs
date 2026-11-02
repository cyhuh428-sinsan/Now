import { promises as fs } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { launchApp, evaluate as evalPage, stopProcess } from '../../desktop/scripts/check-desktop-storage.mjs';
import { documentFixture, verifyDocumentFlow } from './document_fixture.mjs';

const out='D:/tmp/now-240-stage-b';
await fs.mkdir(out,{recursive:true});
const profile=await fs.mkdtemp(out+'/electron-');
let first,second;
try {
  first=await launchApp(profile);
  const evaluate=source=>evalPage(first.page,source);
  const click=async selector=>{
    const pos=await evaluate(`(() => { const e=document.querySelector(${JSON.stringify(selector)});e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}; })()`);
    await first.page.send('Input.dispatchMouseEvent',{type:'mousePressed',...pos,button:'left',clickCount:1});
    await first.page.send('Input.dispatchMouseEvent',{type:'mouseReleased',...pos,button:'left',clickCount:1});
  };
  const fill=async(selector,text)=>{
    await evaluate(`(() => {const e=document.querySelector(${JSON.stringify(selector)});e.focus();e.select()})()`);
    await first.page.send('Input.insertText',{text});
  };
  const result=await verifyDocumentFlow({evaluate,click,fill});
  await click('#documentFormattedBtn');
  const shot=await first.page.send('Page.captureScreenshot');
  await fs.writeFile(out+'/electron.png',Buffer.from(shot.data,'base64'));
  await fs.writeFile(out+'/electron.json',JSON.stringify(result,null,2));
  await delay(500);
  first.client.close();stopProcess(first.app);first=null;
  second=await launchApp(profile);
  const content=await evalPage(second.page,'state.data.tree[0].content');
  if(content!==documentFixture)throw new Error('재시작 후 원문 불일치');
  console.log({details:result.details,headings:result.headings.length,attacked:result.attacked,sourceRoundtrip:true,restart:true});
}finally{
  first?.client.close();second?.client.close();stopProcess(first?.app);stopProcess(second?.app);
  await delay(300);await fs.rm(profile,{recursive:true,force:true});
}
