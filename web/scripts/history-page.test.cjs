const {test}=require('node:test'),assert=require('node:assert/strict');
const parts=require('../vendor/document-parts.js');
const account=JSON.stringify(['https://qa.invalid','alice']);
function fixture(){
  const note={owner_id:'alice',local_id:'a',note_type:'tree',source:'manual',content:'current'};
  const entry={raw:note,draft:note,base:{crypto_epoch:0,head_revision_id:null},revisions:Array.from({length:125},(_,index)=>({revision_id:'r'+index,snapshot:{note:{...note,content:'history '+index}},extra:{keep:index}})),outbox:[],receipts:[]};
  const rows=parts.encode({schema_version:1,contexts:{[account]:{notes:{a:entry,b:{...entry,raw:{...note,local_id:'b'},draft:{...note,local_id:'b'}}}}}});
  function page(options={}){
    assert.equal(typeof parts.historyPageSteps,'function');const steps=parts.historyPageSteps({account,id:'a',stamp:'one',...options});let step=steps.next(),read=[];
    while(!step.done){read.push(step.value);assert.ok(!step.value.includes('"b","revisions"'));step=steps.next(rows.get(step.value));}
    return {...step.value,read};
  }
  return {page,rows};
}
test('history pages read only the requested revision bodies and preserve unknown fields across cursors',()=>{
  const f=fixture(),first=f.page(),second=f.page({cursor:first.nextCursor}),last=f.page({cursor:second.nextCursor});
  assert.equal(first.total,125);assert.equal(first.items.length,50);assert.equal(first.items[0].revision_id,'r124');assert.equal(first.items.at(-1).revision_id,'r75');
  assert.equal(second.items[0].revision_id,'r74');assert.equal(last.items.length,25);assert.equal(last.nextCursor,null);
  assert.equal(first.items[0].extra.keep,124);
  assert.ok(first.read.every(id=>!id.includes('"revisions","0"')&&!id.includes('"revisions","74"')));
  assert.equal(Object.hasOwn(first,'value'),false);
});
test('cursor is bound to note, account and journal stamp; invalid limits never return partial pages',()=>{
  const f=fixture(),first=f.page();
  for(const change of [{id:'b'},{account:JSON.stringify(['https://qa.invalid','bob'])},{stamp:'changed'},{limit:0},{limit:101},{cursor:'broken'}])
    assert.throws(()=>f.page({cursor:first.nextCursor,...change}));
});
test('missing selected revisions and protected/unsupported current proof refuse paging',()=>{
  const f=fixture();f.rows.delete(JSON.stringify(['contexts',account,'notes','a','revisions','124']));assert.throws(()=>f.page());
  const g=fixture();g.rows.get(JSON.stringify(['contexts',account,'notes','a','base'])).entries.find(([key])=>key==='crypto_epoch')[1].value=1;
  assert.throws(()=>g.page());
});
