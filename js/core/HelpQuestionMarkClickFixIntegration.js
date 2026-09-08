// ORVUNO - robuster globaler Klick-Fix fuer alle kleinen ?-Hilfeknoepfe.
// Arbeitet per Event-Delegation, damit auch dynamisch nachgeladene Dialoge auf Fire/Silk funktionieren.
const HELP_SELECTOR='.orvuno-help-trigger,#orvuno-context-help-fab,button[data-orvuno-help-topic]';

function isHelpButton(node){
  const button=node?.closest?.('button');
  if(!button)return null;
  if(button.matches(HELP_SELECTOR))return button;
  const label=String(button.getAttribute('aria-label')||button.title||'').toLowerCase();
  const text=String(button.textContent||'').trim();
  if(text==='?'&&(label.includes('hilfe')||label.includes('help')))return button;
  return null;
}

function topicFor(button){
  return button?.dataset?.orvunoHelpTopic||window.orvunoHelp?.currentTopic?.()||'overview';
}

function open(button){
  const api=window.orvunoHelp;
  if(!api||typeof api.open!=='function')return false;
  api.open(topicFor(button));
  return true;
}

function handler(event){
  const button=isHelpButton(event.target);
  if(!button)return;
  if(!open(button))return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation?.();
}

function keyboardHandler(event){
  if(event.key!=='Enter'&&event.key!==' ')return;
  const button=isHelpButton(event.target);
  if(!button)return;
  if(!open(button))return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation?.();
}

export function installHelpQuestionMarkClickFix(){
  if(typeof document==='undefined'||window.__orvunoHelpQuestionMarkClickFix)return false;
  window.__orvunoHelpQuestionMarkClickFix=true;
  // Capture-Phase ist absichtlich: manche Dialoge stoppen Bubbling-Klicks auf Fire/Silk.
  document.addEventListener('click',handler,true);
  document.addEventListener('keydown',keyboardHandler,true);
  return true;
}

if(typeof window!=='undefined')installHelpQuestionMarkClickFix();
