'use strict';
let codeData=null,codeSignature='',codeSelected=null,codeVersion=null,codeLatest=null,codeBusy=false;
let itemCodeSelected=null,itemCodeVersion=null,itemCodeLatest=null,itemCodeRequest=0,itemCodeTitle='';
const codeCatch=fn=>async(...args)=>{try{await fn(...args);}catch(e){toast(e.message);}};
async function loadCode(){
  const data=await Motion.run('读取本地练习代码',()=>api('/api/code'));if(state.mode!=='code')return;codeData=data;codeSignature=JSON.stringify(codeData.projects);renderCode();
}
function projectButtons(project){return `<button class="text-button" data-code-open="${esc(project.id)}">在 VS Code 打开 ↗</button><button class="text-button" data-code-folder="${esc(project.id)}">文件位置</button>`;}
function wireOpen(container){
  container.querySelectorAll('[data-code-open]').forEach(b=>b.onclick=codeCatch(()=>api('/api/code/open',{project_id:b.dataset.codeOpen,action:'vscode'})));
  container.querySelectorAll('[data-code-folder]').forEach(b=>b.onclick=codeCatch(()=>api('/api/code/open',{project_id:b.dataset.codeFolder,action:'folder'})));
}
function renderCode(quiet=false){
  if(!codeData||state.mode!=='code')return;
  const words=$('#search').value.toLowerCase().split(/\s+/).filter(Boolean);
  const projects=codeData.projects.filter(p=>words.every(w=>[p.name,p.label,p.title,p.relative_path].join(' ').toLowerCase().includes(w)));
  const view=$('#code-view');
  view.innerHTML=`<div class="code-toolbar"><button id="new-code" class="primary-button">新建日常项目</button><button id="refresh-code" class="secondary-button">刷新代码</button><button id="open-code-root" class="text-button">打开代码目录 ↗</button><button id="open-learning" class="text-button">原有学习资料 ↗</button><span>保存后自动更新 · 不自动运行代码</span></div><details class="code-settings"><summary>代码目录与使用说明</summary><p class="source-path">${esc(codeData.managed_root)}</p><p>题目练习统一保存为“题号/第01次/main.cpp”，多次练习各用一个文件夹；原有课程示例保留在“原有练习”的分类文件夹内。所有练习共用一个 VS Code 工作区和编译缓存，不再为每题复制配置或累积 EXE。平台每5秒检查一次，检测到保存变化时保留版本。两次检查之间的连续保存只保留最后检测到的内容，未保存的编辑不显示。运行输出可保存在项目内的 result.txt，或记到题目的“运行结果与复盘”。</p><label for="extra-code-root">还可以关联其他代码目录</label><div class="code-path-row"><input id="extra-code-root" placeholder="已有代码文件夹的完整路径"><button id="add-code-root" class="secondary-button">关联目录</button></div>${codeData.roots.map(r=>`<p class="source-path">${esc(r.path)}</p>`).join('')}</details>${codeData.warnings.map(w=>`<p class="convention">${esc(w)}</p>`).join('')}<div class="code-layout"><div class="code-projects"><div class="library-intro"><h2>练习项目</h2><span>${projects.length} 项</span></div>${projects.map(p=>`<button class="code-project ${p.id===codeSelected?'active':''}" data-code-project="${esc(p.id)}"><strong>${esc(p.name)}</strong><span>${p.label?esc(p.label)+' · '+esc(p.title):'日常代码 · 未关联题目'}</span><small>${p.versions} 个保存版本 · ${formatTime(p.updated_at)}${p.missing?' · 原文件已移动，历史仍保留':''}</small><small>${esc(p.relative_path)}</small></button>`).join('')||'<p class="source-description">这里还没有代码。可以新建项目，或从题目页开始一次练习。</p>'}</div><div id="code-preview" class="code-preview"><p class="source-description">选择左边的项目，查看代码和保存版本。</p></div></div>`;
  $('#new-code').onclick=()=>showPracticeDialog(null);
  $('#refresh-code').onclick=codeCatch(async()=>{await loadCode();toast('代码已刷新');});
  $('#open-code-root').onclick=codeCatch(()=>api('/api/code/open',{action:'vscode'}));
  $('#open-learning').onclick=codeCatch(()=>api('/api/code/open',{action:'materials'}));
  $('#add-code-root').onclick=codeCatch(async()=>{codeData=await api('/api/code/root',{path:$('#extra-code-root').value});renderCode();});
  view.querySelectorAll('[data-code-project]').forEach(b=>b.onclick=codeCatch(async()=>{codeSelected=b.dataset.codeProject;codeVersion=null;codeLatest=null;await showCodePreview();view.querySelectorAll('[data-code-project]').forEach(e=>e.classList.toggle('active',e.dataset.codeProject===codeSelected));}));
  if(!quiet)Motion.stagger(view,'.code-project');
  if(codeSelected&&projects.some(p=>p.id===codeSelected))showCodePreview(quiet).catch(e=>toast(e.message));
}
async function showCodePreview(quiet=false){
  const selected=codeSelected,requestedVersion=codeVersion;
  const read=()=>api('/api/code/'+encodeURIComponent(selected)+(requestedVersion?'?version='+requestedVersion:''));
  const result=quiet?await read():await Motion.run('读取代码保存版本',read);
  if(selected!==codeSelected||requestedVersion!==codeVersion||state.mode!=='code')return;
  const project=codeData.projects.find(p=>p.id===selected);if(!project)return;
  const preview=$('#code-preview');
  preview.innerHTML=`<div class="code-preview-heading"><div><h2>${esc(project.name)}</h2><small>${esc(project.path)}</small></div><div class="code-actions">${projectButtons(project)}</div></div><div class="code-version-row"><label for="code-version">保存版本</label><select id="code-version">${result.versions.map((v,n)=>`<option value="${v.id}" ${v.id===result.version?'selected':''}>${n===0?'最新 · ':''}${formatTime(v.created_at)} · #${result.versions.length-n}</option>`).join('')}</select><button id="bind-code" class="text-button">${project.item_id?'修改关联题目':'关联题目'}</button>${project.item_id?`<button id="go-code-question" class="text-button">查看 ${esc(project.label)} ↗</button>`:''}</div>${result.files.map(f=>`<div class="code-file"><h3>${esc(f.path)}</h3><pre><code class="language-${/\.(cpp|h|hpp|cc|cxx)$/.test(f.path)?'cpp':/\.py$/.test(f.path)?'none':'none'}">${esc(f.code)}</code></pre></div>`).join('')}`;
  enhance(preview);wireOpen(preview);if(!quiet)Motion.reveal(preview,{distance:7});
  codeLatest=result.versions[0]?.id;
  $('#code-version').onchange=codeCatch(async()=>{codeVersion=Number($('#code-version').value)===codeLatest?null:Number($('#code-version').value);await showCodePreview();});
  $('#bind-code').onclick=()=>showBindDialog(project);
  $('#go-code-question')?.addEventListener('click',codeCatch(async()=>{await mode('cpp');await openItem(project.item_id);}));
}
function dialogForm(title,body){
  $('#practice-dialog')?.remove();
  const dialog=document.createElement('dialog');dialog.id='practice-dialog';
  dialog.innerHTML=`<div class="dialog-bar"><strong>${esc(title)}</strong><button class="icon-button" aria-label="关闭">×</button></div><form class="practice-form">${body}<p id="practice-error" role="alert"></p></form>`;
  document.body.append(dialog);dialog.querySelector('.icon-button').onclick=()=>dialog.close();dialog.showModal();return dialog;
}
function showPracticeDialog(item){
  const dialog=dialogForm(item?'新建一次练习':'新建日常项目',item?`<p>${esc(item.label||item.id)} · ${esc(item.title)}</p><p>项目名称包含题号、题名和练习次数。创建后留在本题，已有练习会保留。</p><button class="primary-button">创建练习</button>`:'<label for="project-name">项目名称</label><input id="project-name" required maxlength="64" placeholder="例如 字符串练习"><button class="primary-button">创建项目</button>');
  dialog.querySelector('form').onsubmit=async e=>{
    e.preventDefault();const b=dialog.querySelector('.primary-button');
    try{
      const project=await Motion.button(b,'正在创建练习',()=>api('/api/code/create',{item_id:item?.id,name:dialog.querySelector('#project-name')?.value||''}));
      dialog.close();codeSelected=project.id;codeVersion=null;
      if(item){
        const data=await api('/api/code');
        if(state.mode==='cpp'&&state.current?.id===item.id&&$('#item-code-list'))renderItemCode(data,item.id);
        toast('已创建 '+project.name+'。题目保留在当前页，可点击“在 VS Code 打开”。');
      }else{if(state.mode==='code')$('#search').value='';await loadCode();toast('项目已创建。点击“在 VS Code 打开”开始练习。');}
    }catch(error){if(dialog.open)dialog.querySelector('#practice-error').textContent=error.message;else toast(error.message);b.disabled=false;}
  };
}
function showBindDialog(project){
  const dialog=dialogForm('关联练习题','<label for="bind-search">搜索题号或题目</label><input id="bind-search" placeholder="例如 CS101 或 Hello"><label for="bind-item">选择题目</label><select id="bind-item"></select><button class="primary-button">保存关联</button>');
  const render=()=>{const value=$('#bind-search').value.toLowerCase();$('#bind-item').innerHTML='<option value="">日常代码 · 不关联题目</option>'+codeData.items.filter(i=>[i.label,normalizedName(i.label),i.title].join(' ').toLowerCase().includes(value)).map(i=>`<option value="${esc(i.id)}" ${i.id===project.item_id?'selected':''}>${esc(i.label)} · ${esc(i.title)}</option>`).join('');};
  render();$('#bind-search').oninput=render;
  dialog.querySelector('form').onsubmit=async e=>{e.preventDefault();try{await Motion.button(dialog.querySelector('.primary-button'),'正在保存关联',()=>api('/api/code/bind',{project_id:project.id,item_id:$('#bind-item').value}));dialog.close();await loadCode();}catch(error){$('#practice-error').textContent=error.message;}};
}
function normalizedName(name){return String(name).toUpperCase().replace(/[^A-Z0-9]/g,'');}
function showLabelDialog(item){
  const dialog=dialogForm('修改显示题号',`<p>练习与个人记录继续关联这道题。旧名称仍可识别；新增代码重名时可手动关联。</p><label for="item-label">显示题号</label><input id="item-label" required maxlength="64" value="${esc(item.label||item.id)}"><button class="primary-button">保存题号</button>`);
  dialog.querySelector('form').onsubmit=async e=>{e.preventDefault();try{const result=await Motion.button(dialog.querySelector('.primary-button'),'正在保存题号',()=>api('/api/item-label',{item_id:item.id,label:$('#item-label').value}));Object.assign(item,result);dialog.close();$('#question-label').textContent=item.label;$('#practice-naming').textContent=item.practice_name;$('#reader .question-meta>span').textContent=item.label+' · '+item.section;for(const list of [state.all,state.items]){const row=list.find(i=>i.id===item.id);if(row)row.label=item.label;}renderNav();toast('题号已更新，已有练习关联已保留');}catch(error){$('#practice-error').textContent=error.message;}};
}
async function mountPractice(item){
  itemCodeSelected=null;itemCodeVersion=null;itemCodeLatest=null;itemCodeRequest++;
  const section=document.createElement('section');section.className='practice-panel';section.id='item-practice';
  section.innerHTML=`<div class="personal-heading"><h3>我的练习代码</h3><button id="edit-label" class="text-button">修改题号</button></div><p><span id="question-label">${esc(item.label||item.id)}</span> · 代码可命名为 <strong id="practice-naming">${esc(item.practice_name)}</strong>。同一题可以多次练习，创建后继续在此读题。</p><div class="code-actions"><button id="new-attempt" class="primary-button">新建一次练习</button><button id="view-item-code" class="text-button">查看全部代码 ↗</button></div><div id="item-code-list">${Motion.loading('正在读取本地练习…')}</div>`;
  section.insertAdjacentHTML('beforeend','<div id="item-code-preview" hidden></div>');
  $('#reader').insertBefore(section,$('.personal'));$('#new-attempt').onclick=()=>showPracticeDialog(item);$('#edit-label').onclick=()=>{if(state.dirty){toast('请先保存个人记录，再修改题号');return;}showLabelDialog(item);};
  $('#view-item-code').onclick=codeCatch(()=>mode('code'));
  try{const data=await api('/api/code');if(state.current?.id===item.id&&$('#item-code-list'))renderItemCode(data,item.id);}catch(e){if($('#item-code-list'))$('#item-code-list').textContent=e.message;}
}
function renderItemCode(data,id){
  const list=$('#item-code-list');if(!list)return;
  const projects=data.projects.filter(p=>p.item_id===id);
  itemCodeTitle=projects.find(p=>p.id===itemCodeSelected)?.name||'';
  list.innerHTML=projects.map(p=>`<div class="item-code-row"><div><strong>${esc(p.name)}</strong><small>${p.versions} 个保存版本 · ${formatTime(p.updated_at)}${p.missing?' · 原文件已移动':''}</small></div><button class="text-button" data-view-code="${esc(p.id)}">查看代码</button>${projectButtons(p)}</div>`).join('')||'<p class="source-description">还没有关联的练习代码。新建一次练习，或在“我的代码”中关联已有文件。</p>';
  wireOpen(list);list.querySelectorAll('[data-view-code]').forEach(b=>b.onclick=codeCatch(async()=>{itemCodeSelected=b.dataset.viewCode;itemCodeTitle=projects.find(p=>p.id===itemCodeSelected)?.name||'';itemCodeVersion=null;itemCodeLatest=null;await showItemCode(id);}));
  if(itemCodeSelected)showItemCode(id,true).catch(e=>toast(e.message));
}
async function showItemCode(itemId,quiet=false){
  const selected=itemCodeSelected,version=itemCodeVersion,request=++itemCodeRequest;
  const result=await api('/api/code/'+encodeURIComponent(selected)+(version?'?version='+version:''));
  const preview=$('#item-code-preview');
  if(!preview||state.mode!=='cpp'||state.current?.id!==itemId||selected!==itemCodeSelected||request!==itemCodeRequest)return;
  if(quiet&&itemCodeLatest===result.version)return;
  itemCodeLatest=result.version;preview.hidden=false;
  preview.innerHTML=`<h3>${esc(itemCodeTitle)}</h3><div class="code-version-row"><label for="item-code-version">代码保存版本</label><select id="item-code-version">${result.versions.map((v,n)=>`<option value="${v.id}" ${v.id===result.version?'selected':''}>${n===0?'最新 · ':''}${formatTime(v.created_at)} · #${result.versions.length-n}</option>`).join('')}</select><button id="close-item-code" class="text-button">收起代码</button></div>${result.files.map(f=>`<div class="code-file"><h3>${esc(f.path)}</h3><pre><code class="language-cpp">${esc(f.code)}</code></pre></div>`).join('')}`;
  enhance(preview);
  $('#item-code-version').onchange=codeCatch(async()=>{const chosen=Number($('#item-code-version').value);itemCodeVersion=chosen===result.versions[0]?.id?null:chosen;await showItemCode(itemId);});
  $('#close-item-code').onclick=()=>{itemCodeSelected=null;itemCodeLatest=null;itemCodeRequest++;preview.hidden=true;};
}
setInterval(async()=>{
  if(codeBusy||document.hidden||!(state.mode==='code'||state.mode==='cpp'&&state.reading&&state.current?.kind==='question'))return;
  codeBusy=true;
  try{const data=await api('/api/code');const signature=JSON.stringify(data.projects);if(state.mode==='code'&&signature!==codeSignature&&!$('#practice-dialog[open]')&&!$('#extra-code-root')?.matches(':focus')){codeData=data;codeSignature=signature;const scroller=$('main'),position=scroller.scrollTop;renderCode(true);scroller.scrollTop=position;}else if(state.mode==='cpp'&&$('#item-code-list'))renderItemCode(data,state.current.id);}catch{}finally{codeBusy=false;}
},5000);
