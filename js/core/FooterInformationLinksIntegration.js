// ORVUNO – öffentliche Spielinformationen und Rechtliches bleiben erreichbar,
// ohne im Spiel dauerhaft Inhalte zu verdecken.
const PUBLIC_URLS=Object.freeze({
  nadena:'https://www.nadena-games.de/',
  nadenaHub:'https://www.nadena-games.de/browsergame-ratgeber.html',
  hofhain:'https://www.hofhain.de/ueber-hofhain.html',
  futnaro:'https://www.futnaro.de/hilfe.html',
  astrawelle:'https://www.astrawelle.de/spielinfo/',
  guide:'/spielanleitung.html',
  strategy:'/wirtschaftssimulation-tipps.html',
  productionLogistics:'/produktion-logistik.html',
  faq:'/faq.html',
  updates:'/aktuelles.html',
  imprint:'/impressum.html',
  privacy:'/datenschutz.html',
  accountDeletion:'/konto-loeschen.html'
});
const ORVUNO_URL='https://www.orvuno.de/';
const ORVUNO_TITLE='ORVUNO – Wirtschaftssimulation, Produktion & Handel';
const ORVUNO_DESCRIPTION='ORVUNO ist eine Wirtschaftssimulation im Browser: Führe Betriebe, plane Einkauf, Lager und Personal, produziere, liefere, handle und expandiere.';
const NADENA_LOGO='https://www.nadena-games.de/assets/nadena-games-logo.jpg';
const SOCIAL_IMAGE='https://www.nadena-games.de/assets/orvuno.webp';

function ensureSeoMeta(){
  const head=document.head;if(!head)return;
  const meta=(name,content)=>{let el=head.querySelector(`meta[name="${name}"]`);if(!el){el=document.createElement('meta');el.name=name;head.append(el);}el.content=content;};
  const prop=(name,content)=>{let el=head.querySelector(`meta[property="${name}"]`);if(!el){el=document.createElement('meta');el.setAttribute('property',name);head.append(el);}el.setAttribute('content',content);};
  let canonical=head.querySelector('link[rel="canonical"]');if(!canonical){canonical=document.createElement('link');canonical.rel='canonical';head.append(canonical);}canonical.href=ORVUNO_URL;
  document.title=ORVUNO_TITLE;
  meta('description',ORVUNO_DESCRIPTION);
  meta('robots','index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1');
  meta('googlebot','index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1');
  prop('og:type','website');prop('og:locale','de_DE');prop('og:site_name','ORVUNO');prop('og:title',ORVUNO_TITLE);prop('og:description',ORVUNO_DESCRIPTION);prop('og:url',ORVUNO_URL);prop('og:image',SOCIAL_IMAGE);prop('og:image:alt','ORVUNO Wirtschaftssimulation von Nadena Games');
  meta('twitter:card','summary_large_image');meta('twitter:title','ORVUNO – Wirtschaftssimulation im Browser');meta('twitter:description',ORVUNO_DESCRIPTION);meta('twitter:image',SOCIAL_IMAGE);
  let schema=head.querySelector('#orvuno-seo-schema');if(!schema){schema=document.createElement('script');schema.id='orvuno-seo-schema';schema.type='application/ld+json';head.append(schema);}
  schema.textContent=JSON.stringify({
    '@context':'https://schema.org','@graph':[
      {'@type':'VideoGame','@id':'https://www.orvuno.de/#game',name:'ORVUNO',url:ORVUNO_URL,image:SOCIAL_IMAGE,description:ORVUNO_DESCRIPTION,inLanguage:'de-DE',genre:['Wirtschaftssimulation','Managementspiel','Aufbauspiel'],gamePlatform:'Web browser',isAccessibleForFree:true,publisher:{'@type':'Organization',name:'Nadena Games',url:'https://www.nadena-games.de/',logo:NADENA_LOGO}},
      {'@type':'FAQPage','@id':'https://www.orvuno.de/#faq',mainEntity:[
        {'@type':'Question',name:'Was ist ORVUNO?',acceptedAnswer:{'@type':'Answer',text:'ORVUNO ist eine fortlaufende Wirtschaftssimulation im Browser. Du führst einen Betrieb und verbindest Einkauf, Lieferungen, Lager, Personal, Maschinen, Produktion, Kundenaufträge, Logistik und Finanzen zu einem funktionierenden Unternehmen.'}},
        {'@type':'Question',name:'Was macht man in ORVUNO?',acceptedAnswer:{'@type':'Answer',text:'Du planst Einkauf und Lager, beschäftigst Personal, nutzt Maschinen, produzierst Waren, erfüllst Kundenaufträge, organisierst Lieferungen und investierst Gewinne in mehr Kapazität und weitere Betriebe.'}},
        {'@type':'Question',name:'Ist ORVUNO ein Browsergame?',acceptedAnswer:{'@type':'Answer',text:'Ja. ORVUNO läuft direkt im Browser und wird als Wirtschaftssimulation und Managementspiel von Nadena Games weiterentwickelt.'}}
      ]}
    ]
  });
}

function removeTopLinks(){
  document.getElementById('world-help-button')?.remove();
  document.getElementById('world-legal-button')?.remove();
}
function open(section){
  const hub=window.worldPlayerInfoHub;
  if(!hub?.open)return;
  hub.open(section);
}
function externalLink(label,href){
  const a=document.createElement('a');a.textContent=label;a.href=href;a.target='_blank';a.rel='noopener noreferrer';a.dataset.footerLink=label;
  Object.assign(a.style,{border:'0',background:'transparent',color:'#9eacc0',padding:'5px 6px',cursor:'pointer',fontSize:'12px',textDecoration:'none',fontFamily:'inherit',display:'block'});
  a.onmouseenter=()=>a.style.color='#fff';a.onmouseleave=()=>a.style.color='#9eacc0';return a;
}
function nadenaBrandLink(){
  const a=document.createElement('a');a.href=PUBLIC_URLS.nadena;a.target='_blank';a.rel='noopener noreferrer';a.dataset.footerLink='Nadena Games';a.setAttribute('aria-label','Nadena Games öffnen');
  Object.assign(a.style,{display:'inline-flex',alignItems:'center',gap:'7px',border:'0',background:'transparent',color:'#c8d5e6',padding:'4px 6px',fontSize:'12px',fontWeight:'800',textDecoration:'none',fontFamily:'inherit'});
  const img=document.createElement('img');img.src=NADENA_LOGO;img.alt='Nadena Games';img.width=26;img.height=26;img.loading='lazy';img.decoding='async';Object.assign(img.style,{width:'26px',height:'26px',borderRadius:'7px',flex:'0 0 26px'});
  const span=document.createElement('span');span.textContent='Nadena Games';a.append(img,span);a.onmouseenter=()=>a.style.color='#fff';a.onmouseleave=()=>a.style.color='#c8d5e6';return a;
}
function footerItem(label,section){
  if(PUBLIC_URLS[section])return externalLink(label,PUBLIC_URLS[section]);
  const b=document.createElement('button');b.type='button';b.textContent=label;b.dataset.footerLink=label;
  Object.assign(b.style,{border:'0',background:'transparent',color:'#9eacc0',padding:'5px 6px',cursor:'pointer',fontSize:'12px',textDecoration:'none',fontFamily:'inherit',display:'block',width:'100%',textAlign:'left'});
  b.onmouseenter=()=>b.style.color='#fff';b.onmouseleave=()=>b.style.color='#9eacc0';b.onclick=()=>open(section);return b;
}
const ITEMS=[['Hilfe','help'],['Spielanleitung','guide'],['Strategie-Tipps','strategy'],['Produktion & Logistik','productionLogistics'],['FAQ','faq'],['Aktuelles','updates'],['Impressum','imprint'],['Datenschutz','privacy'],['Konto löschen','accountDeletion'],['AGB','legal']];
const PUBLIC_NETWORK_ITEMS=[['Nadena Browsergame-Ratgeber','nadenaHub'],['Hofhain – Bauernhofspiel','hofhain'],['Futnaro – Online Fußballmanager','futnaro'],['AstraWelle – Weltraum-Aufbauspiel','astrawelle']];

function stylePublicFooter(footer){
  Object.assign(footer.style,{position:'relative',left:'auto',right:'auto',bottom:'auto',zIndex:'1',display:'flex',justifyContent:'center',alignItems:'center',gap:'14px',flexWrap:'wrap',padding:'9px 16px',marginTop:'18px',background:'rgba(5,11,20,.94)',borderTop:'1px solid #1d2b40',fontFamily:'Arial,sans-serif',fontSize:'12px',color:'#8291a6',width:'100%',boxSizing:'border-box'});
  footer.append(nadenaBrandLink());
  for(const [label,section] of ITEMS)footer.append(footerItem(label,section));
  for(const [label,section] of PUBLIC_NETWORK_ITEMS)footer.append(footerItem(label,section));
}

function styleAppFooter(footer){
  Object.assign(footer.style,{position:'fixed',left:'8px',right:'auto',bottom:'calc(92px + env(safe-area-inset-bottom, 0px))',zIndex:'8990',display:'block',padding:'0',margin:'0',background:'transparent',border:'0',fontFamily:'Arial,sans-serif',fontSize:'12px',color:'#8291a6',width:'auto'});
  const toggle=document.createElement('button');
  toggle.type='button';toggle.textContent='ℹ Info';toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-label','Informationen und Rechtliches öffnen');
  Object.assign(toggle.style,{border:'1px solid #31445e',borderRadius:'999px',background:'rgba(8,18,32,.94)',color:'#aab8cb',padding:'7px 10px',fontSize:'11px',fontWeight:'800',cursor:'pointer',boxShadow:'0 5px 18px rgba(0,0,0,.28)'});
  const panel=document.createElement('div');panel.hidden=true;
  Object.assign(panel.style,{position:'absolute',left:'0',bottom:'38px',width:'min(280px,calc(100vw - 16px))',maxHeight:'55vh',overflow:'auto',padding:'8px',border:'1px solid #2d405b',borderRadius:'12px',background:'rgba(5,11,20,.98)',boxShadow:'0 14px 40px rgba(0,0,0,.5)'});
  panel.append(nadenaBrandLink());
  for(const [label,section] of ITEMS)panel.append(footerItem(label,section));
  toggle.onclick=e=>{e.preventDefault();e.stopPropagation();panel.hidden=!panel.hidden;toggle.setAttribute('aria-expanded',panel.hidden?'false':'true');};
  footer.append(toggle,panel);
}

function mountFooter(){
  removeTopLinks();
  let footer=document.getElementById('orvuno-footer');
  if(!footer){footer=document.createElement('footer');footer.id='orvuno-footer';document.body.append(footer);}
  const mode=document.documentElement.classList.contains('orvuno-authenticated')?'app':'public';
  if(footer.dataset.mode===mode)return footer;
  footer.dataset.mode=mode;footer.replaceChildren();
  if(mode==='app')styleAppFooter(footer);else stylePublicFooter(footer);
  return footer;
}
function mountPublicPlayerTips(){
  if(document.documentElement.classList.contains('orvuno-authenticated'))return;
  const root=document.getElementById('orvuno-public-context');
  if(!root||root.querySelector('[data-orvuno-player-tips="1"]'))return;
  const section=document.createElement('section');section.dataset.orvunoPlayerTips='1';section.className='public-section';section.setAttribute('aria-labelledby','orvuno-player-tips-title');
  section.innerHTML='<h2 id="orvuno-player-tips-title">Praktische Tipps für einen stabilen Betrieb</h2><p>ORVUNO belohnt nicht den größten Einkauf oder die größte Maschine, sondern eine Lieferkette, die zusammenpasst. Diese Regeln vermeiden besonders am Anfang unnötig gebundenes Kapital und Produktionsstillstand.</p><div class="public-grid" style="margin:18px 0 0"><article><h2>💶 Liquidität schützen</h2><p>Gib nicht das gesamte Betriebsgeld für Rohstoffe oder Ausbau aus. Halte eine Reserve für Personal, Produktion, Logistik und unerwartete Engpässe frei.</p></article><article><h2>📦 Lager mit Reserve planen</h2><p>Ein komplett volles Lager kann Wareneingang und fertige Produktion gleichzeitig blockieren. Freier Platz ist deshalb ein echter Teil deiner Produktionskapazität.</p></article><article><h2>🏭 Engpass statt Größe</h2><p>Kaufe eine größere Maschine erst, wenn wirklich die Maschine bremst. Fehlen Rohstoffe, Personal, Lager oder Nachfrage, löst mehr Technik das Problem nicht.</p></article><article><h2>📋 Vom Auftrag rückwärts denken</h2><p>Prüfe zuerst Produkt, Menge und Lieferfrist. Rechne dann zurück, wann Material bestellt, produziert, abgefüllt und ausgeliefert werden muss.</p></article></div>';
  const flow=root.querySelector('.public-section');
  if(flow)flow.insertAdjacentElement('afterend',section);else root.append(section);
}
function mountAuthPublicLinks(){
  if(document.documentElement.classList.contains('orvuno-authenticated'))return;
  const heading=[...document.querySelectorAll('h1')].find(h=>/anmelden|registrieren|sign in|register/i.test(String(h.textContent||'')));
  if(!heading)return;const panel=heading.closest('section')||heading.parentElement;if(!panel||panel.querySelector('[data-orvuno-public-links="1"]'))return;
  const nav=document.createElement('nav');nav.dataset.orvunoPublicLinks='1';nav.setAttribute('aria-label','ORVUNO Informationen');
  Object.assign(nav.style,{display:'flex',gap:'10px',flexWrap:'wrap',justifyContent:'center',marginTop:'18px',paddingTop:'14px',borderTop:'1px solid #2b3a50',fontFamily:'Arial,sans-serif'});
  for(const [label,href] of [['Spielanleitung',PUBLIC_URLS.guide],['Strategie-Tipps',PUBLIC_URLS.strategy],['Produktion & Logistik',PUBLIC_URLS.productionLogistics],['FAQ',PUBLIC_URLS.faq],['Aktuelles',PUBLIC_URLS.updates],['Nadena Browsergame-Ratgeber',PUBLIC_URLS.nadenaHub],['Datenschutz',PUBLIC_URLS.privacy],['Impressum',PUBLIC_URLS.imprint]]){
    const a=document.createElement('a');a.textContent=label;a.href=href;a.target='_blank';a.rel='noopener noreferrer';
    Object.assign(a.style,{color:'#9cc0ff',fontSize:'13px',fontWeight:'700',textDecoration:'underline',textUnderlineOffset:'3px'});nav.append(a);
  }
  const hint=document.createElement('div');hint.textContent='Noch unsicher? Spielanleitung und Ratgeber erklären den Wirtschaftskreislauf auch vor der Anmeldung.';
  Object.assign(hint.style,{width:'100%',marginTop:'4px',color:'#8fa0b7',fontSize:'12px',lineHeight:'1.45',textAlign:'center'});nav.append(hint);panel.append(nav);
}
function install(){
  ensureSeoMeta();mountFooter();mountPublicPlayerTips();mountAuthPublicLinks();
  const observer=new MutationObserver(()=>{mountFooter();mountPublicPlayerTips();mountAuthPublicLinks();});observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
  const closePanel=e=>{const footer=document.getElementById('orvuno-footer');if(!footer||footer.contains(e.target))return;const panel=footer.querySelector('div');const toggle=footer.querySelector('button[aria-expanded]');if(panel&&!panel.hidden){panel.hidden=true;toggle?.setAttribute('aria-expanded','false');}};
  document.addEventListener('click',closePanel);
  window.addEventListener('pageshow',()=>{ensureSeoMeta();mountPublicPlayerTips();});
  window.addEventListener('beforeunload',()=>{observer.disconnect();document.removeEventListener('click',closePanel);},{once:true});
}
if(typeof window!=='undefined'){
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
}
export {mountFooter,removeTopLinks,mountPublicPlayerTips,mountAuthPublicLinks,PUBLIC_URLS,ensureSeoMeta};