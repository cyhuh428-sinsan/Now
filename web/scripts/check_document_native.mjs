import { promises as fs } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { launchApp, evaluate, stopProcess } from '../../desktop/scripts/check-desktop-storage.mjs';
const out='D:/tmp/now-240-stage-b';
const profile=await fs.mkdtemp(out+'/native-');
const sample=out+'/NowNote-StageB-QA.txt';
await fs.writeFile(sample,'NowNote Stage B synthetic local document.\n');
let app;
try {
  app=await launchApp(profile);
  console.log('Native document confirmation ready');
  const result=await evaluate(app.page,`window.nownoteDesktop.openDocumentFile(${JSON.stringify(sample)})`);
  await fs.writeFile(out+'/native.json',JSON.stringify(result));
  console.log(result);
}finally{
  app?.client.close();stopProcess(app?.app);await delay(300);
  await fs.rm(profile,{recursive:true,force:true});
}
