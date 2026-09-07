// ORVUNO – Hilfe und Rechtliches gehoeren in den Footer, nicht in die Hauptnavigation.
const PRIVACY_URL='/datenschutz.html';
const ACCOUNT_DELETION_URL='/konto-loeschen.html';

function removeTopLinks(){
  document.getElementById('world-help-button')?.remove();
  document.getElementById('world-legal-button')?.remove();
}
function open(section){
  const hub=window.worldPlayerInfoHub;
  if(!hub?.open)return;
  hub.open(section);
}
function externalFooterLink(label,href){
  const a=document.createElement('a');a.textContent=label;a.href=href;a.target='_blank';a.rel='noopener noreferrer';a.dataset.footerLink=label;
  Object.assign(a.style,{border:'0',background:'transparent',color:'#9eacc0',padding:'2px 4px',cursor:'pointer',fontSize:'12px',textDecoration:'none',fontFamily:'inherit'});
  a.onmouseenter=()=>a.style.color='#fff';a.onmouseleave=()=>a.style.color='#9eacc0';return a;
}
function footerItem(label,section){
  const common={border:'0',background:'transparent',color:'#9eacc0',padding:'2px 4px',cursor:'pointer',fontSize:'12px',textDecoration:'none',fontFamily:'inherit'};
  if(section==='privacy')return externalFooterLink(label,PRIVACY_URL);
  if(section==='accountDeletion')return externalFooterLink(label,ACCOUNT_DELETION_URL);
  const b=document.createElement('button');b.type='button';b.textContent=label;b.dataset.footerLink=label;Object.assign(b.style,common);
  b.onmouseenter=()=>b.style.color='#fff';b.onmouseleave=()=>b.style.color='#9eacc0';b.onclick=()=>open(section);return b;
}
function mountFooter(){
  removeTopLinks();
  let footer=document.getElementById('orvuno-footer');
  if(footer)return footer;
  footer=document.createElement('footer');footer.id='orvuno-footer';
  Object.assign(footer.style,{position:'fixed',left:'0',right:'0',bottom:'0',zIndex:'9000',display:'flex',justifyContent:'center',alignItems:'center',gap:'18px',flexWrap:'wrap',padding:'7px 16px',background:'rgba(5,11,20,.94)',borderTop:'1px solid #1d2b40',fontFamily:'Arial,sans-serif',fontSize:'12px',color:'#8291a6'});
  const items=[['Hilfe','help'],['Impressum','legal'],['Datenschutz','privacy'],['Konto löschen','accountDeletion'],['AGB','legal']];
  for(const [label,section] of items)footer.append(footerItem(label,section));
  document.body.append(footer);return footer;
}
function install(){
  mountFooter();
  // Der Info-Hub kann spaeter mounten und seine alten Buttons erneut anlegen.
  // Deshalb entfernen wir genau diese beiden Links auch nach UI-Aenderungen.
  new MutationObserver(()=>removeTopLinks()).observe(document.documentElement,{childList:true,subtree:true});
}
if(typeof window!=='undefined'){
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
}
export {mountFooter,removeTopLinks};
