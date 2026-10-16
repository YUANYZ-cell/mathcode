'use strict';
// Small, offline motion primitives. References and the loader license are in THIRD_PARTY_NOTICES.md.
window.StudyMotion=(()=>{
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const tasks=new Map(),animations=new Map();
  let serial=0,showTimer,hideTimer,ticker,shownAt=0;
  const panel=()=>document.querySelector('#activity');
  const loader='<span class="step-loader" aria-hidden="true"><i></i><b></b></span>';
  const loading=label=>`<div class="loading-state" role="status">${loader}<span>${label}</span><span class="loading-dots" aria-hidden="true"><i></i><i></i><i></i></span></div>`;
  function reveal(target,{distance=12,duration=360,delay=0}={}){
    const node=typeof target==='string'?document.querySelector(target):target;
    if(!node)return;
    animations.get(node)?.cancel();animations.delete(node);
    if(reduced.matches||node.hidden||!node.isConnected)return;
    const animation=node.animate([{opacity:0,transform:`translateY(${distance}px)`},{opacity:1,transform:'translateY(0)'}],{duration,delay,easing:'cubic-bezier(.22,1,.36,1)',fill:'backwards'});
    animations.set(node,animation);
    const clear=()=>{if(animations.get(node)===animation)animations.delete(node);};
    animation.onfinish=clear;animation.oncancel=clear;
  }
  function stagger(container,selector){
    const node=typeof container==='string'?document.querySelector(container):container;
    node?.querySelectorAll(selector).forEach((child,i)=>reveal(child,{distance:10,duration:330,delay:Math.min(i,8)*26}));
  }
  function paint(task){
    const p=panel();if(!p)return;
    p.dataset.state=task.state||'busy';
    const title=p.querySelector('.activity-title'),detail=p.querySelector('.activity-detail'),message=task.detail||'正在处理，请稍候';
    if(title.textContent!==task.label)title.textContent=task.label;
    if(detail.textContent!==message)detail.textContent=message;
    p.querySelector('.activity-time').textContent=`${((performance.now()-task.start)/1000).toFixed(1)} s`;
    p.querySelectorAll('.activity-step').forEach((step,i)=>{
      step.classList.toggle('done',i===0||task.state==='success');
      step.classList.toggle('current',i===1&&!task.state||i===2&&task.state==='success');
    });
  }
  function show(task){
    const p=panel();if(!p)return;
    paint(task);if(p.hidden){p.hidden=false;shownAt=performance.now();reveal(p,{distance:10,duration:260});}
  }
  function latest(){return [...tasks.values()].at(-1);}
  function begin(label){
    const id=++serial,task={label,start:performance.now()};tasks.set(id,task);
    clearTimeout(hideTimer);document.body.dataset.motionState='busy';
    if(!panel()?.hidden)show(task);
    else if(!showTimer)showTimer=setTimeout(()=>{showTimer=null;const current=latest();if(current)show(current);},160);
    if(!ticker)ticker=setInterval(()=>{const current=latest();if(current&&!panel()?.hidden)paint(current);},100);
    let ended=false;
    return error=>{
      if(ended)return;ended=true;tasks.delete(id);
      const current=latest();if(current){show(current);return;}
      document.body.dataset.motionState='idle';clearTimeout(showTimer);showTimer=null;clearInterval(ticker);ticker=null;
      if(panel()?.hidden&&!error)return;
      task.state=error?'error':'success';task.detail=error?'未完成，请查看错误提示':'已完成';show(task);
      hideTimer=setTimeout(()=>{if(!tasks.size&&panel())panel().hidden=true;},Math.max(error?3200:950,350-(performance.now()-shownAt)));
    };
  }
  async function run(label,work){
    const end=begin(label);
    try{const result=await work();end();return result;}catch(error){end(error);throw error;}
  }
  function button(button,label,work){
    const old=button.textContent,wasDisabled=button.disabled;
    button.disabled=true;button.classList.add('button-working');button.setAttribute('aria-busy','true');
    button.innerHTML=`<span class="button-spinner" aria-hidden="true"></span><span>${label}</span>`;
    return run(label,work).finally(()=>{button.textContent=old;button.disabled=wasDisabled;button.classList.remove('button-working');button.removeAttribute('aria-busy');});
  }
  // Event delegation keeps dynamically rendered cards cheap, with no listener per card.
  document.addEventListener('pointermove',event=>{
    if(reduced.matches||event.pointerType==='touch')return;
    const card=event.target.closest('.library-card,.source-card,.code-project');if(!card)return;
    const box=card.getBoundingClientRect();card.style.setProperty('--spot-x',`${event.clientX-box.left}px`);card.style.setProperty('--spot-y',`${event.clientY-box.top}px`);
  },{passive:true});
  document.addEventListener('toggle',event=>{
    if(event.target.matches('details[open]'))reveal(event.target.querySelector('.answer-content')||event.target,{distance:7,duration:280});
  },true);
  reduced.addEventListener('change',()=>{if(reduced.matches){animations.forEach(animation=>animation.cancel());animations.clear();}});
  return {loading,reveal,stagger,begin,run,button,get reduced(){return reduced.matches;}};
})();
