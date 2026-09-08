// ORVUNO - CrazyGames Basic-Launch-Anpassung.
// Ziel: Gastzugang ohne externen Login, keine Echtgeldkaeufe/Rewarded Ads im Basic Launch.
import { GameIdAccessDialog } from './GameIdAccess.js';

const params=new URLSearchParams(location.search);
const active=params.get('source')==='crazygames'||params.get('crazygames')==='1'||params.get('platform')==='crazygames';
window.orvunoCrazyGames={active,basicLaunch:active};

if(active){
  document.documentElement.dataset.orvunoCrazyGames='1';

  // CrazyGames Basic Launch: keine Echtgeldangebote und keine externen Werbe-Buttons anzeigen.
  const hideRestrictedUi=()=>{
    for(const selector of [
      '#world-premium-button','[data-coin-offer]','[data-premium-offer]',
      '[data-world-home-ad-widget]','[data-world-time-ad-widget]','[data-world-time-ad-control]'
    ]) document.querySelectorAll(selector).forEach(el=>{el.style.setProperty('display','none','important');});
    const account=document.getElementById('world-account-button');
    if(account){account.textContent='👤 Gast';account.onclick=null;account.style.setProperty('display','none','important');}
  };
  const observe=()=>{
    hideRestrictedUi();
    const observer=new MutationObserver(hideRestrictedUi);
    observer.observe(document.documentElement,{childList:true,subtree:true});
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',observe,{once:true});else observe();

  // Im Basic Launch darf der Spieler ohne eigenen Login/Benutzernamen als Gast starten.
  // Lediglich die Datenschutzerklaerung wird vor dem erstmaligen Anlegen des anonymen Backend-Gasts bestaetigt.
  GameIdAccessDialog.prototype.open=function(){
    if(this.overlay)return;
    const overlay=this.el('div');this.overlay=overlay;
    Object.assign(overlay.style,{position:'fixed',inset:'0',zIndex:'30000',display:'flex',alignItems:'center',justifyContent:'center',padding:'22px',boxSizing:'border-box',overflow:'auto',background:'radial-gradient(circle at 50% 15%,#17263d 0,#07101d 48%,#03070c 100%)',fontFamily:'Arial,sans-serif',color:'#fff'});
    const panel=this.el('section');Object.assign(panel.style,{width:'min(560px,96vw)',padding:'30px',boxSizing:'border-box',border:'1px solid #394457',borderRadius:'20px',background:'#0c1422',boxShadow:'0 24px 80px rgba(0,0,0,.55)'});
    const logo=this.el('div','ORVUNO');Object.assign(logo.style,{fontSize:'34px',fontWeight:'900',letterSpacing:'3px',textAlign:'center'});
    const sub=this.el('div','Direkt als Gast spielen. Dein Fortschritt wird automatisch gespeichert.');Object.assign(sub.style,{textAlign:'center',color:'#b8c2d2',margin:'8px 0 22px',fontSize:'16px'});
    const privacyRow=this.el('label');Object.assign(privacyRow.style,{display:'flex',alignItems:'flex-start',gap:'10px',padding:'12px',border:'1px solid #39475d',borderRadius:'10px',background:'#0f1929',fontSize:'14px',lineHeight:'1.45',cursor:'pointer'});
    const privacyBox=this.el('input');privacyBox.type='checkbox';privacyBox.required=true;Object.assign(privacyBox.style,{marginTop:'3px',width:'18px',height:'18px',flex:'0 0 auto'});
    const privacyText=this.el('span');privacyText.append(document.createTextNode('Ich habe die '));
    const privacyLink=this.el('button','Datenschutzerklärung');privacyLink.type='button';Object.assign(privacyLink.style,{padding:'0',border:'0',background:'transparent',color:'#8db5ff',font:'inherit',fontWeight:'800',textDecoration:'underline',cursor:'pointer'});privacyLink.onclick=e=>{e.preventDefault();e.stopPropagation();this.openPrivacy();};
    privacyText.append(privacyLink,document.createTextNode(' zur Kenntnis genommen.'));privacyRow.append(privacyBox,privacyText);
    const start=this.el('button','Als Gast spielen');start.type='button';start.disabled=true;Object.assign(start.style,{width:'100%',marginTop:'13px',padding:'14px 16px',border:'1px solid #4b78ff',borderRadius:'11px',background:'#3868ee',color:'#fff',fontSize:'17px',fontWeight:'800',cursor:'not-allowed',opacity:'.45'});
    const status=this.el('div','');Object.assign(status.style,{minHeight:'20px',marginTop:'8px',textAlign:'center',fontWeight:'700'});
    privacyBox.addEventListener('change',()=>{start.disabled=!privacyBox.checked;start.style.opacity=privacyBox.checked?'1':'.45';start.style.cursor=privacyBox.checked?'pointer':'not-allowed';});
    const guestName=()=>{try{const key='orvuno.crazygames.guestName',old=localStorage.getItem(key);if(old)return old;const bytes=new Uint8Array(5);crypto.getRandomValues(bytes);const name='Gast-'+[...bytes].map(v=>v.toString(16).padStart(2,'0')).join('').toUpperCase();localStorage.setItem(key,name);return name;}catch{return 'Gast-'+Date.now().toString(36).slice(-8);}};
    start.onclick=()=>this.run(start,()=>this.client.createPlayer({username:guestName(),privacyAccepted:privacyBox.checked}),status,'Gast wird vorbereitet …');
    panel.append(logo,sub,privacyRow,start,status);overlay.append(panel);this.parent.append(overlay);
  };

  window.addEventListener('world:access-granted',()=>{
    hideRestrictedUi();
    try{window.parent?.postMessage({type:'orvuno:crazygames-ready'},'*');}catch{}
  });
}
