import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const root=new URL('../',import.meta.url),read=file=>fs.readFile(new URL(file,root),'utf8');
const expected=process.argv[2];
assert.match(expected||'',/^\d+\.\d+\.\d+$/,'Pass the expected product version');
const pkg=JSON.parse(await read('desktop/package.json')),lock=JSON.parse(await read('desktop/package-lock.json'));
for(const [name,value]of [['package',pkg.version],['lock',lock.version],['lock root',lock.packages[''].version]])assert.equal(value,expected,name);
for(const surface of ['web','desktop/app']){
  const app=await read(surface+'/app.js'),html=await read(surface+'/index.html');
  assert.equal(app.match(/const APP_VERSION = "([^"]+)";/)?.[1],expected,surface+' runtime');
  assert.ok(html.includes((surface==='web'?'Web ':'Desktop ')+expected),surface+' initial display');
}
const server=await read('server/app/core/capabilities.py');
assert.equal(server.match(/^LATEST_APP_VERSION = "([^"]+)"/m)?.[1],expected,'Windows/Web guide');
assert.equal(server.match(/^ANDROID_APP_VERSION = "([^"]+)"/m)?.[1],'2.3.9','Android published version stays unchanged');
console.log('Package, lock, Web/Desktop display/runtime and server guide '+expected+' PASS; Android 2.3.9 preserved');
