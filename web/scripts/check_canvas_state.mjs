import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';

const failures=[];
for(const file of ['../app.js','../../desktop/app/app.js']){
  const source=await fs.readFile(new URL(file,import.meta.url),'utf8');
  const start=source.indexOf('let canvasResourceEditor = null;');
  const end=source.indexOf('function defaultCaptureCard() {',start);
  const state={data:{canvases:[],tree:[{id:'note',title:'Original',content:'untouched',children:[]}]},selectedCanvasCardIds:[]};
  const board={clientWidth:800,clientHeight:500,scrollLeft:0,scrollTop:0,querySelectorAll:()=>[],querySelector:()=>null};
  let saved=0;
  const box=vm.createContext({crypto:webcrypto,state,elements:{canvasBoard:board,canvasTitleInput:{},canvasSummary:{},canvasSelectionLabel:{}},
    normalizeText:v=>String(v??''),isPlainObject:v=>Boolean(v)&&typeof v==='object'&&!Array.isArray(v),
    persist:()=>saved++,findTreeNode:(tree,id)=>tree.find(n=>n.id===id),noteTitle:v=>v,
    snippet:v=>v,escapeHtml:v=>String(v),showNotice:()=>{},requestAnimationFrame:fn=>fn()});
  vm.runInContext(source.slice(start,end),box);
  assert.equal(typeof box.saveCanvasResource,'function','Canvas must expose durable account-scoped save');
  for(const [name,check] of [
    ['drag divides by zoom and cancel restores',()=>{for(const zoom of [0.6,1,1.8]){
      const events={},header={addEventListener:(k,v)=>events[k]=v,setPointerCapture:()=>{}};
      const cardEl={dataset:{canvasCardId:'a'},style:{},addEventListener:()=>{},querySelector:()=>header};
      const c=box.normalizeCanvas({cards:[{id:'a',x:100,y:100}],zoom});state.data.canvases=[c];
      box.bindCanvasCardDrag(cardEl,c);
      const event={button:0,pointerId:1,clientX:10,clientY:10,target:{closest:()=>null},preventDefault:()=>{}};
      events.pointerdown(event);events.pointermove({...event,clientX:10+120*zoom,clientY:10+50*zoom});
      assert.ok(Math.abs(c.cards[0].x-220)<0.001);assert.ok(Math.abs(c.cards[0].y-150)<0.001);
      events.pointercancel({...event,type:'pointercancel'});assert.equal(c.cards[0].x,100);assert.equal(c.cards[0].y,100);
    }}],
    ['zero and distant coordinates',()=>{const c=box.normalizeCanvasCard({id:'a',x:0,y:2400});assert.equal(c.x,0);assert.equal(c.y,2400);}],
    ['new cards do not overlap existing positions',()=>{state.data.canvases=[];box.addTextCanvasCard();box.addTextCanvasCard();const [a,b]=box.activeCanvas().cards;assert.ok(b.x>=a.x+a.width+20 || a.x>=b.x+b.width+20 || b.y>=a.y+220 || a.y>=b.y+220);}],
    ['duplicate connections',()=>{const c=box.normalizeCanvas({cards:[{id:'a'},{id:'b'}],edges:[{from:'a',to:'b'},{from:'a',to:'b'},{from:'a',to:'missing'}]});assert.equal(c.edges.length,1);}],
    ['card removal preserves source',()=>{state.data.canvases=[box.normalizeCanvas({cards:[{id:'a',noteId:'note'},{id:'b',type:'text'}],edges:[{from:'a',to:'b'}]})];state.selectedCanvasCardIds=['a'];box.removeSelectedCanvasCards();assert.equal(box.activeCanvas().cards.length,1);assert.equal(box.activeCanvas().edges.length,0);assert.equal(state.data.tree[0].content,'untouched');}],
    ['connection removal preserves cards',()=>{state.data.canvases=[box.normalizeCanvas({cards:[{id:'a'},{id:'b'}],edges:[{from:'a',to:'b'}]})];state.selectedCanvasCardIds=['a','b'];box.disconnectSelectedCanvasCards();assert.equal(box.activeCanvas().edges.length,0);assert.equal(box.activeCanvas().cards.length,2);}],
    ['fit actually fits distant cards',()=>{state.data.canvases=[box.normalizeCanvas({cards:[{id:'a',x:2500,y:1400},{id:'b',x:4000,y:2000}],zoom:1})];box.fitCanvasView();const c=box.activeCanvas();assert.ok(c.zoom<1);assert.ok(board.scrollLeft>0);assert.ok(board.scrollTop>0);assert.ok((4240-2500)*c.zoom<=board.clientWidth-48);assert.ok(saved>0);}]
  ])try{check();}catch(error){failures.push(file+': '+name+': '+error.message);}
}
assert.deepEqual(failures,[]);
console.log('Canvas state: coordinates, edges, source-preserving removal and fit PASS');
