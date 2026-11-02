const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
for(const filename of ['web/app.js','desktop/app/app.js']){
  const source=fs.readFileSync(filename,'utf8');
  function extract(name){const from=source.indexOf('\nfunction '+name+'('),rest=source.slice(from+1),end=/\n(?:async )?function /.exec(rest);assert.ok(from>0);return rest.slice(0,end.index);}
  for(const kind of ['daily','worklog'])test(filename+' uses selected '+kind+' history for existing nonempty editor changes',()=>{
    const date='2026-11-03',calls=[],box={state:{selectedDate:date,selectedWorklogDate:date,data:{daily:{},worklogs:{}}},
      noteProtectionBlocked:()=>false,elements:{dailyContent:{value:'EDITED',readOnly:false},worklogContent:{value:'EDITED'},dailySavedLabel:{},worklogSavedLabel:{}},
      persist:options=>calls.push(options),renderCalendar(){},renderTodayMemoState(){},renderWorklogCalendar(){},renderWorklogRange(){},renderWorklogMailButtons(){},showSaved(){}};
    vm.createContext(box);const name=kind==='daily'?'saveDailyFromEditor':'saveWorklogFromEditor';vm.runInContext(extract(name),box);box[name]();
    assert.equal(calls[0]?.journalId,kind+':'+date);assert.equal(box.state.data[kind==='daily'?'daily':'worklogs'][date].content,'EDITED');
    box.elements[kind==='daily'?'dailyContent':'worklogContent'].value='';box[name]();
    assert.equal(calls[1].journalId,null);assert.equal(Object.hasOwn(box.state.data[kind==='daily'?'daily':'worklogs'],date),false);
  });
  test(filename+' preserves normal whole writes for structural/new-document changes and schedules online selected edits',()=>{
    const calls=[],box={state:{data:{}},noteHistoryCaptureDrafts:()=>calls.push('capture'),noteHistory:{deferred:()=>true,selectable:id=>id==='known'},
      noteHistoryContext:()=>({online:true}),isHostedWebClient:()=>false,writeStorage:()=>calls.push('whole'),STORAGE_KEY:'primary',scheduleServerSync:()=>calls.push('schedule')};
    vm.createContext(box);vm.runInContext(extract('persist'),box);
    box.persist({journalId:'known'});assert.deepEqual(calls,['capture','schedule']);calls.length=0;
    box.persist({journalId:'new'});assert.deepEqual(calls,['capture','whole','schedule']);calls.length=0;
    box.persist();assert.deepEqual(calls,['capture','whole','schedule']);
  });
}
