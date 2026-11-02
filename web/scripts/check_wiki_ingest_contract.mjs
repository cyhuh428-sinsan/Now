import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {fixture,ctx,id} from './wiki_ingest_fixture.mjs';
const python=process.argv[2];
assert.ok(python,'Pass an existing Python executable with the project Pydantic dependency');
const {I,selection,catalog,reservation,output}=await fixture();
const snapshot=await I.captureWikiSources(selection,ctx);
const plan=await I.planIngest(snapshot,catalog,{context:ctx,reservation,relatedWikiIds:[id(9)]});
const review={context:ctx,snapshot,catalog,device:'fixture-device',connection:{provider:'fixture',model:'Combo/auto'},generatedAt:'2026-11-01T00:00:00Z'};
const proposal=await I.validateIngestProposal(output,plan,review);
const request=await I.buildOperationRequests(proposal,review);
const source=catalog[1].document,draft=source.drafts[0],approval=source.approvals[0];
const dependency={owner_id:ctx.owner,wiki_id:source.wiki_id,draft_id:draft.id,approval_id:approval.id,document_version:source.document_version,content_hash:draft.draft_hash};
request.dependency=dependency;
const code=`
import json, sys
from app.schemas.wiki import digest, canonical, WikiDependencyV2
from pydantic import ValidationError
from app.schemas.wiki_operations import PrepareOperation, CommitOperation, AbortOperation
raw=json.load(sys.stdin)
assert WikiDependencyV2.model_validate(raw['dependency']).model_dump()==raw['dependency']
for fields in ({'id':'masked'},{'kind':'note'},{'origin':'local'},{'id':'masked','kind':'note','origin':'local'}):
    try: WikiDependencyV2.model_validate({**raw['dependency'],**fields})
    except ValidationError as error:
        assert len(error.errors())==len(fields) and all(v['type']=='extra_forbidden' for v in error.errors())
    else: raise AssertionError('forbidden dependency fields accepted')
p=PrepareOperation.model_validate(raw['prepare'])
c=CommitOperation.model_validate(raw['commit'])
a=AbortOperation.model_validate(raw['abort'])
assert p.model_dump()==raw['prepare'] and c.model_dump()==raw['commit'] and a.model_dump()==raw['abort']
assert p.manifest_hash==digest({k:v for k,v in raw['prepare'].items() if k!='manifest_hash'})
assert c.manifest_hash==a.manifest_hash==p.manifest_hash
assert c.mutation_id==p.commit_mutation_id and a.mutation_id==p.abort_mutation_id
bindings={(b.wiki_id,b.draft_id):b.draft_hash for b in p.draft_bindings}
changes={v.wiki_id:v for v in p.changes}
for row in c.documents:
    doc=row.document.model_dump()
    assert digest(doc)==changes[row.wiki_id].result_document_hash
    draft=doc['drafts'][-1]
    assert bindings[(row.wiki_id,draft['id'])]==draft['draft_hash']
    assert sorted(canonical(v) for v in draft['evidence_manifest'])==sorted(canonical(v.model_dump()) for v in p.inputs)
print('Wiki JS -> actual server strict models/canonical operation roundtrip PASS (no DB/HTTP/model)')
`;
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const result=spawnSync(python,['-B','-c',code],{cwd:root,input:JSON.stringify(request),encoding:'utf8',
  env:{...process.env,PYTHONPATH:path.join(root,'server'),PYTHONDONTWRITEBYTECODE:'1'}});
if(result.status!==0){process.stderr.write(result.stderr);throw Error('wiki_server_schema_contract_failed');}
process.stdout.write(result.stdout);
