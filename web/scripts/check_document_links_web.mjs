const t=await taskSpace('NowNote Stage B'),p=t.page('p1');
await p.click('#documentFormattedBtn');
const hrefs=await p.evaluate(()=>[...elements.markdownPreview.querySelectorAll('a')].map(a=>a.getAttribute('href')));
console.log({hrefs});
const popupPromise=p.waitForEvent('popup');
await p.click('#markdownPreview a[href="https://example.com/path?q=1"]');
const popup=await popupPromise;console.log({opened:await popup.url()});await popup.close();
await p.click('#markdownPreview [data-local-path]');
console.log(await p.evaluate(()=>({visible:!elements.confirmDialog.classList.contains('hidden'),text:elements.confirmMessage.textContent})));
await p.click('#confirmCancelBtn');
await p.click('#markdownPreview [data-wiki-link]');
console.log(await p.evaluate(()=>({wikiTarget:getSelectedTreeNode().title,outline:elements.outlinePanel.textContent})));
console.log(await p.evaluate(()=>{
 const host=document.createElement('div');host.innerHTML=markdownToHtml('![QA](nownote-attachment://synthetic-key)');
 return {attachment:host.querySelector('img')?.dataset.noteAttachmentKey,src:host.querySelector('img')?.getAttribute('src')};
}));
