import {test} from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
const script=new URL('../scripts/check-installed-lifecycle.ps1',import.meta.url),shell=process.platform==='win32'?path.join(process.env.ProgramFiles,'PowerShell/7/pwsh.exe'):null;
test('installer lifecycle has a read-only plan and refuses a local machine before touching installation',()=>{
 assert.equal(fs.existsSync(script),true,'runner-only installation QA script is required');
 if(!shell)return;
 const plan=spawnSync(shell,['-NoProfile','-File',fileURLToPath(script),'-Plan'],{encoding:'utf8'});assert.equal(plan.status,0,plan.stderr);const value=JSON.parse(plan.stdout);assert.equal(value.runnerOnly,true);assert.equal(value.installMode,'currentuser');assert.equal(value.realUserData,false);assert.deepEqual(value.registrationNames,[true,true,true,false,false]);
 const refused=spawnSync(shell,['-NoProfile','-File',fileURLToPath(script)],{encoding:'utf8',env:{...process.env,GITHUB_ACTIONS:'false',NOWNOTE_INSTALLER_QA:''}});assert.notEqual(refused.status,0);assert.match(refused.stderr,/GitHub-hosted Windows/);
});
