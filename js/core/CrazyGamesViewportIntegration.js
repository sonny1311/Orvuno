// ORVUNO – CrazyGames viewport layout.
// Only active inside the dedicated CrazyGames native HTML5 build.

function installStyle(){
  if(document.getElementById('orvuno-crazygames-viewport-style'))return;
  const style=document.createElement('style');
  style.id='orvuno-crazygames-viewport-style';
  style.textContent=`
html[data-orvuno-crazy-games="1"],
html[data-orvuno-crazy-games="1"] body{
  width:100%!important;
  height:100%!important;
  min-width:0!important;
  max-width:none!important;
  margin:0!important;
  overflow:hidden!important;
}
html[data-orvuno-crazy-games="1"] #worldApp{
  position:relative!important;
  width:100vw!important;
  height:100vh!important;
  min-width:0!important;
  max-width:none!important;
  margin:0!important;
  padding:0!important;
  overflow:hidden!important;
  box-sizing:border-box!important;
}
html[data-orvuno-crazy-games="1"] #orvuno-side-nav{
  position:fixed!important;
  left:16px!important;
  top:116px!important;
  bottom:48px!important;
  width:190px!important;
  min-width:190px!important;
  max-width:190px!important;
  height:auto!important;
  max-height:none!important;
  margin:0!important;
  box-sizing:border-box!important;
  overflow-y:auto!important;
  overflow-x:hidden!important;
  z-index:70010!important;
  scrollbar-width:thin;
}
html[data-orvuno-crazy-games="1"] #world-home-dashboard{
  position:fixed!important;
  left:220px!important;
  right:16px!important;
  top:116px!important;
  bottom:48px!important;
  width:auto!important;
  min-width:0!important;
  max-width:none!important;
  height:auto!important;
  min-height:0!important;
  max-height:none!important;
  margin:0!important;
  padding:14px 14px 28px!important;
  box-sizing:border-box!important;
  overflow-y:auto!important;
  overflow-x:hidden!important;
  display:block!important;
}
html[data-orvuno-crazy-games="1"] #world-home-dashboard > *{
  position:relative!important;
  float:none!important;
  clear:both!important;
  display:block!important;
  width:100%!important;
  min-width:0!important;
  max-width:none!important;
  box-sizing:border-box!important;
  margin:0 0 12px 0!important;
  grid-column:1/-1!important;
  grid-row:auto!important;
  align-self:stretch!important;
}
html[data-orvuno-crazy-games="1"] #world-home-dashboard > * > *{
  max-width:100%!important;
  box-sizing:border-box!important;
}
html[data-orvuno-crazy-games="1"] #world-home-dashboard [data-orvuno-customer-grid]{
  display:grid!important;
  grid-template-columns:repeat(2,minmax(0,1fr))!important;
  gap:10px!important;
  width:100%!important;
  min-width:0!important;
  max-width:none!important;
}
html[data-orvuno-crazy-games="1"] #world-home-dashboard [data-orvuno-customer-grid] > *{
  width:100%!important;
  min-width:0!important;
  max-width:none!important;
  box-sizing:border-box!important;
}
html[data-orvuno-crazy-games="1"] #world-home-dashboard button,
html[data-orvuno-crazy-games="1"] #world-home-dashboard input,
html[data-orvuno-crazy-games="1"] #world-home-dashboard select,
html[data-orvuno-crazy-games="1"] #world-home-dashboard textarea{
  max-width:100%!important;
  box-sizing:border-box!important;
}
html[data-orvuno-crazy-games="1"] [role="dialog"],
html[data-orvuno-crazy-games="1"] .orvuno-modal,
html[data-orvuno-crazy-games="1"] .modal,
html[data-orvuno-crazy-games="1"] .dialog,
html[data-orvuno-crazy-games="1"] .orvuno-help-overlay,
html[data-orvuno-crazy-games="1"] .orvuno-tutorial-overlay{
  z-index:120000!important;
}
@media(max-width:900px){
  html[data-orvuno-crazy-games="1"] #orvuno-side-nav{
    left:8px!important;
    width:168px!important;
    min-width:168px!important;
    max-width:168px!important;
  }
  html[data-orvuno-crazy-games="1"] #world-home-dashboard{
    left:186px!important;
    right:8px!important;
  }
  html[data-orvuno-crazy-games="1"] #world-home-dashboard [data-orvuno-customer-grid]{
    grid-template-columns:1fr!important;
  }
}
@media(max-width:720px){
  html[data-orvuno-crazy-games="1"] #orvuno-side-nav{display:none!important}
  html[data-orvuno-crazy-games="1"] #world-home-dashboard{
    left:8px!important;
    right:8px!important;
    top:92px!important;
    bottom:62px!important;
  }
  html[data-orvuno-crazy-games="1"] #world-main-nav{
    display:flex!important;
    position:fixed!important;
    left:0!important;
    right:0!important;
    bottom:0!important;
    width:100%!important;
    max-width:none!important;
    overflow-x:auto!important;
    z-index:70020!important;
  }
}
`;
  document.head.append(style);
}

function normalize(){
  if(!window.orvunoCrazyGames?.nativeBuild)return false;
  document.documentElement.dataset.orvunoCrazyGames='1';
  installStyle();
  const root=document.getElementById('world-home-dashboard');
  if(root){
    for(const prop of ['max-width','width','display','grid-template-columns','grid-template-rows'])root.style.removeProperty(prop);
    for(const child of root.children){
      for(const prop of ['width','min-width','max-width','flex','flex-basis','grid-column','grid-row','position','left','right'])child.style.removeProperty(prop);
    }
  }
  return true;
}

function install(){
  if(!window.orvunoCrazyGames?.nativeBuild)return false;
  normalize();
  let queued=false;
  const schedule=()=>{
    if(queued)return;
    queued=true;
    requestAnimationFrame(()=>{queued=false;normalize();});
  };
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
  for(const eventName of ['worldproject:company-loaded','worldproject:company-activated','worldproject:company-switched','world:game-state-dirty']){
    window.addEventListener(eventName,schedule);
  }
  window.addEventListener('resize',schedule);
  return true;
}

if(typeof window!=='undefined'){
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
}

export { install as installCrazyGamesViewport };
