const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
for(const file of ['web/app.js','desktop/app/app.js']){
 const source=fs.readFileSync(file,'utf8');
 const section=(start,end)=>source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));
 test(file+': opening preferences does not materialize history and refreshes the visible workspace',async()=>{
  let hidden=true,whole=0,panels=0,vault=0;
  const context={elements:{settingsView:{classList:{contains:()=>hidden,remove:()=>{hidden=false;},add:()=>{hidden=true;}}}},
   noteHistory:{ensure:()=>{whole++;throw Error('unnecessary whole history');}},closePopupLayers(){},refreshMailSettingsStatus(){},refreshVaultStatus(){vault++;},renderWorkspacePanel(){panels++;}};
  vm.createContext(context);vm.runInContext(section('async function toggleSettings()', '\nasync function refreshDesktopStorageInfo'),context);
  await context.toggleSettings();assert.equal(whole,0);assert.equal(panels,1);assert.equal(vault,1);
  await context.toggleSettings();assert.equal(panels,1);assert.equal(vault,1);
 });
 test(file+': hidden workspace health does not scan notes',()=>{
  const context={elements:{settingsView:{classList:{contains:()=>true}},workspaceSelect:{},workspaceSummary:{},workspaceHealthList:{}},state:new Proxy({},{get(){throw Error('hidden health scan');}})};
  vm.createContext(context);vm.runInContext(section('function renderWorkspacePanel()', '\nfunction saveCurrentWorkspace'),context);
  assert.doesNotThrow(()=>context.renderWorkspacePanel());
 });
 test(file+': repeated identical errors share one live toast and timer',()=>{
  const children=[],timers=[];
  const context={elements:{toastRegion:{children,append:item=>children.push(item)}},console,
   document:{createElement:()=>({dataset:{},classList:{add(){},remove(){}},setAttribute(){},remove(){}})},
   requestAnimationFrame:fn=>fn(),window:{setTimeout:fn=>{timers.push(fn);}}};
  vm.createContext(context);vm.runInContext(section('function showNotice(', '\nasync function initializeHostedWebClient'),context);
  for(let i=0;i<100;i++)context.showNotice('synthetic saved error','error');
  assert.equal(children.length,1);assert.equal(timers.length,1);
  context.showNotice('different error','error');assert.equal(children.length,2);
 });
}
