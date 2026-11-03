const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
for(const file of ['web/app.js','desktop/app/app.js']){
 const source=fs.readFileSync(file,'utf8'),start=source.indexOf('let settingsSaveBaseline='),end=source.indexOf('\nfunction settingsForStorage()',start);
 function fixture(){
  let raw=null,writes=0,binding=0,uncertain=false;
  const box={structuredClone,Promise,JSON,Error,noteHistoryStartupReady:true,protectionApplying:false,protectionBootstrapPending:true,
   state:{settings:{fontSize:'small',server:{}}},storagePendingWrites:new Set(),desktopStorageInfo:null,
   noteHistory:{idle:async()=>{},ensure(){throw Error('Full history forbidden');}},wikiViewKey:()=>binding,
   isDesktopClient:()=>false,settingsForStorage:()=>box.state.settings,NOTE_HISTORY_KEY:'history',SETTINGS_KEY:'settings',
   browserHistoryStorage:()=>({readDirectory:async()=>({stamp:'known'}),saveSettings:async request=>{
    assert.equal(request.expected,raw);writes++;raw=request.next;if(uncertain)binding++;return {committed:true};
   }}),renderDesktopStorageStatus(){},setServerRawMessage(){},renderServerSettings(){},showNotice(){},t:key=>key};
  vm.createContext(box);vm.runInContext(source.slice(start,end),box);
  return {box,raw:()=>raw,writes:()=>writes,uncertain:()=>{uncertain=true;}};
 }
 test(file+': settings queue retains ordered baselines and skips unchanged background saves',async()=>{
  const f=fixture(),one=f.box.persistSettings();f.box.state.settings.fontSize='large';const two=f.box.persistSettings();
  assert.equal(await one,true);assert.equal(await two,true);assert.equal(f.writes(),2);
  assert.equal(JSON.parse(f.raw()).fontSize,'large');assert.equal(await f.box.persistSettings(),true);assert.equal(f.writes(),2);
 });
 test(file+': uncertain settings result fails and latches subsequent automatic writes',async()=>{
  const f=fixture();f.uncertain();assert.equal(await f.box.persistSettings(),false);
  f.box.state.settings.fontSize='large';assert.equal(await f.box.persistSettings(),false);assert.equal(f.writes(),1);
  assert.equal(f.box.storagePendingWrites.size,0);
 });
}
