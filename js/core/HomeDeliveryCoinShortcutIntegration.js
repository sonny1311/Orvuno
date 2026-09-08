// ORVUNO – Coin-Beschleunigung direkt auf der Startseite bei "Läuft gerade".
// Alle zeitbasierten Vorgänge verwenden dieselbe serverautoritativ verbuchte Regel.
import './CoinTimeAccelerationUIIntegration.js';
import './ActiveOperationsPartialCoinOverride.js';
import { activeOperationsSummary } from './ActiveOperationsOverview.js';
import { canReduceOperation,COIN_TIME_RULE_LABEL,fullOperationTimeReductionQuote,operationTimeReductionQuoteForCoins,reduceOperationTimeWithCoins } from './OperationCoinTimeReductionSystem.js';
import { timerEnd } from './TimeValueUtils.js';
import { appendTimeAdControl } from './RewardedAdUIIntegration.js';

const company=()=>window.worldPlayerCompany||window.worldActiveServerCompany||window.worldEconomyGameplay?.company||window.worldEngine?.company||null;
const text=v=>String(v||'').replace(/\s+/g,' ').trim();
const coinLabel=n=>`${n} Coin${Number(n)===1?'':'s'}`;
const durationLabel=ms=>{const min=Math.max(0,Math.ceil(Number(ms||0)/60000));if(min<=0)return'0 Min.';if(min<60)return`${min} Min.`;const h=Math.floor(min/60),m=min%60;return`${h} Std.${m?` ${m} Min.`:''}`;};
const budgetByOperation=new Map();
let observedHomeRoot=null;
let homeRootObserver=null;
let decorateQueued=false;

function operationKey(r={}){return `${r.kind||'operation'}:${r.id??r.raw?.id??r.raw?.instanceId??r.label??''}`;}
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
function scheduleDecorate(delay=0){
 if(decorateQueued)return;
 decorateQueued=true;
 const fire=()=>{decorateQueued=false;decorate();};
 if(delay>0)setTimeout(fire,delay);else if(typeof queueMicrotask==='function')queueMicrotask(fire);else Promise.resolve().then(fire);
}
function bindHomeRootObserver(){
 if(typeof document==='undefined'||typeof MutationObserver==='undefined')return false;
 const root=document.getElementById('world-home-dashboard');
 if(!root)return false;
 if(root===observedHomeRoot&&homeRootObserver)return true;
 homeRootObserver?.disconnect?.();
 observedHomeRoot=root;
 homeRootObserver=new MutationObserver(()=>scheduleDecorate());
 // Nur direkte Kinder beobachten: der Home-Dashboard-Renderer ersetzt diese komplett.
 // Unsere Coin-Bedienelemente liegen tiefer und lösen dadurch keinen Observer-Loop aus.
 homeRootObserver.observe(root,{childList:true,subtree:false});
 return true;
}
function decorate(){
 if(typeof document==='undefined')return false;
 bindHomeRootObserver();
 const c=company(),section=runningSection();if(!c||!section)return false;
 let rule=section.querySelector('[data-home-coin-time-rule]');if(!rule){rule=document.createElement('div');rule.dataset.homeCoinTimeRule='1';rule.textContent=`🪙 ${COIN_TIME_RULE_LABEL} tatsächlicher Restzeit · Coin-Anzahl frei wählbar · 60 Min. = 12 Coins · normales Warten bleibt kostenlos.`;Object.assign(rule.style,{margin:'8px 0',padding:'8px 10px',border:'1px solid #8a6b16',borderRadius:'8px',background:'rgba(99,72,8,.16)',fontSize:'12px',fontWeight:'800'});const grid=[...section.children].find(el=>el.tagName==='DIV'&&el.querySelector('div'));section.insertBefore(rule,grid||null);}
 const rows=activeOperationsSummary(c).rows.filter(r=>r.kind!=='customer_order'&&Number(r.remainingMs)>0&&canReduceOperation(r)).slice(0,8),cards=operationCards(section);let changed=false;
 cards.forEach((card,index)=>{
  const r=rows[index];if(!r)return;
  let controls=card.querySelector(':scope > [data-home-time-coin-controls]');
  // Wichtig: vorhandene Controls niemals periodisch neu aufbauen. Das war die Ursache
  // für das sichtbare Verschwinden/Wiedererscheinen und den Fokusverlust im Eingabefeld.
  if(controls)return;
  controls=document.createElement('div');controls.dataset.homeTimeCoinControls='1';Object.assign(controls.style,{display:'flex',alignItems:'center',gap:'8px',flexWrap:'wrap',marginTop:'10px',paddingTop:'10px',borderTop:'1px solid #2b3a50'});card.append(controls);changed=true;
  const fresh=currentRow(r);let full;try{full=fullOperationTimeReductionQuote(fresh);}catch{controls.remove();return;}const balance=Math.max(0,Math.floor(Number(c.coins||0))),key=operationKey(r),remembered=Math.floor(Number(budgetByOperation.get(key)||0)),fallback=Math.min(balance,full.costCoins),initial=remembered>0?Math.min(remembered,balance,full.costCoins):fallback;
  const info=document.createElement('small');info.textContent=`🪙 Ganz fertig: ${coinLabel(full.costCoins)} · Guthaben ${balance}`;info.style.color='#c9b46e';info.style.fontWeight='800';info.style.flex='1 1 100%';
  const label=document.createElement('label');label.textContent='Coins:';label.style.fontWeight='800';label.style.fontSize='12px';
  const input=document.createElement('input');input.type='number';input.min='1';input.step='1';input.dataset.homeCoinBudgetInput='1';input.value=String(initial>0?initial:1);Object.assign(input.style,{width:'70px',padding:'6px',borderRadius:'6px',border:'1px solid #d39b21',fontWeight:'800'});
  const preview=document.createElement('small');preview.style.color='#c9b46e';preview.style.fontWeight='800';preview.style.flex='1 1 160px';
  const btn=document.createElement('button');Object.assign(btn.style,{padding:'7px 10px',borderRadius:'7px',border:'1px solid #d39b21',background:'#2a210b',color:'#f7c95d',fontWeight:'800',cursor:'pointer'});
  const update=()=>{const live=currentRow(r);let liveFull;try{liveFull=fullOperationTimeReductionQuote(live);}catch{controls.remove();return null;}const coins=Math.max(0,Math.floor(Number(c.coins||0))),maxSpend=Math.min(coins,liveFull.costCoins);input.max=String(Math.max(1,maxSpend));if(maxSpend<=0){input.disabled=true;btn.disabled=true;btn.style.opacity='.55';preview.textContent='Keine Coins verfügbar';btn.textContent='⚡ Keine Coins';budgetByOperation.delete(key);return null;}input.disabled=false;btn.style.opacity='1';let selected=Math.floor(Number(input.value)||1);selected=Math.max(1,Math.min(maxSpend,selected));input.value=String(selected);budgetByOperation.set(key,selected);const q=operationTimeReductionQuoteForCoins(live,selected);preview.textContent=`${coinLabel(q.costCoins)} = ${durationLabel(q.reducedMs)} weniger`;btn.textContent=q.full?`⚡ Sofort fertig · ${coinLabel(q.costCoins)}`:`⚡ ${durationLabel(q.reducedMs)} verkürzen · ${coinLabel(q.costCoins)}`;btn.disabled=false;return{live,q,selected};};
  input.oninput=update;input.onchange=update;update();
  btn.onclick=async e=>{e.preventDefault();e.stopPropagation();const state=update();if(!state)return;const {live,q,selected}=state;if(!confirm(`${q.full?'Diesen Vorgang sofort abschließen?':`Diesen Vorgang um ${durationLabel(q.reducedMs)} verkürzen?`}\n\nEinsatz: ${coinLabel(q.costCoins)}\nRestzeit danach: ca. ${durationLabel(q.newRemainingMs)}\n${COIN_TIME_RULE_LABEL}`))return;btn.disabled=true;btn.textContent='Wird gebucht…';try{await reduceOperationTimeWithCoins(c,live,'all',{coinBudget:selected});if(q.full)budgetByOperation.delete(key);window.worldHomeOperationsDashboard?.render?.();scheduleDecorate();}catch(err){alert(err?.message||String(err));update();}};
  controls.append(info,label,input,preview,btn);
  if(r.kind==='delivery'){try{appendTimeAdControl(card,r);}catch{}}
 });
 return changed;
}
if(typeof window!=='undefined'){
 window.worldHomeDeliveryCoinShortcut={decorate,schedule:scheduleDecorate};
 const run=()=>{bindHomeRootObserver();scheduleDecorate(20);};
 for(const ev of ['orvuno:boot-complete','worldproject:company-loaded','worldproject:company-activated','worldproject:company-switched','world:game-state-dirty','world:server-balances-changed','world:rewarded-ad-updated'])window.addEventListener(ev,run);
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run);else run();
}
export function runHomeDeliveryCoinShortcutTest(){const now=1000000,c={coins:10},r={kind:'delivery',id:'d1',remainingMs:90*60000,raw:{id:'d1',arrivalTime:new Date(now+90*60000)}};const q=operationTimeReductionQuoteForCoins(r,c.coins,{now});if(q.costCoins!==10||q.reducedMs!==50*60000||q.newRemainingMs!==40*60000)throw new Error('Home-Zeitbeschleunigung muss 10 Coins auf 50 von 90 Minuten begrenzen');return true;}
