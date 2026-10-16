'use strict';
// The compact fields and the focused workspace share the same draft and save action.
window.PersonalRecords=(()=>{
  const fields={
    notes:{title:'我的思路',label:'先记下你打算怎么做',placeholder:'你的分析、疑问、关键步骤…',empty:'还没有记录思路。可以先写下你的分析、疑问和关键步骤。'},
    result:{title:'结果与复盘',label:'运行结果与复盘',placeholder:'预测与实际结果、哪里容易错、下次怎样检查…',empty:'还没有写复盘。练习后，可以记下哪里容易错、为什么错、下次怎样检查。'}
  };
  let dialog,active='result',view='read',opener,mainScroll=0;
  let positions={};
  const renderer=new marked.Renderer();
  // Personal code such as #include <iostream> must stay visible outside code fences too.
  renderer.html=token=>esc(token.text);
  const get=id=>document.getElementById(id);
  function count(value){return `${value.length.toLocaleString()} 字 · ${value?value.split('\n').length:0} 行`;}
  function markup(record){
    return `<section class="personal"><div class="personal-heading"><h3>我的思路与结果</h3><small>代码继续在 VS Code 编写与运行</small></div>${Object.entries(fields).map(([id,f])=>`<div class="record-field"><div class="record-field-heading"><label for="${id}">${f.label}</label><small id="record-${id}-count">${count(record[id]||'')}</small><div class="record-field-actions"><button type="button" class="text-button" data-record-open="${id}" data-record-view="read" aria-label="展开阅读${f.title}" aria-haspopup="dialog">展开阅读 ↗</button><button type="button" class="text-button" data-record-open="${id}" data-record-view="edit" aria-label="专注编辑${f.title}" aria-haspopup="dialog">专注编辑 ↗</button></div></div><textarea id="${id}" placeholder="${f.placeholder}" spellcheck="false">${esc(record[id])}</textarea></div>`).join('')}<div class="record-bottom"><select id="record-status" aria-label="练习状态">${['未记录','思考中','已运行','待复习','已完成'].map(s=>`<option ${record.status===s?'selected':''}>${s}</option>`).join('')}</select><button id="save-record" class="primary-button">保存个人记录</button><span id="save-state" role="status">${state.current.record?'已保存 · '+formatTime(state.current.record.updated_at):'尚未保存个人记录'}</span></div></section>`;
  }
  function ensureDialog(){
    if(dialog)return;
    dialog=document.createElement('dialog');dialog.id='record-dialog';dialog.setAttribute('aria-labelledby','record-dialog-title');
    dialog.innerHTML=`<div class="dialog-bar"><div><strong id="record-dialog-title">我的思路与复盘</strong><small id="record-question"></small></div><button type="button" class="secondary-button" id="record-close">返回题目</button></div><div class="record-workspace-toolbar"><div class="record-tabs" role="tablist" aria-label="个人记录"><button id="record-tab-notes" role="tab" aria-controls="record-workspace" data-record-tab="notes">我的思路</button><button id="record-tab-result" role="tab" aria-controls="record-workspace" data-record-tab="result">结果与复盘</button></div><div class="record-view-switch" role="group" aria-label="阅读或编辑"><button type="button" data-record-mode="read">阅读</button><button type="button" data-record-mode="edit">编辑</button></div></div><div id="record-workspace" role="tabpanel"><div id="record-reading" class="record-reading" tabindex="0" aria-label="记录全文"></div><textarea id="record-editor" spellcheck="false" aria-label="编辑个人记录"></textarea></div><div class="record-workspace-footer"><div><span id="record-workspace-state" role="status" aria-live="polite"></span><small id="record-workspace-hint">关闭后保留修改，保存后写入个人记录。</small></div><small id="record-workspace-count"></small><button type="button" id="record-workspace-save" class="primary-button">保存个人记录</button></div>`;
    document.body.append(dialog);
    get('record-close').addEventListener('click',()=>dialog.close());
    dialog.addEventListener('cancel',e=>{e.preventDefault();dialog.close();});
    dialog.addEventListener('keydown',e=>{
      if(e.key!=='Tab')return;
      const controls=[...dialog.querySelectorAll('button,a[href],textarea,[tabindex]')].filter(el=>!el.disabled&&el.tabIndex>=0&&el.getClientRects().length);
      const first=controls[0],last=controls[controls.length-1];
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
      else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
    });
    dialog.addEventListener('close',()=>{
      remember();
      opener?.isConnected&&opener.focus({preventScroll:true});
      (window.studyScrollElement?.()||document.querySelector('main')).scrollTop=mainScroll;
    });
    dialog.querySelectorAll('[data-record-tab]').forEach(b=>b.addEventListener('click',()=>switchField(b.dataset.recordTab)));
    dialog.querySelector('.record-tabs').addEventListener('keydown',e=>{
      if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
      e.preventDefault();switchField(e.key==='Home'?'notes':e.key==='End'?'result':active==='notes'?'result':'notes');
    });
    dialog.querySelectorAll('[data-record-mode]').forEach(b=>b.addEventListener('click',()=>{remember();view=b.dataset.recordMode;render(true);}));
    get('record-editor').addEventListener('input',()=>{
      get(active).value=get('record-editor').value;
      get(active).dispatchEvent(new Event('input',{bubbles:true}));
    });
    get('record-workspace-save').addEventListener('click',()=>saveRecord());
  }
  function remember(){
    if(!dialog)return;
    const p=positions[active]||(positions[active]={});
    if(view==='edit'){
      const editor=get('record-editor');p.start=editor.selectionStart;p.end=editor.selectionEnd;p.editScroll=editor.scrollTop;
    }else p.readScroll=get('record-reading').scrollTop;
  }
  function switchField(id){remember();active=id;render(false);get('record-tab-'+id).focus({preventScroll:true});}
  function render(focus){
    const f=fields[active],value=get(active).value,p=positions[active]||{};
    dialog.querySelectorAll('[data-record-tab]').forEach(b=>{
      const selected=b.dataset.recordTab===active;b.setAttribute('aria-selected',String(selected));b.tabIndex=selected?0:-1;
    });
    get('record-workspace').setAttribute('aria-labelledby','record-tab-'+active);
    dialog.querySelectorAll('[data-record-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.recordMode===view)));
    const reading=get('record-reading'),editor=get('record-editor');
    reading.hidden=view!=='read';editor.hidden=view!=='edit';
    if(view==='read'){
      reading.innerHTML=value.trim()?md(value,{renderer}):`<p class="record-empty">${f.empty}</p><button type="button" class="secondary-button" id="record-start-writing">开始记录</button>`;
      // Preserve plain-text line breaks while retaining safe Markdown and C++ rendering.
      enhance(reading);reading.scrollTop=p.readScroll||0;
      get('record-start-writing')?.addEventListener('click',()=>{view='edit';render(true);});
      if(focus)reading.focus({preventScroll:true});
    }else{
      editor.value=value;editor.placeholder=f.placeholder;editor.setAttribute('aria-label','编辑'+f.title);
      editor.setSelectionRange(p.start??0,p.end??0);editor.scrollTop=p.editScroll||0;
      if(focus)editor.focus({preventScroll:true});
    }
    get('record-workspace-hint').textContent=active==='result'&&view==='edit'?'可以记下：哪里容易错、为什么错、下次怎么检查。':'关闭后保留修改，保存后写入个人记录。';
    sync();
  }
  function open(id,mode,button){
    ensureDialog();active=id;view=mode;opener=button;mainScroll=(window.studyScrollElement?.()||document.querySelector('main')).scrollTop;
    get('record-question').textContent=`${state.current.label||state.current.id} · ${state.current.title}`;
    dialog.showModal();render(true);
  }
  function sync(){
    Object.keys(fields).forEach(id=>{if(get('record-'+id+'-count'))get('record-'+id+'-count').textContent=count(get(id).value);});
    if(!dialog?.open)return;
    get('record-workspace-count').textContent=count(get(active).value);
    get('record-workspace-state').textContent=state.saving?'正在保存个人记录…':get('save-state').textContent;
    const save=get('record-workspace-save');save.disabled=!!state.saving;save.textContent=state.saving?'正在保存…':'保存个人记录';
  }
  function mount(){
    positions={};
    document.querySelectorAll('[data-record-open]').forEach(b=>b.addEventListener('click',()=>open(b.dataset.recordOpen,b.dataset.recordView,b)));
    ['notes','result','record-status'].forEach(id=>get(id).addEventListener('input',sync));
  }
  return {markup,mount,sync};
})();
