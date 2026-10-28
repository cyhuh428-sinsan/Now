import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { launchApp, evaluate, stopProcess } from '../../desktop/scripts/check-desktop-storage.mjs';
const dir=await fs.mkdtemp('D:/tmp/now-240-stage-d/final-electron-');
let app;
try {
  app=await launchApp(dir);
  const run=s=>evaluate(app.page,s);
  const until=async expression=>{for(let i=0;i<100;i++){if(await run(expression))return;await delay(30);}throw Error(expression);};
  await until('Boolean(libraryStore&&libraryUI)');
  await run('libraryUI.open()');
  await run(`document.querySelector('#libraryDetail [data-action="clone"]').click()`);
  await until(`libraryStore.list('templates').length===1`);
  await until(`Boolean(document.querySelector('#libraryDetail [data-action="delete"]'))`);
  await run(`document.querySelector('#libraryDetail [data-action="create-note"]').click()`);
  await until('Boolean(getSelectedTreeNode())');
  const original=await run('getSelectedTreeNode().content');
  await run(`document.querySelector('#libraryDetail [data-action="insert"]').click()`);
  await until(`Boolean(document.querySelector('.library-confirm'))`);
  assert.equal(await run(`document.activeElement.textContent`),'취소');
  await run(`document.querySelector('.library-confirm button').click()`);
  assert.equal(await run('getSelectedTreeNode().content'),original);
  await run(`document.querySelector('#libraryDetail [data-action="insert"]').click()`);
  await until(`Boolean(document.querySelector('.library-confirm'))`);
  await run(`document.querySelectorAll('.library-confirm button')[1].click()`);
  await until(`getSelectedTreeNode().content.length>${original.length}`);
  await run(`document.querySelector('#libraryDetail [data-action="delete"]').click()`);
  await until(`Boolean(document.querySelector('.library-confirm'))`);
  await run(`document.querySelectorAll('.library-confirm button')[1].click()`);
  await until(`libraryStore.list('templates').length===0&&libraryStore.status().outbox.length===0`);
  const raw=await run(`window.nownoteDesktop.storage.read('nownote.library.v1')`);
  assert.equal(Object.values(raw.contexts).flatMap(c=>c.outbox).length,0);
  assert.ok((await run('getSelectedTreeNode().content.length'))>original.length);
  await fs.writeFile('D:/tmp/now-240-stage-d/final-electron.json',JSON.stringify({latestBundle:true,inlineConfirmCancel:true,inlineConfirmApply:true,neverSentDeleteCancelsOutbox:true,noteIndependent:true,durableDesktopKey:true},null,2));
  console.log('Stage D latest Electron: confirmation/insert/delete/independent note/durable storage PASS');
} finally {
  app?.client?.close();stopProcess(app?.app);await delay(400);await fs.rm(dir,{recursive:true,force:true});
}
