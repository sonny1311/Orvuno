// ORVUNO – vereinfachte Hauptnavigation für den geschlossenen Test.
// Die bestehende Spiellogik bleibt unverändert. Vorhandene Navigationsbuttons
// werden in wenige verständliche Hauptbereiche gruppiert und weiterhin benutzt.

const NAV_ID='world-main-nav';
const ROOT_ID='orvuno-simple-main-nav';
const MENU_ID='orvuno-simple-nav-menu';

const GROUPS=[
  {id:'overview',label:'🏠 Übersicht',match:/übersicht|dashboard|home|nachricht|statistik|ereignis/i},
  {id:'production',label:'🏭 Produktion',match:/produktion|abfüll|lager|personal|mitarbeiter|maschine/i},
  {id:'supply',label:'📦 Einkauf & Logistik',match:/einkauf|lieferant|bestell|wareneingang|lieferung|logistik|verkehr/i},
  {id:'sales',label:'🛒 Verkauf',match:/kunden|auftrag|markt|verkauf/i},
  {id:'company',label:'🏢 Unternehmen',match:/betrieb|fuhrpark|finanz|ausbau|gebäude|grundstück|premium|coin|vertrag|spielerzentrum/i}
];

function textOf(el){return String(el?.textContent||'').replace(/\s+/g,' ').trim();}
function isOwn(el){return el?.closest?.(`#${ROOT_ID}`)||el?.closest?.(`#${MENU_ID}`);}
function legacyButtons(nav){
  return [...nav.querySelectorAll(':scope > button')].filter(b=>!isOwn(b));
}
function categoryFor(button){
  const text=textOf(button);
  return GROUPS.find(group=>group.match.test(text))?.id||'more';
}
function closeMenu(){document.getElementById(MENU_ID)?.remove();}
function visibleLegacy(button){
  if(!button||button.disabled)return false;
  const style=getComputedStyle(button);
  return style.display!=='none'&&style.visibility!=='hidden';
}
function groupedButtons(nav,id){
  return legacyButtons(nav).filter(b=>categoryFor(b)===id);
}
function activate(button){
  closeMenu();
  button?.click?.();
}
function openGroup(nav,group,anchor){
  closeMenu();
  const targets=groupedButtons(nav,group.id);
  if(targets.length===1){activate(targets[0]);return;}
  const menu=document.createElement('div');menu.id=MENU_ID;
  Object.assign(menu.style,{position:'fixed',zIndex:'99980',minWidth:'240px',maxWidth:'min(92vw,360px)',padding:'10px',border:'1px solid #334155',borderRadius:'14px',background:'#0b1524',boxShadow:'0 20px 60px rgba(0,0,0,.5)',display:'grid',gap:'7px'});
  const rect=anchor.getBoundingClientRect();
  menu.style.left=`${Math.max(10,Math.min(rect.left,window.innerWidth-370))}px`;
  menu.style.top=`${Math.min(window.innerHeight-80,rect.bottom+8)}px`;
  if(menu.getBoundingClientRect().bottom>window.innerHeight-10){menu.style.top='auto';menu.style.bottom=`${Math.max(10,window.innerHeight-rect.top+8)}px`;}
  const title=document.createElement('div');title.textContent=group.label;Object.assign(title.style,{padding:'4px 6px 8px',fontWeight:'900',color:'#f8fafc'});menu.append(title);
  for(const target of targets){
    const b=document.createElement('button');b.type='button';b.textContent=textOf(target)||'Öffnen';
    Object.assign(b.style,{width:'100%',textAlign:'left',padding:'11px 12px',border:'1px solid #334155',borderRadius:'9px',background:'#142033',color:'#f8fafc',fontWeight:'750',cursor:'pointer'});
    b.onclick=()=>activate(target);menu.append(b);
  }
  if(!targets.length){
    const empty=document.createElement('div');empty.textContent='Für diesen Bereich ist aktuell keine Aktion verfügbar.';Object.assign(empty.style,{padding:'10px',color:'#94a3b8',lineHeight:'1.4'});menu.append(empty);
  }
  document.body.append(menu);
}
function createGroupButton(nav,group){
  const b=document.createElement('button');b.type='button';b.dataset.orvunoSimpleNav=group.id;b.textContent=group.label;
  Object.assign(b.style,{position:'static',flex:'1 1 150px',minWidth:'135px',whiteSpace:'nowrap',border:'1px solid #3b4b62',borderRadius:'11px',padding:'11px 14px',fontWeight:'900',cursor:'pointer',pointerEvents:'auto',background:'#101a2b',color:'#f8fafc',boxShadow:'0 5px 18px rgba(0,0,0,.22)'});
  b.onclick=()=>openGroup(nav,group,b);return b;
}
function mount(){
  const nav=document.getElementById(NAV_ID);if(!nav)return false;
  let root=document.getElementById(ROOT_ID);
  if(!root){
    root=document.createElement('div');root.id=ROOT_ID;
    Object.assign(root.style,{display:'flex',flexWrap:'wrap',gap:'9px',width:'100%',alignItems:'stretch'});
    for(const group of GROUPS)root.append(createGroupButton(nav,group));
    const more=createGroupButton(nav,{id:'more',label:'••• Mehr'});more.dataset.orvunoSimpleMore='1';root.append(more);
    nav.prepend(root);
  }
  const buttons=legacyButtons(nav);
  for(const button of buttons){
    if(!button.dataset.orvunoLegacyDisplay)button.dataset.orvunoLegacyDisplay=button.style.display||'';
    button.style.setProperty('display','none','important');
  }
  const more=root.querySelector('[data-orvuno-simple-more]');
  if(more)more.style.display=groupedButtons(nav,'more').length?'':'none';
  nav.dataset.orvunoSimplified='1';
  return true;
}
function restore(){
  const nav=document.getElementById(NAV_ID);if(!nav)return false;
  for(const button of legacyButtons(nav)){
    button.style.removeProperty('display');
    if(button.dataset.orvunoLegacyDisplay)button.style.display=button.dataset.orvunoLegacyDisplay;
  }
  document.getElementById(ROOT_ID)?.remove();closeMenu();delete nav.dataset.orvunoSimplified;return true;
}
function schedule(){requestAnimationFrame(mount);setTimeout(mount,80);}

export function installSimplifiedMainNavigation(){
  if(typeof document==='undefined')return false;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
  const observer=new MutationObserver(records=>{
    if(records.some(r=>[...r.addedNodes].some(n=>n?.id===NAV_ID||n?.querySelector?.(`#${NAV_ID}`)||n?.closest?.(`#${NAV_ID}`))))schedule();
  });
  observer.observe(document.documentElement,{childList:true,subtree:true});
  for(const ev of ['world:access-granted','worldproject:company-loaded','worldproject:company-switched'])window.addEventListener(ev,schedule);
  document.addEventListener('click',event=>{if(!event.target?.closest?.(`#${MENU_ID},#${ROOT_ID}`))closeMenu();},true);
  window.orvunoSimplifiedNavigation={mount,restore};
  return true;
}

if(typeof window!=='undefined')installSimplifiedMainNavigation();
