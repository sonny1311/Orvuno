import './CrazyGamesBasicLaunchIntegration.js';

// ORVUNO - neutralisiert unnötige Fremdmarken ausschließlich in spielersichtbaren UI-Texten.
// Technische Provider-IDs, URLs, SKUs, API-Aufrufe und Zahlungslogik bleiben unverändert.

const PLAYER_TEXT_REPLACEMENTS=Object.freeze([
  [/Amazon Appstore/gi,'Appstore'],
  [/Amazon-IAP/gi,'Store-Kauf'],
  [/Amazon IAP/gi,'Store-Kauf'],
  [/Amazon-Kauf/gi,'Store-Kauf'],
  [/Über Amazon kaufen/gi,'Im Appstore kaufen'],
  [/Google Play Billing/gi,'Store-Zahlung'],
  [/Google-Play-App/gi,'App-Version'],
  [/Google Play/gi,'Appstore'],
  [/Stripe Checkout/gi,'Zahlungsseite'],
  [/Stripe-Checkout/gi,'Zahlungsseite'],
  [/PayPal\s*\/\s*Braintree/gi,'Zahlungsanbieter'],
  [/PayPal/gi,'Zahlungsanbieter'],
  [/Braintree/gi,'Zahlungsanbieter'],
  [/Stripe/gi,'Zahlungsanbieter'],
  [/Supabase/gi,'Spielserver'],
  [/Vercel/gi,'Hostingdienst'],
  [/HERE(?: Maps)?/g,'Verkehrsdienst']
]);

const ATTRS=['title','aria-label','placeholder','alt'];
const SKIP_TAGS=new Set(['SCRIPT','STYLE','NOSCRIPT','CODE','PRE']);

function neutralizeText(value){
  let out=String(value??'');
  for(const [pattern,replacement] of PLAYER_TEXT_REPLACEMENTS)out=out.replace(pattern,replacement);
  return out;
}

function neutralizeElement(el){
  if(!(el instanceof Element)||SKIP_TAGS.has(el.tagName))return;
  for(const attr of ATTRS){
    if(!el.hasAttribute(attr))continue;
    const before=el.getAttribute(attr)||'';
    const after=neutralizeText(before);
    if(after!==before)el.setAttribute(attr,after);
  }
}

function neutralizeTree(root=document.body){
  if(!root)return;
  if(root.nodeType===Node.TEXT_NODE){
    const parent=root.parentElement;
    if(!parent||SKIP_TAGS.has(parent.tagName))return;
    const before=root.nodeValue||'';
    const after=neutralizeText(before);
    if(after!==before)root.nodeValue=after;
    return;
  }
  if(root.nodeType!==Node.ELEMENT_NODE&&root.nodeType!==Node.DOCUMENT_FRAGMENT_NODE)return;
  if(root.nodeType===Node.ELEMENT_NODE)neutralizeElement(root);
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_ELEMENT|NodeFilter.SHOW_TEXT);
  let node;
  while((node=walker.nextNode())){
    if(node.nodeType===Node.ELEMENT_NODE){neutralizeElement(node);continue;}
    const parent=node.parentElement;
    if(!parent||SKIP_TAGS.has(parent.tagName))continue;
    const before=node.nodeValue||'';
    const after=neutralizeText(before);
    if(after!==before)node.nodeValue=after;
  }
}

function install(){
  const run=()=>neutralizeTree(document.body);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
  const observer=new MutationObserver(mutations=>{
    for(const mutation of mutations){
      if(mutation.type==='characterData')neutralizeTree(mutation.target);
      for(const node of mutation.addedNodes||[])neutralizeTree(node);
    }
  });
  const start=()=>document.body&&observer.observe(document.body,{childList:true,subtree:true,characterData:true});
  if(document.body)start();else document.addEventListener('DOMContentLoaded',start,{once:true});
  window.worldPlayerFacingBrandNeutralizer={neutralizeText,neutralizeTree};
}

install();
