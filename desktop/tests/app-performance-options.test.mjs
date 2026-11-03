import {test} from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
const script=fileURLToPath(new URL('../scripts/measure-app-performance.mjs',import.meta.url));
const plan=(args,env=process.env)=>spawnSync(process.execPath,[script,...args,'--plan'],{encoding:'utf8',timeout:10000,windowsHide:true,env});
test('performance dry plan lists baseline comparisons without reading or launching a product',()=>{
 const result=plan([]);assert.equal(result.status,0,result.stderr);assert.deepEqual(JSON.parse(result.stdout),{sizes:[1,8,16],iterations:3,modes:['baseline','candidate'],comparison:true,memoryLimitBytes:1.2*1024**3});
});
test('candidate-only scaling never schedules the memory-limited baseline or changes its limit',()=>{
 const result=plan(['--candidate-only','--sizes=8,16']);assert.equal(result.status,0,result.stderr);assert.deepEqual(JSON.parse(result.stdout),{sizes:[8,16],iterations:3,modes:['candidate'],comparison:false,memoryLimitBytes:1.2*1024**3});
});
test('unknown or duplicate fixture sizes fail before touching a product',()=>{
 for(const sizes of ['32','1,1']){const result=plan(['--candidate-only','--sizes='+sizes]);assert.notEqual(result.status,0);assert.match(result.stderr,/Unsupported benchmark sizes/);}
});
test('the 4GiB expansion budget is available only to an explicitly approved hosted Windows job',()=>{
 const refused=plan(['--github-vm'],{...process.env,GITHUB_ACTIONS:'false'});assert.notEqual(refused.status,0);assert.match(refused.stderr,/approved GitHub-hosted Windows/);
 const accepted=plan(['--github-vm','--sizes=8,16'],{...process.env,GITHUB_ACTIONS:'true',RUNNER_ENVIRONMENT:'github-hosted',RUNNER_OS:'Windows',GITHUB_REPOSITORY:'cyhuh428-sinsan/Now',NOWNOTE_VM_PERFORMANCE_QA:'1'});
 assert.equal(accepted.status,0,accepted.stderr);assert.equal(JSON.parse(accepted.stdout).memoryLimitBytes,4*1024**3);assert.equal(JSON.parse(plan([]).stdout).memoryLimitBytes,1.2*1024**3);
});
