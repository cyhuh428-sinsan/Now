import fs from 'node:fs/promises';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
const box={crypto:webcrypto,structuredClone,TextEncoder,TextDecoder,Uint8Array,atob,btoa};
vm.createContext(box);
for(const name of ['note-protection-protocol','wiki-state'])
  vm.runInContext(await fs.readFile(new URL('../vendor/'+name+'.js',import.meta.url),'utf8'),box);
const snapshot=await box.NowNoteWiki.capture(['source'],{url:'https://example.invalid',owner:'wiki-fixture'},()=>({
  localId:'source',owner:'wiki-fixture',status:'ok',origin:'server',headVersion:1,revisionId:webcrypto.randomUUID(),
  title:'한글 자료',content:'정확한 인용 \u{20000}\r\n두 번째 줄'
}));
const draft=await box.NowNoteWiki.validateDraft({title:'한글 위키',topic:'계약',
  sections:[{id:'section-1',title:'개요',markdown:'**정리한 내용**',citation_ids:['cite-1']}],
  citations:[{id:'cite-1',source_id:'source-1',quote:'정확한 인용 \u{20000}'}]},snapshot,{provider:'omniroute',model:'auto'});
process.stdout.write(JSON.stringify({schema_version:1,wiki_id:webcrypto.randomUUID(),scope:snapshot.scope,
  drafts:[draft],approvals:[],rejected_draft_ids:[]}));
