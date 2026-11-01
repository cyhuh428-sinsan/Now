/* Mounted only while a verified catalog is visible; no durable graph cache. */
globalThis.mountWikiGraph=function(options){
  'use strict';
  const {container,catalog,onOpen,guard}=options;
  guard();const G=NowWikiGraph;
  const node=(tag,text,cls)=>{const element=document.createElement(tag);if(text!==undefined)element.textContent=text;if(cls)element.className=cls;return element;};
  const controls=node('div',undefined,'wiki-graph-controls'),canvas=node('div',undefined,'wiki-graph-canvas'),details=node('section',undefined,'wiki-graph-relations');
  canvas.setAttribute('aria-label','승인 위키 관계 그래프');canvas.setAttribute('role','img');canvas.tabIndex=0;
  const from=node('select'),to=node('select'),selection=node('select');
  for(const [select,label]of [[selection,'위키 선택'],[from,'경로 시작'],[to,'경로 도착']]){
    select.setAttribute('aria-label',label);select.className='settings-select';select.dataset.wikiGraph=label=== '위키 선택'?'selection':label==='경로 시작'?'from':'to';
    const empty=node('option',label);empty.value='';select.append(empty);
    for(const page of catalog.nodes){const option=node('option',page.title);option.value=page.wiki_id;select.append(option);}
  }
  let cy=null,disposed=false,selected='',path=null;
  const active=()=>{if(disposed)throw Error('wiki_graph_closed');guard();};
  function button(text,title,fn){const b=node('button',text,'secondary-btn');b.type='button';b.title=title;b.setAttribute('aria-label',title);b.onclick=()=>{active();fn();};return b;}
  const minus=button('-','축소',()=>cy.zoom({level:Math.max(cy.minZoom(),cy.zoom()/1.25),renderedPosition:{x:canvas.clientWidth/2,y:canvas.clientHeight/2}}));
  const plus=button('+','확대',()=>cy.zoom({level:Math.min(cy.maxZoom(),cy.zoom()*1.25),renderedPosition:{x:canvas.clientWidth/2,y:canvas.clientHeight/2}}));
  const fit=button('맞춤','그래프 맞춤',()=>cy.fit(undefined,36));
  controls.append(selection,minus,plus,fit,from,to,button('경로 찾기','승인 위키 사이 경로 찾기',()=>{
    if(!from.value||!to.value){details.replaceChildren(node('p','시작 위키와 도착 위키를 선택하세요.'));return;}
    path=G.findWikiPath(catalog,from.value,to.value);renderRelations();
    cy.elements().removeClass('wiki-path');if(path.found)for(const id of [...path.nodes,...path.edges.map(e=>e.id)])cy.getElementById(id).addClass('wiki-path');
  }));
  const heading=node('h3','관계 탐색');container.append(heading,controls);
  if(!catalog.nodes.length){
    controls.querySelectorAll('button,select').forEach(control=>{control.disabled=true;});
    container.append(node('p','표시할 승인 위키가 없습니다.'));
    return {destroy(){disposed=true;container.replaceChildren();},check:active};
  }
  container.append(canvas,details);
  const css=getComputedStyle(container),color=name=>css.getPropertyValue(name).trim();
  cy=cytoscape({container:canvas,elements:G.projectWikiGraph(catalog),minZoom:.25,maxZoom:3,boxSelectionEnabled:false,
    layout:{name:'circle',avoidOverlap:true,padding:36},
    style:[{selector:'node',style:{label:'data(label)','background-color':color('--blue')||'#2563eb',color:color('--text')||'#eee',
      width:32,height:32,'font-size':13,'text-wrap':'wrap','text-max-width':150,'text-valign':'bottom','text-margin-y':10}},
      {selector:'edge',style:{label:'data(label)',width:1.5,'line-color':color('--muted')||'#99a','target-arrow-color':color('--muted')||'#99a','target-arrow-shape':'triangle','curve-style':'bezier','font-size':10,color:color('--text')||'#eee','text-rotation':'autorotate'}},
      {selector:'edge[confidence != "explicit"]',style:{'line-style':'dashed'}},
      {selector:'edge[?stale]',style:{'line-style':'dotted','opacity':.65}},
      {selector:'edge.wiki-path',style:{'line-color':'#20bfa9','target-arrow-color':'#20bfa9',width:3}},
      {selector:'node.wiki-path',style:{'background-color':'#20bfa9'}},
      {selector:'node:selected',style:{'border-width':3,'border-color':color('--text')||'#eee'}}]});
  const types={related_to:'관련',supports:'지지',contradicts:'반대',extends:'확장',depends_on:'선행 의존'},confidence={explicit:'직접 근거',inferred:'추론',uncertain:'불확실'};
  function link(page,section,draft=page.draft_id){return button(page.title,'위키 열기: '+page.title,()=>onOpen(page.wiki_id,section,draft));}
  function relation(edge){
    const item=node('li'),source=catalog.nodes.find(p=>p.wiki_id===edge.source),target=catalog.nodes.find(p=>p.wiki_id===edge.target);
    item.append(link(source,edge.from_section_id,edge.source_draft_id),node('span',types[edge.type]+' · '+confidence[edge.confidence]+(edge.stale?' · 판본 갱신 확인 필요':'')),link(target,edge.to_section_id,edge.target_draft_id));
    const cites=source.draft.citations.filter(c=>edge.citation_ids.includes(c.id));
    for(const citation of cites)item.append(node('blockquote',citation.quote));return item;
  }
  function renderRelations(){
    active();details.replaceChildren();
    if(path){details.append(node('h4','선택 경로'),node('p',path.found?path.edges.length+'개 관계':'연결된 경로가 없습니다.'));const list=node('ol');for(const edge of path.edges)list.append(relation(edge));details.append(list);return;}
    const page=catalog.nodes.find(n=>n.wiki_id===selected);
    if(!page){details.append(node('p',catalog.nodes.length+'개 승인 위키 · '+catalog.edges.length+'개 관계'));return;}
    details.append(node('h4',page.title),link(page,null));
    const relations=G.planWikiIntegration(page.wiki_id,catalog);
    for(const [label,edges]of [['나가는 관계',relations.outgoing],['들어오는 관계',relations.incoming]]){
      details.append(node('h4',label));const list=node('ul');for(const edge of edges)list.append(relation(edge));if(!edges.length)list.append(node('li','관계 없음'));details.append(list);
    }
  }
  selection.onchange=()=>{active();selected=selection.value;path=null;cy.elements().removeClass('wiki-path');cy.nodes().unselect();if(selected)cy.getElementById(selected).select();renderRelations();};
  cy.on('tap','node',event=>{active();selected=event.target.id();selection.value=selected;path=null;renderRelations();});
  const resize=new ResizeObserver(()=>{if(disposed)return;try{active();cy.resize();}catch{destroy();}});resize.observe(canvas);
  const frame=requestAnimationFrame(()=>{if(!disposed){active();cy.resize();cy.fit(undefined,36);}});
  function destroy(){if(disposed)return;disposed=true;cancelAnimationFrame(frame);resize.disconnect();cy.destroy();container.replaceChildren();}
  renderRelations();return {destroy,check:active,instance:cy};
};
