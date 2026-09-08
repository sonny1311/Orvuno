// ORVUNO – ersetzt die alte Stunden-Auswahl in "Betrieb im Überblick" durch frei wählbare Coins.
// Einheitliche Regel: 1 Coin je angefangene 5 Minuten tatsächlich verkürzter Restzeit.
import { activeOperationsSummary } from './ActiveOperationsOverview.js';
import { canReduceOperation,fullOperationTimeReductionQuote,operationTimeReductionQuoteForCoins,reduceOperationTimeWithCoins } from './OperationCoinTimeReductionSystem.js';
import { timerEnd } from './TimeValueUtils.js';

const text=v=>String(v||'').replace(/\s+/g,' ').trim();
const coinLabel=n=>`${n} Coin${Number(n)===1?'':'s'}`;
const durationLabel=ms=>{const min=Math.max(0,Math.ceil(Number(ms||0)/60000));if(min<=0)return'0 Min.';if(min<60)return`${min} Min.`;const h=Math.floor(min/60),m=min%60;return`${h} Std.${m?` ${m} Min.`:''}`;};
const company=()=>window.worldPlayerCompany||window.worldEconomyGameplay?.company||window.worldEngine?.company||null;
function liveRow(r){const end=timerEnd(r?.raw)?.value||0;return{...r,remainingMs:Math.max(0,end-Date.now())};}
function removeLegacyControl(row){for(const select of row.querySelectorAll('select')){const wrap=select.parentElement;if(wrap&&text(wrap.textContent).includes('Zeit verkürzen')&&text(wrap.textContent).includes('Beschleunigen'))wrap.remove();}}
function refreshOverview(){const open=window.worldActiveOperationsUI?.open;if(typeof open!=='function')return;document.querySelector('[data-world-active-operations-overlay]')?.remove();open();}
function appendPartialControl(row,r,c){if(!row||!canReduceOperation(r))return;removeLegacyControl(row);if(row.querySelector(':scope > [data-active-overview-partial-coins]'))return;
 const live=liveRow(r);let full;try{full=fullOperationTimeReductionQuote(live);}catch{return;}const balance=Math.max(0,Math.floor(Number(c?.coins||0))),initial=Math.min(full.costCoins,balance);
 const wrap=document.createElement('div');wrap.dataset.activeOverviewPartialCoins='1';Object.assign(wrap.style,{display:'flex',gap:'7px',alignItems:'center',flexWrap:'wrap',marginTop:'8px',paddingTop:'8px',borderTop:'1px solid #e5e7eb'});
 const info=document.createElement('small');info.textContent=`🪙 1 Coin je angefangene 5 Min. · Ganz fertig: ${coinLabel(full.costCoins)} · Guthaben ${balance}`;info.style.flex='1 1 100%';info.style.fontWeight='800';
 const label=document.createElement('label');label.textContent='Coins einsetzen:';label.style.fontSize='12px';label.style.fontWeight='800';
 const input=document.createElement('input');input.type='number';input.min='1';input.step='1';input.dataset.activeOverviewCoinBudget='1';input.value=String(initial>0?initial:1);Object.assign(input.style,{width:'76px',padding:'6px',borderRadius:'6px',border:'1px solid #9ca3af',fontWeight:'800'});
 const preview=document.createElement('small');preview.dataset.activeOverviewCoinPreview='1';preview.style.fontWeight='800';preview.style.flex='1 1 180px';
 const button=document.createElement('button');Object.assign(button.style,{padding:'6px 9px',borderRadius:'6px',border:'1px solid #9ca3af',cursor:'pointer',fontWeight:'800'});
 const update=()=>{const current=liveRow(r);let whole;try{whole=fullOperationTimeReductionQuote(current);}catch{wrap.remove();return null;}const coins=Math.max(0,Math.floor(Number(c?.coins||0))),maxSpend=Math.min(whole.costCoins,coins);input.max=String(Math.max(1,maxSpend));if(maxSpend<=0){input.disabled=true;button.disabled=true;preview.textContent='Keine Coins verfügbar.';button.textContent='⚡ Keine Coins';return null;}input.disabled=false;let selected=Math.floor(Number(input.value)||1);selected=Math.max(1,Math.min(maxSpend,selected));input.value=String(selected);const q=operationTimeReductionQuoteForCoins(current,selected);preview.textContent=`${coinLabel(q.costCoins)} = ${durationLabel(q.reducedMs)} weniger · danach ca. ${durationLabel(q.newRemainingMs)} Restzeit`;button.textContent=q.full?`⚡ Sofort fertig · ${coinLabel(q.costCoins)}`:`⚡ ${durationLabel(q.reducedMs)} verkürzen · ${coinLabel(q.costCoins)}`;button.disabled=false;return{current,q,selected};};
 input.oninput=update;input.onchange=update;update();
 button.onclick=async()=>{const state=update();if(!state)return;const {current,q,selected}=state;if(!confirm(`${q.full?'Diesen Vorgang sofort abschließen?':`Diesen Vorgang um ${durationLabel(q.reducedMs)} verkürzen?`}\n\nEinsatz: ${coinLabel(q.costCoins)}\nRestzeit danach: ca. ${durationLabel(q.newRemainingMs)}\n1 Coin je angefangene 5 Minuten.`))return;button.disabled=true;button.textContent='Wird gebucht…';try{await reduceOperationTimeWithCoins(c,current,'all',{coinBudget:selected});refreshOverview();}catch(error){alert(error?.message||String(error));update();}};
 wrap.append(info,label,input,preview,button);row.append(wrap);
}
export function decorateActiveOperationsPartialCoins(){const overlay=document.querySelector('[data-world-active-operations-overlay]'),c=company();if(!overlay||!c)return false;const summary=activeOperationsSummary(c).rows.filter(r=>r.kind!=='customer_order'&&Number(r.remainingMs)>0&&canReduceOperation(r)),domRows=[...overlay.querySelectorAll('[data-operation-kind]')].filter(row=>row.dataset.operationKind!=='customer_order'),used=new Set();
 for(const r of summary){let index=domRows.findIndex((row,i)=>!used.has(i)&&row.dataset.operationKind===r.kind&&text(row.textContent).includes(text(r.label)));if(index<0)index=domRows.findIndex((row,i)=>!used.has(i)&&row.dataset.operationKind===r.kind);if(index<0)continue;used.add(index);appendPartialControl(domRows[index],r,c);}return true;}

if(typeof window!=='undefined'){
 const run=()=>queueMicrotask(decorateActiveOperationsPartialCoins);window.worldActiveOperationsPartialCoins={decorate:decorateActiveOperationsPartialCoins};
 const observer=new MutationObserver(run);const boot=()=>{observer.observe(document.documentElement,{childList:true,subtree:true});run();};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
 window.addEventListener('world:server-balances-changed',run);
}
