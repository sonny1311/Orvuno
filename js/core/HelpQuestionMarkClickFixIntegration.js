// ORVUNO - robuster globaler Klick-Fix fuer wirklich alle kleinen ?-Hilfeknoepfe.
// Event-Delegation + Pointer-Support, damit dynamische Dialoge und Fire/Silk sicher funktionieren.
const HELP_SELECTOR='.orvuno-help-trigger,#orvuno-context-help-fab,[data-orvuno-help-topic]';
const TOPIC_PATTERNS=[
  ['coinsToMoney',/(coin|coins|münz|muen).{0,30}(firmengeld|betriebs?geld|geld)|(firmengeld|betriebs?geld).{0,30}(coin|coins|münz|muen)/i],
  ['bottling',/abfüll|abfuell|flaschen|filling/i],
  ['customerOrders',/kundenauftrag|kundenaufträge|kundenauftraege|auftragserfüll|auftragserfuell/i],
  ['inbound',/laufende liefer|lieferungen\s*&\s*transporte|wareneingang|einlagern|ankunft/i],
  ['delivery',/ausliefer|liefermenge|lieferung starten|logistik|fracht|versand/i],
  ['procurement',/einkauf|einkaufen|lieferant|bestell|rohstoffe.*verpack/i],
  ['warehouse',/lager|bestand|storage|warehouse/i],
  ['staff',/personal|mitarbeiter|beschäft|beschaeft|workforce|staff/i],
  ['machines',/maschine|anlage|maschinenkauf|maschinenkapaz|equipment/i],
  ['production',/produktion|produktions|rezept|herstell|brauen/i],
  ['market',/markt|handel|marktpreis|trade/i],
  ['finance',/finanz|kredit|darlehen|liquid|zins/i],
  ['expansion',/ausbau|erweiter|grundstück|grundstueck|gebäude|gebaeude/i],
  ['businessSwitch',/betriebswechsel|betrieb wechseln|betriebe verwalten|betriebsportfolio|unternehmen wechseln/i],
  ['premium',/premium/i],['coins',/coin|coins|münz|muen/i],['profile',/spielerprofil|profil|konto|account/i]
];
let lastOpenAt=0,lastButton=null;
const norm=v=>String(v||'').replace(/\s+/g,' ').trim();
function candidate(node){
  if(!node?.closest)return null;
  const direct=node.closest(HELP_SELECTOR);if(direct)return direct;
  const el=node.closest('button,[role="button"],a,span,div');if(!el)return null;
  const text=norm(el.textContent),label=norm(el.getAttribute?.('aria-label')||el.getAttribute?.('title'));
  if(text==='?'||text==='❓'||label==='?'||/^(hilfe|help)(\b|:)/i.test(label))return el;
  return null;
}
function contextText(el){
  const own=norm(el?.dataset?.orvunoHelpContext||el?.getAttribute?.('aria-label')||el?.title);
  const heading=el?.closest?.('h1,h2,h3,h4');if(heading)return `${own} ${norm(heading.textContent)}`;
  const panel=el?.closest?.('section,article,[role="dialog"],[data-world-overlay],.panel,.card,div');
  if(panel){const h=panel.querySelector?.('h1,h2,h3,h4');return `${own} ${norm(h?.textContent)} ${norm(panel.textContent).slice(0,500)}`;}
  return own;
}
function topicFor(el){
  const explicit=el?.dataset?.orvunoHelpTopic;if(explicit)return explicit;
  const hay=contextText(el);for(const [topic,re] of TOPIC_PATTERNS)if(re.test(hay))return topic;
  return window.orvunoHelp?.currentTopic?.()||'overview';
}
function openHelp(el){
  const api=window.orvunoHelp;if(!api||typeof api.open!=='function')return false;
  const now=Date.now();if(lastButton===el&&now-lastOpenAt<500)return true;
  lastButton=el;lastOpenAt=now;api.open(topicFor(el));return true;
}
function consume(event){
  const el=candidate(event.target);if(!el||!openHelp(el))return;
  event.preventDefault?.();event.stopPropagation?.();event.stopImmediatePropagation?.();
}
function keyboard(event){if(event.key!=='Enter'&&event.key!==' ')return;consume(event);}
function markAllQuestionMarks(root=document){
  for(const el of root.querySelectorAll?.('button,[role="button"],a,span,div')||[]){
    if(el.closest?.('.orvuno-help-overlay'))continue;
    const t=norm(el.textContent),label=norm(el.getAttribute?.('aria-label')||el.getAttribute?.('title'));
    if((t==='?'||t==='❓'||label==='?')&&!el.dataset.orvunoQuestionHelp){
      el.dataset.orvunoQuestionHelp='1';el.style.cursor='pointer';
      if(!el.getAttribute?.('aria-label'))el.setAttribute?.('aria-label','Hilfe öffnen');
      if(!el.getAttribute?.('title'))el.setAttribute?.('title','Hilfe öffnen');
    }
  }
}
export function auditQuestionMarks(root=document){
  markAllQuestionMarks(root);const all=[...(root.querySelectorAll?.('button,[role="button"],a,span,div')||[])].filter(el=>{const t=norm(el.textContent),l=norm(el.getAttribute?.('aria-label')||el.getAttribute?.('title'));return t==='?'||t==='❓'||l==='?'||el.matches?.(HELP_SELECTOR);});
  return{count:all.length,unhandled:all.filter(el=>!candidate(el)).length};
}
export function installHelpQuestionMarkClickFix(){
  if(typeof document==='undefined'||window.__orvunoHelpQuestionMarkClickFix)return false;window.__orvunoHelpQuestionMarkClickFix=true;
  document.addEventListener('pointerup',consume,true);document.addEventListener('click',consume,true);document.addEventListener('keydown',keyboard,true);
  const observer=new MutationObserver(records=>{for(const r of records)for(const n of r.addedNodes||[])if(n?.nodeType===1)markAllQuestionMarks(n);});
  const boot=()=>{markAllQuestionMarks(document);observer.observe(document.documentElement,{childList:true,subtree:true});window.orvunoQuestionMarkAudit=()=>auditQuestionMarks(document);};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();return true;
}
if(typeof window!=='undefined')installHelpQuestionMarkClickFix();
