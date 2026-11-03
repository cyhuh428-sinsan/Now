import {test} from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
const script=fileURLToPath(new URL('../scripts/measure-app-performance.mjs',import.meta.url));
const plan=args=>spawnSync(process.execPath,[script,...args,'--plan'],{encoding:'utf8',timeout:10000,windowsHide:true});
test('performance dry plan lists baseline comparisons without reading or launching a product',()=>{
 const result=plan([]);assert.equal(result.status,0,result.stderr);assert.deepEqual(JSON.parse(result.stdout),{sizes:[1,8,16],iterations:3,modes:['baseline','candidate'],comparison:true,memoryLimitBytes:1.2*1024**3});
});
test('candidate-only scaling never schedules the memory-limited baseline or changes its limit',()=>{
 const result=plan(['--candidate-only','--sizes=8,16']);assert.equal(result.status,0,result.stderr);assert.deepEqual(JSON.parse(result.stdout),{sizes:[8,16],iterations:3,modes:['candidate'],comparison:false,memoryLimitBytes:1.2*1024**3});
});
test('unknown or duplicate fixture sizes fail before touching a product',()=>{
 for(const sizes of ['32','1,1']){const result=plan(['--candidate-only','--sizes='+sizes]);assert.notEqual(result.status,0);assert.match(result.stderr,/Unsupported benchmark sizes/);}
});
