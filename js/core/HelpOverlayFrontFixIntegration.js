// ORVUNO - Hilfe muss immer ueber dem aktuell geoeffneten Spielfenster liegen.
// Ausserdem schliesst X die Hilfe direkt, ohne vom History-/Dialog-Stack abzuhaengen.
const Z='2147483000';

function forceFront(){
  for(const overlay of document.querySelectorAll('.orvuno-help-overlay')){
    overlay.style.setProperty('z-index',Z,'important');
    overlay.style.setProperty('position','fixed','important');
    overlay.style.setProperty('inset','0','important');
    overlay.style.setProperty('pointer-events','auto','important');
  }
  for(const card of document.querySelectorAll('.orvuno-help-card')){
    card.style.setProperty('position','relative','important');
    card.style.setProperty('z-index',String(Number(Z)+1),'important');
    card.style.setProperty('pointer-events','auto','important');
  }
}

function closeHelpDirect(event){
  const close=event.target?.closest?.('.orvuno-help-close');
  if(!close)return;
  const overlay=close.closest('.orvuno-help-overlay');
  if(!overlay)return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation?.();
  overlay.remove();
  document.documentElement.classList.remove('orvuno-help-open');
  document.body.classList.remove('orvuno-help-open');
}

function closeOnBackdrop(event){
  const overlay=event.target?.closest?.('.orvuno-help-overlay');
  if(!overlay||event.target!==overlay)return;
  event.preventDefault();
  event.stopPropagation();
  overlay.remove();
}

function boot(){
  if(window.__orvunoHelpOverlayFrontFix)return;
  window.__orvunoHelpOverlayFrontFix=true;
  const style=document.createElement('style');
  style.id='orvuno-help-front-fix';
  style.textContent=`.orvuno-help-overlay{z-index:${Z}!important;position:fixed!important;inset:0!important;pointer-events:auto!important}.orvuno-help-card{position:relative!important;z-index:${Number(Z)+1}!important;pointer-events:auto!important}.orvuno-help-close{position:relative!important;z-index:${Number(Z)+2}!important;pointer-events:auto!important;touch-action:manipulation!important}`;
  document.head.append(style);
  document.addEventListener('pointerup',closeHelpDirect,true);
  document.addEventListener('click',closeHelpDirect,true);
  document.addEventListener('pointerup',closeOnBackdrop,true);
  const observer=new MutationObserver(forceFront);
  observer.observe(document.documentElement,{childList:true,subtree:true});
  forceFront();
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
