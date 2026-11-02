import { promises as fs } from 'node:fs';
const task = await taskSpace('NowNote Stage D');
const page = await task.newPage();
const origin = `http://nownote-stage-d-${Date.now()}.localhost:8750`;
await page.goto(origin);
await fs.writeFile('D:/tmp/now-240-stage-d/hosted-page.json', JSON.stringify({ page: page.label, origin }));
console.log({ page: page.label, hosted: await page.evaluate(() => isHostedWebClient()) });
console.log(await page.snapshot());
