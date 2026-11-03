const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
for(const file of ['web/app.js','desktop/app/app.js'])test(file+' does not double-parse a browser string journal but preserves native legacy compatibility',()=>{
  const source=fs.readFileSync(path.resolve(__dirname,'../..',file),'utf8'),line=source.split('\n').find(line=>line.includes('const normalize=snapshot=>'));
  assert.ok(line);const code=line.trim().replace(/^const normalize=/,'').replace(/;$/,'');
  const raw=JSON.stringify({schema_version:1,contexts:{}}),snapshot={value:raw,revision:'one',scoped:true};
  const web=vm.runInNewContext('('+code+')',{isDesktopClient:()=>false});assert.equal(web(snapshot).value,raw);
  const native=vm.runInNewContext('('+code+')',{isDesktopClient:()=>true});assert.equal(native(snapshot).value.schema_version,1);assert.equal(native(snapshot).scoped,false);
});
