'use strict';
// Independent, read-only courseware browser. No per-question links or mappings.
window.KnowledgeReview=(()=>{
  const panel=$('#knowledge-review'),toggle=$('#review-toggle');
  const catalogs=new Map(),documents=new Map(),positions=new Map();
  let visible=false,subject='',catalog=null,view='topics',query='',category='',selected=null;
  let request=0,opener=null,codeStyle='using',sourcePage=1,pickerTop=0,composing=false,displayed=null,originKey=null;
  try{codeStyle=localStorage.getItem('lesson-code-style')==='explicit'?'explicit':'using';}catch{}
  const clean=s=>String(s||'').toLowerCase().replace(/std::|[\s/、:：·_\-]/g,'');
  function preserveQuestion(change){
    const scroller=$('#reading-scroll'),bounds=scroller.getBoundingClientRect();
    const bottom=scroller.scrollTop>0&&scroller.scrollHeight-scroller.clientHeight-scroller.scrollTop<3;
    const anchors=[...scroller.querySelectorAll('h2,h3,p,pre,summary,label,textarea,.question-meta,.source-links')].filter(e=>{const r=e.getBoundingClientRect();return r.height&&r.bottom>bounds.top&&r.top<bounds.bottom;});
    const anchor=anchors.sort((a,b)=>Math.abs(a.getBoundingClientRect().top-bounds.top)-Math.abs(b.getBoundingClientRect().top-bounds.top))[0];
    const top=anchor?.getBoundingClientRect().top;change();
    if(bottom)scroller.scrollTop=scroller.scrollHeight;
    else if(anchor)scroller.scrollTop+=anchor.getBoundingClientRect().top-top;
  }
  const aliases={start:'main include using namespace 程序骨架',types:'const static_cast 变量 类型',expressions:'operator 运算 逻辑',io:'cout cin getline setprecision setw 输入 输出',branch:'if else switch case 条件 分支',loop:'for while do break continue 循环 跳转',functions:'function return void recursion 函数 递归',collections:'array string vector 数组 字符串',pointers:'pointer reference nullptr 指针 引用',files:'struct ifstream ofstream 文件',classes:'class public private constructor destructor 类 构造 析构',advanced:'inheritance virtual override polymorphism exception template STL 继承 多态 异常 模板'};
  function cached(map,key,read){if(!map.has(key))map.set(key,read().catch(e=>{map.delete(key);throw e;}));return map.get(key);}
  async function loadCatalog(course){
    return cached(catalogs,course,async()=>{
      if(course==='cpp'){
        const [index,lessons]=await Promise.all([api('/api/lessons'),api('/api/items?subject=cpp&kind=lesson')]);
        return {categories:index.categories,entries:index.entries,lessons:lessons.items};
      }
      const sources=(await api('/api/sources')).sources.filter(s=>s.subject===course);
      return {categories:[...new Set(sources.map(s=>s.section))].map(id=>({id,title:id})),sources};
    });
  }
  function remember(){const content=$('#review-content');if(content&&selected&&displayed===selected.key)positions.set(subject+'|'+selected.key+'|'+sourcePage,content.scrollTop);}
  function close(focus=true){
    remember();visible=false;request++;panel.hidden=true;
    preserveQuestion(()=>document.body.classList.remove('review-open','review-wide'));toggle.setAttribute('aria-expanded','false');
    if(focus&&opener?.isConnected)opener.focus({preventScroll:true});
  }
  function sync(item){
    const question=item?.kind==='question'&&['cpp','math'].includes(item.subject);
    toggle.hidden=!question;
    $('#reading-back').textContent=item?.kind==='lesson'?'← 课件目录':'← 题目目录';
    if(visible&&(!question||item.subject!==subject))close(false);
  }
  async function open(){
    const item=state.current;if(!item||item.kind!=='question')return;
    opener=toggle;visible=true;preserveQuestion(()=>{panel.hidden=false;document.body.classList.add('review-open');});toggle.setAttribute('aria-expanded','true');
    const seq=++request;
    if(subject!==item.subject){subject=item.subject;catalog=null;selected=null;query='';category='';view=subject==='cpp'?'topics':'sources';pickerTop=0;}
    if(catalog&&panel.querySelector('#review-content')){if($('#review-content').getAttribute('aria-busy')==='true'){if(selected)read(selected);else picker();}$('#review-close').focus({preventScroll:true});return;}
    panel.innerHTML='<div class="review-empty" role="status">正在读取课件目录…</div>';
    try{
      const result=await loadCatalog(subject);if(!visible||seq!==request)return;
      catalog=result;shell();picker();$('#review-search').focus({preventScroll:true});
    }catch(error){if(visible&&seq===request){panel.innerHTML=`<div class="review-header"><h2>知识点回顾</h2><button id="review-close" class="icon-button" aria-label="关闭知识点回顾">×</button></div><div class="review-empty" role="alert"><strong>目录暂时没有打开</strong><p>${esc(error.message)}</p><button id="review-retry">重新读取</button></div>`;$('#review-close').onclick=()=>close();$('#review-retry').onclick=()=>open();}}
  }
  function shell(){
    panel.innerHTML=`<header class="review-header"><div><h2>知识点回顾</h2><p>自主选择章节 · 当前题目与草稿保留</p></div><button id="review-width" aria-pressed="false">加宽课件</button><button id="review-close" class="icon-button" aria-label="关闭知识点回顾">×</button></header><div class="review-controls"><div class="review-tabs" role="group" aria-label="回顾资料类型">${(subject==='cpp'?[['topics','知识点'],['syntax','语法速查'],['documents','完整讲义']]:[['sources','课程原稿']]).map(([id,title])=>`<button data-review-view="${id}" aria-pressed="${view===id}">${title}</button>`).join('')}</div><label class="review-search"><span aria-hidden="true">⌕</span><input id="review-search" type="search" aria-label="搜索回顾知识点" placeholder="${subject==='cpp'?'搜索知识点，例如 while、数组、构造函数':'搜索讲义名称或章节'}" autocomplete="off" value="${esc(query)}"></label><div class="review-filter-row"><select id="review-category" aria-label="筛选回顾主题"><option value="">全部${subject==='cpp'?'主题':'章节'}</option>${catalog.categories.map(c=>`<option value="${esc(c.id)}" ${category===c.id?'selected':''}>${esc(c.title)}</option>`).join('')}</select>${subject==='cpp'?`<label for="review-code-style">代码写法</label><select id="review-code-style" aria-label="回顾代码写法"><option value="using" ${codeStyle==='using'?'selected':''}>课堂写法</option><option value="explicit" ${codeStyle==='explicit'?'selected':''}>显式 std::</option></select>`:''}</div></div><div id="review-content" class="review-content" tabindex="0" role="region" aria-label="回顾内容"></div>`;
    $('#review-close').onclick=()=>close();
    $('#review-width').onclick=e=>{let wide;preserveQuestion(()=>wide=document.body.classList.toggle('review-wide'));e.currentTarget.setAttribute('aria-pressed',wide);e.currentTarget.textContent=wide?'均分阅读':'加宽课件';};
    panel.querySelectorAll('[data-review-view]').forEach(b=>b.onclick=()=>{remember();request++;view=b.dataset.reviewView;panel.querySelectorAll('[data-review-view]').forEach(t=>t.setAttribute('aria-pressed',t===b));picker();});
    const search=$('#review-search');
    const searchNow=()=>{query=search.value;request++;picker();};
    search.addEventListener('compositionstart',()=>composing=true);search.addEventListener('compositionend',()=>{composing=false;searchNow();});
    search.oninput=e=>{if(!composing&&!e.isComposing)searchNow();};
    search.onkeydown=e=>{if(e.key==='Enter'&&!e.isComposing&&!composing){searchNow();$('#review-content [data-review-key]')?.focus();}};
    $('#review-category').onchange=e=>{category=e.target.value;request++;picker();};
    $('#review-code-style')?.addEventListener('change',e=>{codeStyle=e.target.value;applyCode();});
  }
  function entries(){
    if(subject==='math')return catalog.sources.map(s=>({...s,key:'source:'+s.id,type:'source',title:s.name,category:s.section,document:s.role}));
    if(view==='syntax')return LessonLibrary.recipes.map(e=>({...e,type:'syntax'}));
    if(view==='documents')return catalog.lessons.map(e=>({...e,key:'document:'+e.id,item_id:e.id,type:'lesson',heading:null,document:e.section}));
    return catalog.entries.map(e=>({...e,type:'lesson'}));
  }
  function matches(e){
    const categories=subject==='cpp'&&view==='documents'?catalog.entries.filter(i=>i.item_id===e.item_id).map(i=>i.category):[e.category];
    if(category&&!categories.includes(category))return false;
    const text=clean([e.title,e.document,e.section,e.description,categories.map(c=>aliases[c]||'').join(' ')].join(' '));
    return query.trim().split(/\s+/).filter(Boolean).every(w=>text.includes(clean(w)));
  }
  function picker(){
    remember();displayed=null;const rows=entries().filter(matches),content=$('#review-content');if(!content)return;
    panel.querySelector('.review-controls').hidden=false;
    content.setAttribute('aria-busy','false');
    const recent=selected&&!query&&!category?`<p class="review-results-heading">继续回顾</p><button class="review-result" data-review-resume><strong>${esc(selected.title)}</strong><small>回到上次阅读位置 →</small></button>`:'';
    content.innerHTML=`<div class="review-results">${recent}<p class="review-results-heading" role="status">${rows.length} ${view==='documents'?'份讲义':subject==='math'?'份原稿':'个可选条目'} · 选择后在这里阅读</p>${rows.map(e=>`<button class="review-result" data-review-key="${esc(e.key)}" aria-current="${e.key===selected?.key}"><strong>${esc(e.title)}</strong><small>${esc(e.document||e.description||e.section||'')} →</small></button>`).join('')}</div>${rows.length?'':`<div class="review-empty"><strong>没有找到这个知识点</strong><p>试试更短的关键词，或查看其他主题。</p><button id="review-clear">清除搜索与筛选</button></div>`}`;
    content.querySelectorAll('[data-review-key]').forEach(b=>b.onclick=()=>{pickerTop=content.scrollTop;originKey=b.dataset.reviewKey;read(rows.find(e=>e.key===originKey));});
    content.querySelector('[data-review-resume]')?.addEventListener('click',()=>read(selected));
    $('#review-clear')?.addEventListener('click',()=>{query='';category='';$('#review-search').value='';$('#review-category').value='';picker();$('#review-search').focus();});
    content.scrollTop=0;
  }
  function documentBar(entry){return `<div class="review-document-bar"><button id="review-back">← 返回回顾目录</button>${entry.type==='lesson'&&entry.heading!==null?'<button id="review-full">完整讲义 ↗</button>':''}${subject==='cpp'?`<select id="review-reading-style" aria-label="当前回顾代码写法"><option value="using" ${codeStyle==='using'?'selected':''}>课堂写法</option><option value="explicit" ${codeStyle==='explicit'?'selected':''}>显式 std::</option></select>`:'<small>离线原稿</small>'}</div>`;}
  function applyCode(){panel.querySelectorAll('pre code.language-cpp').forEach(code=>{if(code.dataset.reviewOriginal===undefined)code.dataset.reviewOriginal=code.textContent;code.textContent=LessonLibrary.variant(code.dataset.reviewOriginal,codeStyle);Prism.highlightElement(code);});}
  async function read(entry,page){
    if(!entry||!visible)return;
    remember();displayed=null;const seq=++request,content=$('#review-content'),previous=selected;selected=entry;
    panel.querySelector('.review-controls').hidden=true;
    sourcePage=page||(previous?.key===entry.key?sourcePage:1);
    content.setAttribute('aria-busy','true');content.innerHTML=documentBar(entry)+'<div class="review-empty" role="status">正在翻开内容…</div>';bindBack();
    try{
      const data=entry.type==='syntax'?entry:await cached(documents,entry.type+':'+(entry.item_id||entry.id),()=>api((entry.type==='source'?'/api/source/':'/api/item/')+encodeURIComponent(entry.item_id||entry.id)));
      if(seq!==request||!visible)return;
      let body;
      if(entry.type==='source'&&data.pages){
        sourcePage=Math.min(data.pages,Math.max(1,sourcePage));
        body=`<div class="review-page-controls"><button id="review-page-prev" ${sourcePage===1?'disabled':''}>← 上一页</button><label>第 <input id="review-page-number" aria-label="回顾原稿页码" type="number" min="1" max="${data.pages}" value="${sourcePage}"> / ${data.pages} 页</label><button id="review-page-next" ${sourcePage===data.pages?'disabled':''}>下一页 →</button></div><div class="review-source-page"><img src="/assets/${encodeURIComponent(data.page_assets[sourcePage-1])}" alt="${esc(data.name)} 第 ${sourcePage} 页"></div>`;
      }else if(entry.type==='source')body=`<article class="review-document"><h2>${esc(data.name)}</h2>${data.body?md(data.body):'<p>此资料需要在对应应用中阅读。</p>'}<a href="/assets/${encodeURIComponent(data.asset)}" target="_blank" rel="noopener">打开离线原件 ↗</a></article>`;
      else if(entry.type==='syntax')body=`<article class="review-document"><h2>${esc(entry.title)}</h2>${LessonTeaching.html(LessonTeaching.guides[entry.id],false)}<details><summary>进阶说明与易错点</summary><p>${esc(entry.notes)}</p></details></article>`;
      else body=`<article class="review-document"><p class="provenance">${esc(entry.document||data.title)}</p>${md(LessonLibrary.slice(data.payload.question_md,entry.heading))}<div class="source-links">${referenceHTML(data.payload.references)}</div></article>`;
      content.innerHTML=documentBar(entry)+body;bindBack();
      $('#review-full')?.addEventListener('click',()=>read({...entry,key:'document:'+entry.item_id,title:data.title,heading:null}));
      $('#review-page-prev')?.addEventListener('click',()=>read(entry,sourcePage-1));$('#review-page-next')?.addEventListener('click',()=>read(entry,sourcePage+1));
      $('#review-page-number')?.addEventListener('change',e=>read(entry,Math.min(data.pages,Math.max(1,Number(e.target.value)||1))));
      enhance(content);
      LessonTeaching.explainHeaders(content);applyCode();
      content.querySelectorAll('[data-source]').forEach(b=>b.onclick=()=>openSource(b.dataset.source,Number(b.dataset.page)));
      content.querySelector('img')?.addEventListener('error',()=>{if(seq===request){const p=document.createElement('p');p.className='review-empty';p.setAttribute('role','alert');p.textContent='此页图像未能读取，请切换页码重试，或从来源资料打开原件。';content.append(p);}});
      displayed=entry.key;content.setAttribute('aria-busy','false');const resumeTop=positions.get(subject+'|'+entry.key+'|'+sourcePage)||0;content.scrollTop=resumeTop;
      const appliedTop=content.scrollTop;
      content.querySelector('img')?.addEventListener('load',()=>{if(seq===request&&visible&&content.scrollTop===appliedTop)content.scrollTop=resumeTop;},{once:true});
      content.focus({preventScroll:true});
    }catch(error){if(seq===request&&visible){content.setAttribute('aria-busy','false');content.innerHTML=documentBar(entry)+`<div class="review-empty" role="alert"><strong>内容暂时没有打开</strong><p>${esc(error.message)}</p><button id="review-read-retry">重新读取</button></div>`;bindBack();$('#review-read-retry').onclick=()=>read(entry);}}
  }
  function bindBack(){
    $('#review-reading-style')?.addEventListener('change',e=>{codeStyle=e.target.value;$('#review-code-style').value=codeStyle;applyCode();});
    $('#review-back').onclick=()=>{request++;picker();$('#review-content').scrollTop=pickerTop;const button=[...panel.querySelectorAll('[data-review-key]')].find(b=>b.dataset.reviewKey===originKey);(button||$('#review-search')).focus({preventScroll:true});};
  }
  async function find(){await open();if(!visible||!catalog)return;request++;picker();$('#review-search').focus({preventScroll:true});}
  toggle.onclick=()=>visible?close():open();
  // Escape only closes a review pane when it owns focus; nested dialogs keep theirs.
  panel.addEventListener('keydown',e=>{if(e.key==='Escape'&&!document.querySelector('dialog[open]')){e.preventDefault();e.stopPropagation();close();}});
  return {open,close,sync,find};
})();
