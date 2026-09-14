// ORVUNO – wartet auf die vorhandene Hauptnavigation und hängt die neuen Spielerzentrale-Buttons stabil ein.
import './NadenaAdminMessagingIntegration.js';

function add(id,text,section){
  const nav=document.getElementById('world-main-nav');if(!nav||document.getElementById(id))return false;
  const b=document.createElement('button');b.id=id;b.textContent=text;
  Object.assign(b.style,{position:'static',flex:'0 0 auto',whiteSpace:'nowrap',border:'1px solid #32445e',borderRadius:'10px',padding:'12px 16px',fontWeight:'800',cursor:'pointer',boxShadow:'0 5px 18px rgba(0,0,0,.35)',pointerEvents:'auto',background:'#101a2b',color:'#edf3ff'});
  b.onclick=()=>window.worldPlayerInfoHub?.open?.(section);nav.append(b);return true;
}
function mount(){
  const nav=document.getElementById('world-main-nav');if(!nav)return false;
  add('world-messages-button','💬 Nachrichten','messages');
  add('world-statistics-button','📊 Statistik','stats');
  add('world-help-button','❓ Hilfe','help');
  add('world-legal-button','⚖ Rechtliches','legal');
  window.worldPlayerInfoHub?.loadMessages?.().catch(()=>{});return true;
}
function start(){let tries=0;const timer=setInterval(()=>{tries++;if(mount()||tries>120)clearInterval(timer);},250);mount();for(const ev of ['world:access-granted','world:user-login','worldproject:company-loaded'])window.addEventListener(ev,()=>setTimeout(mount,0));}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
export {mount};
