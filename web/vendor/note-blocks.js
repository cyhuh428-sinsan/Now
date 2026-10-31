/* Stable Markdown anchors are source text; resolved bodies are never cached. */
(() => {
  'use strict';
  const uuid='[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
  const validId=new RegExp('^'+uuid+'$','i');
  const marker=new RegExp('(?:^|[ \\t])\\^('+uuid+')[ \\t]*$','i');
  const referencePattern=new RegExp('!\\[\\[nownote:([^/\\n\\]]+)/([^#\\n\\]]+)#\\^('+uuid+')\\]\\]','g');
  function normalize(source){
    let text='',positions=[];
    for(let i=0;i<source.length;i++){
      positions.push(i);
      if(source[i]==='\r'){text+='\n';if(source[i+1]==='\n')i++;}
      else text+=source[i];
    }
    positions.push(source.length);
    return {text,positions};
  }
  function index(input){
    const source=String(input||''),{text,positions}=normalize(source),blocks=[];
    let cursor=0,previous=null;
    for(const token of marked.lexer(text,{gfm:true})){
      if(!token.raw)continue;
      const start=text.indexOf(token.raw,cursor);
      if(start<0){previous=null;continue;}
      cursor=start+token.raw.length;
      if(token.type==='space')continue;
      if(!['paragraph','heading','list','blockquote','table','code'].includes(token.type)){previous=null;continue;}
      const raw=token.raw.replace(/\s+$/,''),match=token.type==='code'?null:marker.exec(raw);
      if(match&&raw.trim()==='^'+match[1]){
        if(previous&&!previous.id){
          previous.id=match[1].toLowerCase();previous.anchorStart=positions[start+raw.indexOf('^')];
          previous.anchorEnd=positions[start+raw.length];
        }
        continue;
      }
      const end=start+raw.length,bodyEnd=match?start+match.index:end;
      const block={id:match?match[1].toLowerCase():null,type:token.type,start:positions[start],end:positions[end],
        content:source.slice(positions[start],positions[bodyEnd])};
      if(match){block.anchorStart=positions[start+raw.lastIndexOf('^')];block.anchorEnd=positions[end];}
      blocks.push(block);previous=block;
    }
    return blocks;
  }
  function anchor(input,start,end=start){
    const source=String(input||''),blocks=index(source);
    const valid=Number.isInteger(start)&&Number.isInteger(end)&&start>=0&&end>=start&&end<=source.length;
    const block=valid&&blocks.find(row=>start>=row.start&&start<=row.end&&end<=row.end);
    if(!block)throw Error('참조할 한 블록 안에 커서나 선택 영역을 두세요.');
    if(block.id){
      if(blocks.filter(row=>row.id===block.id).length!==1)throw Error('중복된 블록 ID를 먼저 확인하세요.');
      return {source,blockId:block.id};
    }
    const id=crypto.randomUUID(),newline=source.includes('\r\n')?'\r\n':'\n';
    return {source:source.slice(0,block.end)+newline+newline+'^'+id+source.slice(block.end),blockId:id};
  }
  function reference(owner,localId,blockId){
    if(!owner||!localId||!validId.test(blockId))throw Error('잘못된 메모 참조입니다.');
    return '![[nownote:'+encodeURIComponent(owner)+'/'+encodeURIComponent(localId)+'#^'+blockId.toLowerCase()+']]';
  }
  function parse(value){
    const match=new RegExp('^'+referencePattern.source+'$').exec(String(value));
    if(!match)return null;
    try{
      const owner=decodeURIComponent(match[1]),localId=decodeURIComponent(match[2]);
      if(!owner||!localId||owner.length>80||localId.length>120||/[\x00-\x1f\x7f]/.test(owner+localId))return null;
      return {owner,localId,blockId:match[3].toLowerCase()};
    }catch{return null;}
  }
  function stripAnchors(source){
    let result=String(source||'');
    for(const block of index(result).filter(row=>row.id).sort((a,b)=>b.anchorStart-a.anchorStart))
      result=result.slice(0,block.anchorStart)+result.slice(block.anchorEnd);
    return result;
  }
  function traversal(){
    return {trail:[],budget:{count:0,bytes:0,maxDepth:5,maxBlocks:200,maxBytes:1048576}};
  }
  function resolve(value,ctx,state=traversal()){
    const ref=parse(value);
    if(!ref)return {status:'invalid'};
    if(!ctx.owner||ref.owner!==ctx.owner)return {status:'unavailable'};
    const key=JSON.stringify([ref.owner,ref.localId,ref.blockId]),{trail,budget}=state;
    if(trail.includes(key))return {status:'cycle'};
    if(trail.length>=budget.maxDepth)return {status:'depth_limit'};
    if(budget.count>=budget.maxBlocks)return {status:'budget_limit'};
    let note;
    try{note=ctx.lookup(ref.localId);}catch{return {status:'unavailable'};}
    if(!note)return {status:'missing'};
    if(note.owner!==ref.owner)return {status:'unavailable'};
    if(note.status!=='ok')return {status:['locked','deleted'].includes(note.status)?note.status:'unavailable'};
    const found=index(note.content).filter(row=>row.id===ref.blockId);
    if(found.length!==1)return {status:found.length?'ambiguous_block':'missing_block'};
    const block=found[0],bytes=new TextEncoder().encode(block.content).length;
    if(budget.bytes+bytes>budget.maxBytes)return {status:'budget_limit'};
    budget.count++;budget.bytes+=bytes;
    return {status:'ok',content:block.content,title:note.title||'',ref,start:block.start,end:block.end,
      next:{trail:[...trail,key],budget}};
  }
  globalThis.NowNoteBlocks={index,anchor,reference,parse,stripAnchors,traversal,resolve,
    pattern:()=>new RegExp(referencePattern.source,'g')};
})();
