// ORVUNO – mobile/app usability layer
// Keeps desktop layout intact while making the installed app usable on narrow screens.
(function(){
  const isMobile=()=>window.matchMedia('(max-width: 760px)').matches;
  const isApp=()=>new URLSearchParams(location.search).get('source')==='app'||window.matchMedia('(display-mode: standalone)').matches;
  const modalSelector='[data-orvuno-payment-overlay],[role="dialog"],.orvuno-modal,.modal,.dialog,.orvuno-help-overlay,.orvuno-tutorial-overlay';
  function visible(el){
    if(!el||el.hidden||el.getAttribute('aria-hidden')==='true')return false;
    const cs=getComputedStyle(el);
    if(cs.display==='none'||cs.visibility==='hidden'||Number(cs.opacity)===0)return false;
    const r=el.getBoundingClientRect();
    return r.width>0&&r.height>0;
  }
  function modalOpen(){return [...document.querySelectorAll(modalSelector)].some(visible);}
  function mark(){
    const mobile=isMobile();
    const open=mobile&&modalOpen();
    document.documentElement.classList.toggle('orvuno-mobile-ui',mobile);
    document.documentElement.classList.toggle('orvuno-installed-app',isApp());
    document.documentElement.classList.toggle('orvuno-modal-open',open);
    document.body?.classList.toggle('orvuno-modal-open',open);
  }
  function installStyle(){
    if(document.getElementById('orvuno-mobile-usability-style'))return;
    const s=document.createElement('style');s.id='orvuno-mobile-usability-style';s.textContent=`
html.orvuno-installed-app .android-download-fab{display:none!important}
@media(max-width:760px){
  html,body{width:100%!important;max-width:100%!important;overflow-x:hidden!important}
  body{height:auto!important;min-height:100dvh!important;overflow-y:auto!important;padding-bottom:calc(76px + env(safe-area-inset-bottom,0px))!important}
  html.orvuno-modal-open,html.orvuno-modal-open body,body.orvuno-modal-open{overflow:hidden!important;overscroll-behavior:none!important;touch-action:none!important}
  #worldApp{width:100%!important;max-width:100%!important;height:auto!important;min-height:100dvh!important;overflow:visible!important;position:relative!important}
  #world-home-dashboard{width:100%!important;max-width:100%!important;margin:0!important;padding:20px 10px 94px!important;box-sizing:border-box!important;min-height:100dvh!important;height:auto!important;overflow:visible!important}
  #world-home-dashboard>section{width:100%!important;max-width:100%!important;min-width:0!important;box-sizing:border-box!important;padding:12px!important;margin:0 0 10px!important;overflow:visible!important}
  #world-home-dashboard table{display:block!important;width:100%!important;max-width:100%!important;overflow-x:auto!important;-webkit-overflow-scrolling:touch!important}
  #world-home-dashboard input,#world-home-dashboard select,#world-home-dashboard textarea{max-width:100%!important;box-sizing:border-box!important}
  #orvuno-side-nav,#orvuno-right-rail{display:none!important}
  #world-main-nav{position:fixed!important;left:0!important;right:0!important;top:auto!important;bottom:0!important;width:100%!important;max-width:none!important;min-height:0!important;height:auto!important;max-height:76px!important;display:flex!important;flex-wrap:nowrap!important;align-items:center!important;gap:6px!important;padding:8px 8px calc(8px + env(safe-area-inset-bottom,0px))!important;box-sizing:border-box!important;overflow-x:auto!important;overflow-y:hidden!important;background:rgba(7,16,29,.98)!important;border-top:1px solid #2b3b53!important;box-shadow:0 -8px 24px rgba(0,0,0,.4)!important;z-index:4000!important;scrollbar-width:none!important;scroll-snap-type:x proximity!important;overscroll-behavior-x:contain!important;-webkit-overflow-scrolling:touch!important}
  html.orvuno-modal-open #world-main-nav{visibility:hidden!important;pointer-events:none!important;opacity:0!important}
  #world-main-nav::-webkit-scrollbar{display:none!important}
  #world-main-nav button{flex:0 0 auto!important;width:auto!important;min-width:auto!important;max-width:none!important;min-height:44px!important;height:44px!important;margin:0!important;padding:8px 10px!important;border-radius:9px!important;font-size:13px!important;line-height:1.05!important;white-space:nowrap!important;box-shadow:none!important;position:static!important;inset:auto!important;transform:none!important;scroll-snap-align:start!important;transition:background-color .16s ease,border-color .16s ease,box-shadow .16s ease!important}
  #world-main-nav button:active{background:#20324e!important;border-color:#d7a62b!important;box-shadow:inset 0 0 0 1px rgba(215,166,43,.28)!important}
  #world-main-nav button:focus-visible{outline:2px solid #d7a62b!important;outline-offset:-2px!important}
  #world-main-nav #orvuno-language-control{position:static!important;inset:auto!important;transform:none!important;transform-origin:center!important;z-index:auto!important;flex:0 0 auto!important;margin:0!important;padding:0!important;background:transparent!important;border:0!important;box-shadow:none!important;gap:4px!important;height:44px!important;align-items:center!important;scroll-snap-align:start!important}
  #world-main-nav #orvuno-language-control>span{font-size:16px!important}
  #world-main-nav #orvuno-language-select{height:44px!important;min-height:44px!important;max-width:110px!important;margin:0!important;padding:7px 28px 7px 9px!important;border-radius:9px!important;font-size:14px!important;font-weight:800!important;background:#162238!important;color:#fff!important;border:1px solid #3a4e6b!important}
  .android-download-fab{display:none!important}
  [data-orvuno-payment-overlay],[role="dialog"],.orvuno-modal,.modal,.dialog,.orvuno-help-overlay,.orvuno-tutorial-overlay{z-index:120000!important;box-sizing:border-box!important}
  [role="dialog"],.orvuno-modal,.modal,.dialog{width:100vw!important;max-width:100vw!important;max-height:100dvh!important;border-radius:0!important;box-sizing:border-box!important;background:#0b1524!important;color:#f8fafc!important;box-shadow:0 24px 80px rgba(0,0,0,.72)!important}
  [role="dialog"]>*,.orvuno-modal>*,.modal>*,.dialog>*{max-width:100%!important;min-width:0!important;box-sizing:border-box!important}
  html.orvuno-modal-open [role="dialog"],html.orvuno-modal-open .orvuno-modal,html.orvuno-modal-open .modal,html.orvuno-modal-open .dialog{overflow-y:auto!important;-webkit-overflow-scrolling:touch!important;overscroll-behavior:contain!important;touch-action:pan-y!important}
  button,input,select,textarea{font-size:16px!important}
}
`;
    document.head.append(s);
  }
  function moveFloatingActionsIntoNav(){
    if(!isMobile())return;
    const nav=document.getElementById('world-main-nav');
    if(!nav)return;
    const candidates=[...document.querySelectorAll('button,[role="button"]')];
    for(const el of candidates){
      if(el.closest('#world-main-nav'))continue;
      const text=(el.textContent||'').replace(/\s+/g,' ').trim();
      const move=text==='Ausbau'||/^⚙️?\s*Ausbau$/i.test(text)||/^🎬?\s*Werbung\b/i.test(text);
      if(!move)continue;
      const cs=getComputedStyle(el);
      const looksFloating=cs.position==='fixed'||cs.position==='sticky'||Number(cs.zIndex||0)>1000;
      if(!looksFloating)continue;
      el.dataset.orvunoMobileRelocated='1';
      el.style.removeProperty('position');
      el.style.removeProperty('top');
      el.style.removeProperty('right');
      el.style.removeProperty('bottom');
      el.style.removeProperty('left');
      el.style.removeProperty('inset');
      el.style.removeProperty('transform');
      nav.append(el);
    }
  }
  function moveLanguageIntoNav(){
    if(!isMobile())return;
    const nav=document.getElementById('world-main-nav');
    const language=document.getElementById('orvuno-language-control');
    if(!nav||!language||language.parentElement===nav)return;
    language.dataset.orvunoMobileRelocated='1';
    nav.append(language);
  }
  function normalizeRuntime(){
    mark();
    if(!isMobile())return;
    const nav=document.getElementById('world-main-nav');
    if(nav){nav.style.removeProperty('top');nav.setAttribute('aria-label','ORVUNO Schnellnavigation');}
    moveFloatingActionsIntoNav();
    moveLanguageIntoNav();
    document.querySelectorAll('#world-home-dashboard [style*="position: fixed"],#world-home-dashboard [style*="position:fixed"]').forEach(el=>{
      if(el.closest(modalSelector))return;
      const r=el.getBoundingClientRect();
      if(r.width>innerWidth*.7||r.height>innerHeight*.28){
        el.style.setProperty('position','relative','important');
        el.style.setProperty('inset','auto','important');
        el.style.setProperty('top','auto','important');
        el.style.setProperty('right','auto','important');
        el.style.setProperty('bottom','auto','important');
        el.style.setProperty('left','auto','important');
        el.style.setProperty('width','100%','important');
        el.style.setProperty('max-width','100%','important');
        el.style.setProperty('max-height','none','important');
        el.style.setProperty('overflow','visible','important');
      }
    });
    mark();
  }
  installStyle();mark();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',normalizeRuntime,{once:true});else normalizeRuntime();
  addEventListener('resize',normalizeRuntime,{passive:true});

  let queued=false;
  let timer=0;
  function queueNormalize(){
    if(!isMobile()||queued)return;
    queued=true;
    timer=setTimeout(()=>requestAnimationFrame(()=>{queued=false;normalizeRuntime();}),60);
  }
  const observer=new MutationObserver(mutations=>{
    if(mutations.some(m=>m.addedNodes.length||m.removedNodes.length||m.type==='attributes'))queueNormalize();
  });
  observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style','hidden','aria-hidden','open']});
  addEventListener('beforeunload',()=>{if(timer)clearTimeout(timer);observer.disconnect();},{once:true});
})();
