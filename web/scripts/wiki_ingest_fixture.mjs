import fs from 'node:fs/promises';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
export const ctx={url:'https://qa.invalid',owner:'ingest-fixture',device:'fixture-device',viewGeneration:1,serverInstance:'instance-a'};
export const scope={url:ctx.url,owner:ctx.owner};
export const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
export const safety={status:'ok',epoch:0,lineage:false,fence:false};
export const clone=structuredClone;
export async function fixture(){
  const box={crypto:webcrypto,structuredClone,TextEncoder,TextDecoder,Uint8Array,atob,btoa};vm.createContext(box);
  for(const name of ['note-protection-protocol','wiki-state','wiki-ingest']){
    let source;try{source=await fs.readFile(new URL('../vendor/'+name+'.js',import.meta.url),'utf8');}
    catch(error){if(error.code==='ENOENT'&&name==='wiki-ingest')continue;throw error;}
    vm.runInContext(source,box);
  }
  const P=box.NowNoteProtectionProtocol,W=box.NowNoteWiki;
  const selection=[1,2].map(n=>({kind:'note',id:'source-'+n,safety:clone(safety),note:{owner:ctx.owner,localId:'note-'+n,
    status:'ok',origin:'server',revisionId:id(n),headVersion:1,title:n===1?'Alpha':'Beta',content:'Exact evidence '+n+'.\r\n<script>neverRun()</script>'}}));
  const snap=await W.capture(['note-1'],scope,()=>selection[0].note);
  const legacy=await W.validateDraft({title:'Alpha',topic:'Alpha',sections:[{id:'s1',title:'A',markdown:'Exact evidence 1.',citation_ids:['c1']}],
    citations:[{id:'c1',source_id:'source-1',quote:'Exact evidence 1.'}]},snap,{provider:'fixture',model:'auto'});
  const approval={id:id(6),parent_approved_revision_id:null,draft_id:legacy.id,draft_hash:legacy.draft_hash,
    source_manifest_hash:await P.hashJson(legacy.source_manifest),approved_by:ctx.owner,approved_at:'2026-11-01T00:00:00Z'};
  const doc={schema_version:1,wiki_id:id(7),scope:clone(scope),document_version:2,drafts:[legacy],approvals:[approval],rejected_draft_ids:[]};
  const catalog=[{document:doc,origin:'server',headRevisionId:id(8),headVersion:2,indexVersion:1,safety:clone(safety)}];
  const related=clone(doc);related.wiki_id=id(9);related.drafts[0].title='Gamma';related.drafts[0].topic='Gamma';
  const unsigned=clone(related.drafts[0]);delete unsigned.draft_hash;related.drafts[0].draft_hash=await P.hashJson(unsigned);
  related.approvals[0].draft_hash=related.drafts[0].draft_hash;
  catalog.push({document:related,origin:'server',headRevisionId:id(24),headVersion:2,indexVersion:1,safety:clone(safety)});
  const reservation={operation_id:id(10),mutation_id:id(11),commit_mutation_id:id(12),abort_mutation_id:id(13),
    pages:[{wiki_id:id(7),draft_id:id(14),generation_id:id(15),note_mutation_id:id(16)},
      {wiki_id:id(20),draft_id:id(21),generation_id:id(22),note_mutation_id:id(23)}]};
  const output={pages:reservation.pages.map((p,n)=>({wiki_id:p.wiki_id,draft_id:p.draft_id,title:n?'Beta':'Alpha',topic:n?'Beta':'Alpha',
    page_type:'concept',summary:'Synthetic',aliases:[],sections:[{id:'s1',title:'A',markdown:'Exact evidence '+(n+1)+'.',citation_ids:['c1']}],
    claims:[{id:'claim1',statement:'Synthetic assertion',citation_ids:['c1'],assessment:'supported'}],relations:[],
    citations:[{id:'c1',evidence_id:'source-'+(n+1),section_id:null,quote:'Exact evidence '+(n+1)+'.'}]}))};
  return {box,P,W,I:box.NowNoteWikiIngest,selection,catalog,reservation,output,doc};
}
