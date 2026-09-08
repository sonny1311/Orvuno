// ORVUNO – Coin-Beschleunigung direkt auf der Startseite bei "Läuft gerade".
// Alle zeitbasierten Vorgänge verwenden dieselbe serverautoritativ verbuchte Regel.
import './CoinTimeAccelerationUIIntegration.js';
import { activeOperationsSummary } from './ActiveOperationsOverview.js';
import { canReduceOperation,COIN_TIME_RULE_LABEL,fullOperationTimeReductionQuote,reduceOperationTimeWithCoins } from './OperationCoinTimeReductionSystem.js';
import { timerEnd } from './TimeValueUtils.js';
import { appendTimeAdControl } from './RewardedAdUIIntegration.js';

const company=()=>window.worldPlayerCompany||window.worldActiveServerCompany||window.worldEconomyGameplay?.company||window.worldEngine?.company||null;
const text=v=>String(v||'').replace(/\s+/g,' ').trim();
const coinLabel=n=>`${n} Coin${Number(n)===1?'':'s'}`;

function runningSection(){
 const root=document.getElementById('world-home-dashboard');if(!root)return null;
 const h=[...root.querySelectorAll('h2')].find(x=>text(x.textContent).includes('Läuft gerade'));
 return h?.closest('section')||h?.parentElement?.parentElement||null;
}
function operationCards(section){
 if(!section)return[];
 const all=[...section.querySelectorAll('div')].filter(el=>{const t=text(el.textContent);return t.includes('Restzeit:')&&el.querySelector('div');});
 return all.filter(el=>!all.some(other=>other!==el&&el.contains(other))).slice(0,8);
}
function currentRow(row){const end=timerEnd(row.raw)?.value||0;return{...row,remainingMs:Math.max(0,end-Date.now())};}
function decorate(){
 if(typeof document==='undefined')return false;
 const c=company(),section=runningSection();if(!c||!section)return false;
 let rule=section.querySelector('[data-home-coin-time-rule]');if(!rule){rule=document.createElement('div');rule.dataset.homeCoinTimeRule='1';rule.textContent=`🪙 ${COIN_TIME_RULE_LABEL} tatsächlicher Restzeit · 60 Min. = 12 Coins · normales Warten bleibt kostenlos.`;Object.assign(rule.style,{margin:'8px 0',padding:'8px 10px',border:'1px solid #8a6b16',borderRadius:'8px',background:'rgba(99,72,8,.16)',fontSize:'12px',fontWeight:'800'});const grid=[...section.children].find(el=>el.tagName==='DIV'&&el.querySelector('div'));section.insertBefore(rule,grid||null);}
 const rows=activeOperationsSummary(c).rows.filter(r=>r.kind!=='customer_order'&&Number(r.remainingMs)>0&&canReduceOperation(r)).slice(0,8),cards=operationCards(section);let changed=false;
 cards.forEach((card,index)=>{
  const r=rows[index];if(!r)return;let controls=card.querySelector(':scope > [data-home-time-coin-controls]');if(!controls){controls=document.createElement('div');controls.dataset.homeTimeCoinControls='1';Object.assign(controls.style,{display:'flex',alignItems:'center',gap:'8px',flexWrap:'wrap',marginTop:'10px',paddingTop:'10px',borderTop:'1px solid #2b3a50'});card.append(controls);changed=true;}
  const fresh=currentRow(r);let q;try{q=fullOperationTimeReductionQuote(fresh);}catch{controls.remove();return;}controls.innerHTML='';const info=document.createElement('small');info.textContent=`🪙 Sofort fertig: ${coinLabel(q.costCoins)} · Guthaben ${Number(c.coins||0)}`;info.style.color='#c9b46e';info.style.fontWeight='800';const btn=document.createElement('button');btn.textContent=`⚡ Sofort fertig · ${coinLabel(q.costCoins)}`;Object.assign(btn.style,{padding:'7px 10px',borderRadius:'7px',border:'1px solid #d39b21',background:'#2a210b',color:'#f7c95d',fontWeight:'800',cursor:'pointer'});btn.disabled=Number(c.coins||0)<q.costCoins;if(btn.disabled){btn.style.opacity='.55';btn.title=`Nicht genug Coins · benötigt ${q.costCoins}`;}
  btn.onclick=async e=>{e.preventDefault();e.stopPropagation();const live=currentRow(r);let quote;try{quote=fullOperationTimeReductionQuote(live);}catch(err){alert(err.message);return;}if(!confirm(`Diesen Vorgang jetzt sofort abschließen?\n\n${COIN_TIME_RULE_LABEL}\nAktuelle Kosten: höchstens ${coinLabel(quote.costCoins)}.\nNormales Warten bleibt kostenlos.`))return;btn.disabled=true;btn.textContent='Wird gebucht…';try{await reduceOperationTimeWithCoins(c,live,'all');window.worldHomeOperationsDashboard?.render?.();setTimeout(decorate,0);}catch(err){alert(err?.message||String(err));btn.disabled=false;btn.textContent=`⚡ Sofort fertig · ${coinLabel(quote.costCoins)}`;}};controls.append(info,btn);
  if(r.kind==='delivery'){try{appendTimeAdControl(card,r);}catch{}}
 });
 return changed;
}
if(typeof window!=='undefined'){
 window.worldHomeDeliveryCoinShortcut={decorate};const run=()=>setTimeout(decorate,20);
 for(const ev of ['orvuno:boot-complete','worldproject:company-loaded','worldproject:company-activated','worldproject:company-switched','world:game-state-dirty','world:server-balances-changed','world:rewarded-ad-updated'])window.addEventListener(ev,run);
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run);else run();setInterval(decorate,3000);
}
export function runHomeDeliveryCoinShortcutTest(){const now=1000000,c={coins:100},r={kind:'delivery',id:'d1',remainingMs:60*60000,raw:{id:'d1',arrivalTime:new Date(now+60*60000)}};const q=fullOperationTimeReductionQuote(r,{now});if(q.costCoins!==12||q.reducedMs!==60*60000)throw new Error('Home-Zeitbeschleunigung muss 60 Minuten mit 12 Coins kalkulieren');return true;}
