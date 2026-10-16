// Home build list: show one fighting style at a time. Without JS every group stays visible.
(()=>{
  const tabs=document.querySelector('#home-builds .hb-tabs');
  if(!tabs)return;
  const buttons=[...tabs.querySelectorAll('[role="tab"]')];
  const select=(button,focus)=>{
    for(const b of buttons){
      const on=b===button;
      b.setAttribute('aria-selected',String(on));
      b.tabIndex=on?0:-1;
      document.getElementById(b.getAttribute('aria-controls')).hidden=!on;
    }
    if(focus)button.focus();
  };
  tabs.hidden=false;
  document.getElementById('home-builds').classList.add('hb-tabbed');
  buttons.forEach((b,i)=>{
    b.addEventListener('click',()=>select(b));
    b.addEventListener('keydown',e=>{
      const step=e.key==='ArrowRight'?1:e.key==='ArrowLeft'?-1:0;
      if(step){e.preventDefault();select(buttons[(i+step+buttons.length)%buttons.length],true);}
    });
  });
  select(buttons.find(b=>b.getAttribute('aria-selected')==='true')||buttons[0]);
})();
