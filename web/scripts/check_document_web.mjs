import { promises as fs } from 'node:fs';
import { verifyDocumentFlow } from './document_fixture.mjs';
const task=await taskSpace('NowNote Stage B'),page=task.page('p1');
await page.goto(new URL('../index.html',import.meta.url).href);
const result=await verifyDocumentFlow({evaluate:s=>page.evaluate(s),click:s=>page.click(s),fill:(s,text)=>page.fill(s,text)});
await page.click('#documentFormattedBtn');
await page.screenshot({path:'D:/tmp/now-240-stage-b/web.png'});
await fs.writeFile('D:/tmp/now-240-stage-b/web.json',JSON.stringify(result,null,2));
console.log({...result,source:'원문 일치',code:result.code?.slice(0,50)});
