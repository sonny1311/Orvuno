// ORVUNO – öffentliche Spielinformationen und Rechtliches bleiben jederzeit erreichbar.
const PUBLIC_URLS=Object.freeze({
  guide:'/spielanleitung.html',
  faq:'/faq.html',
  updates:'/aktuelles.html',
  imprint:'/impressum.html',
  privacy:'/datenschutz.html',
  accountDeletion:'/konto-loeschen.html'
});

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
  Object.assign(a.style,{border:'0',background:'transparent',color:'#9eacc0',padding:'2px 4px',cursor:'pointer',fontSize:'12px',textDecoration:'none',fontFamily:'inherit'});
  a.onmouseenter=()=>a.style.color='#fff';a.onmouseleave=()=>a.style.color='#9eacc0';return a;
}
function footerItem(label,section){
  if(PUBLIC_URLS[section])return externalLink(label,PUBLIC_URLS[section]);
  const b=document.createElement('button');b.type='button';b.textContent=label;b.dataset.footerLink=label;
  Object.assign(b.style,{border:'0',background:'transparent',color:'#9eacc0',padding:'2px 4px',cursor:'pointer',fontSize:'12px',textDecoration:'none',fontFamily:'inherit'});
  b.onmouseenter=()=>b.style.color='#fff';b.onmouseleave=()=>b.style.color='#9eacc0';b.onclick=()=>open(section);return b;
}
function mountFooter(){
  removeTopLinks();
  let footer=document.getElementById('orvuno-footer');
  if(footer)return footer;
  footer=document.createElement('footer');footer.id='orvuno-footer';
  Object.assign(footer.style,{position:'fixed',left:'0',right:'0',bottom:'0',zIndex:'9000',display:'flex',justifyContent:'center',alignItems:'center',gap:'14px',flexWrap:'wrap',padding:'7px 16px',background:'rgba(5,11,20,.94)',borderTop:'1px solid #1d2b40',fontFamily:'Arial,sans-serif',fontSize:'12px',color:'#8291a6'});
  const items=[['Hilfe','help'],['Spielanleitung','guide'],['FAQ','faq'],['Aktuelles','updates'],['Impressum','imprint'],['Datenschutz','privacy'],['Konto löschen','accountDeletion'],['AGB','legal']];
  for(const [label,section] of items)footer.append(footerItem(label,section));
  document.body.append(footer);return footer;
}
function mountAuthPublicLinks(){
  if(document.documentElement.classList.contains('orvuno-authenticated'))return;
  const heading=[...document.querySelectorAll('h1')].find(h=>/anmelden|registrieren|sign in|register/i.test(String(h.textContent||'')));
  if(!heading)return;const panel=heading.closest('section')||heading.parentElement;if(!panel||panel.querySelector('[data-orvuno-public-links="1"]'))return;
  const nav=document.createElement('nav');nav.dataset.orvunoPublicLinks='1';nav.setAttribute('aria-label','ORVUNO Informationen');
  Object.assign(nav.style,{display:'flex',gap:'10px',flexWrap:'wrap',justifyContent:'center',marginTop:'18px',paddingTop:'14px',borderTop:'1px solid #2b3a50',fontFamily:'Arial,sans-serif'});
  for(const [label,href] of [['Spielanleitung',PUBLIC_URLS.guide],['FAQ',PUBLIC_URLS.faq],['Aktuelles',PUBLIC_URLS.updates],['Datenschutz',PUBLIC_URLS.privacy],['Impressum',PUBLIC_URLS.imprint]]){
    const a=document.createElement('a');a.textContent=label;a.href=href;a.target='_blank';a.rel='noopener noreferrer';
    Object.assign(a.style,{color:'#9cc0ff',fontSize:'13px',fontWeight:'700',textDecoration:'underline',textUnderlineOffset:'3px'});nav.append(a);
  }
  const hint=document.createElement('div');hint.textContent='Noch unsicher? Spielanleitung und FAQ erklären den kompletten Wirtschaftskreislauf auch vor der Anmeldung.';
  Object.assign(hint.style,{width:'100%',marginTop:'4px',color:'#8fa0b7',fontSize:'12px',lineHeight:'1.45',textAlign:'center'});nav.append(hint);panel.append(nav);
}
function install(){
  mountFooter();mountAuthPublicLinks();
  const observer=new MutationObserver(()=>{removeTopLinks();mountAuthPublicLinks();});observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
  window.addEventListener('beforeunload',()=>observer.disconnect(),{once:true});
}
if(typeof window!=='undefined'){
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
}
export {mountFooter,removeTopLinks,mountAuthPublicLinks,PUBLIC_URLS};
