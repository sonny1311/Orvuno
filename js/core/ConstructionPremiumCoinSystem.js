import { PremiumEntitlementSystem } from './PremiumEntitlementSystem.js';
import { timerEnd,shiftKnownEndTimes } from './TimeValueUtils.js';
import { COIN_TIME_RULE_LABEL,coinCostForMs,reduceOperationTimeWithCoins } from './OperationCoinTimeReductionSystem.js';

export const COIN_TIME_REDUCTION=Object.freeze({minHours:1,maxHours:10,minutesPerCoin:5,coinsPerFiveMinutes:1,coinsPerHour:12,maxCoinsPerPurchase:120,minimumRealTimeRatio:0});
const premium=new PremiumEntitlementSystem();
const n=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
const account=()=>typeof window!=='undefined'?(window.worldCurrentUser||window.worldAccount||{}):{};

export function activeConstructionJobs(company={}){return(company?.constructionSite?.jobs||[]).filter(j=>j&&j.status==='building');}
export function constructionSlotState(company={},a=account(),now=Date.now()){const running=activeConstructionJobs(company).length,limit=premium.constructionLimit(a,now);return{running,limit,free:Math.max(0,limit-running),premium:premium.state(a,now).active,allowed:running<limit};}
export function assertCanStartConstruction(company={},a=account(),now=Date.now()){const s=constructionSlotState(company,a,now);if(!s.allowed)throw new Error(`Maximal ${s.limit} parallele Bauauftraege erlaubt.${s.premium?'':' Premium erweitert das Limit auf 5.'}`);return s;}
export function constructionMinimumFinishAt(job={}){return n(job?.startedAt||job?.startTime||job?.createdAt);}
function actionKind(job={}){const kind=String(job?.kind||'').toLowerCase();if(kind==='land')return'land';if(kind==='warehouse_expansion')return'warehouse_expansion';if(kind==='machine_upgrade')return'machine_upgrade';if(kind==='business_upgrade')return'business_upgrade';return'construction';}
function operationRow(job={},now=Date.now()){const end=timerEnd(job)?.value||0;return{kind:actionKind(job),id:job.id??job.instanceId,raw:job,remainingMs:Math.max(0,end-now)};}

export function timeReductionQuote(company={},job,hours=1,{now=Date.now()}={}){
 if(!job||!['building','upgrading','running'].includes(String(job.status||'').toLowerCase()))throw new Error('Dieser Vorgang kann nicht mehr verkuerzt werden');
 const end=timerEnd(job)?.value||0,remainingMs=Math.max(0,end-now);if(!remainingMs)throw new Error('Der Vorgang ist bereits fertig');
 const requested=Math.max(1,Math.min(87600,Math.floor(n(hours,1)))),reductionMs=Math.min(remainingMs,requested*3600000),cost=coinCostForMs(reductionMs);
 return{hours:requested,cost,remainingMs,reductionMs,newRemainingMs:remainingMs-reductionMs,coins:n(company.coins),minimumFinishAt:now,minimumRealTimeMs:0,locked:false,priceUnitMinutes:5};
}
// Legacy-Helfer fuer alte interne Aufrufer. Sichtbare Spieleraktionen nutzen den serverautoritativen Dialog unten.
export function reduceJobTimeWithCoins(company={},job,hours=1,{now=Date.now()}={}){
 const q=timeReductionQuote(company,job,hours,{now});if(n(company.coins)<q.cost)throw new Error(`Nicht genug Coins. Benoetigt: ${q.cost}, vorhanden: ${n(company.coins)}`);
 company.coins=n(company.coins)-q.cost;shiftKnownEndTimes(job,-q.reductionMs,{floorMs:now});job.coinTimeReductionMs=n(job.coinTimeReductionMs)+q.reductionMs;job.coinTimeReductionSpent=n(job.coinTimeReductionSpent)+q.cost;job.lastCoinTimeReductionAt=now;job.coinAccelerationPolicy='one-coin-per-started-five-minutes';
 return{...q,finishAt:timerEnd(job)?.value||now,coinsAfter:company.coins};
}
const fmt=ms=>{let m=Math.max(0,Math.ceil(n(ms)/60000)),h=Math.floor(m/60);return h?`${h} Std. ${m%60} Min.`:`${m} Min.`;};
export function openCoinTimeReductionDialog({company,job,onDone=()=>{},parent=document.body}={}){
 if(typeof document==='undefined')return null;const row=operationRow(job),end=timerEnd(job)?.value||0;if(!row.id||!end||end<=Date.now())throw new Error('Dieser Vorgang ist bereits fertig');
 const ov=document.createElement('div'),p=document.createElement('div'),cancel=document.createElement('button'),buy=document.createElement('button');Object.assign(ov.style,{position:'fixed',inset:0,zIndex:30000,background:'rgba(0,0,0,.72)',display:'flex',alignItems:'center',justifyContent:'center',padding:'14px'});Object.assign(p.style,{width:'min(520px,94vw)',background:'#111827',color:'#fff',padding:'18px',borderRadius:'14px',boxSizing:'border-box'});
 const remainingMs=Math.max(0,end-Date.now()),cost=coinCostForMs(remainingMs);p.innerHTML=`<h2 style="margin-top:0">🪙 Zeit verkürzen</h2><b>${job.label||'Vorgang'}</b><div style="margin:10px 0;color:#fde68a"><strong>${COIN_TIME_RULE_LABEL}</strong><br>Normales Warten bleibt kostenlos.</div><div>Restzeit: <b>${fmt(remainingMs)}</b><br>Sofort fertig: <b>${cost} Coin${cost===1?'':'s'}</b><br>Coin-Guthaben: <b>${Number(company?.coins||0)}</b></div>`;
 cancel.textContent='Abbrechen';cancel.onclick=()=>ov.remove();buy.textContent=`⚡ Sofort fertig · ${cost} Coin${cost===1?'':'s'}`;buy.disabled=Number(company?.coins||0)<cost;Object.assign(buy.style,{marginLeft:'8px',fontWeight:'800'});
 buy.onclick=async()=>{if(buy.disabled)return;const fresh=operationRow(job),freshEnd=timerEnd(job)?.value||0,freshCost=coinCostForMs(Math.max(0,freshEnd-Date.now()));if(!confirm(`Diesen Vorgang jetzt sofort abschließen?\n\n${COIN_TIME_RULE_LABEL}\nAktuelle Kosten: höchstens ${freshCost} Coin${freshCost===1?'':'s'}.`))return;buy.disabled=true;buy.textContent='Wird gebucht…';try{const result=await reduceOperationTimeWithCoins(company,fresh,'all');ov.remove();onDone(result);}catch(e){buy.disabled=false;buy.textContent=`⚡ Sofort fertig · ${freshCost} Coin${freshCost===1?'':'s'}`;alert(e.message);}};
 p.append(document.createElement('hr'),cancel,buy);ov.append(p);parent.append(ov);return ov;
}
export function runConstructionPremiumCoinTest(){const now=1000000,c={coins:100},j={status:'building',finishAt:now+60*60000};const q=timeReductionQuote(c,j,1,{now});if(q.cost!==12)throw new Error('60 Minuten müssen 12 Coins kosten');const j2={status:'building',finishAt:now+61*60000},q2=timeReductionQuote(c,j2,2,{now});if(q2.cost!==13)throw new Error('61 Minuten müssen 13 Coins kosten');return true;}
if(typeof window!=='undefined')window.worldConstructionPremiumCoin={config:COIN_TIME_REDUCTION,slotState:constructionSlotState,assertCanStart:assertCanStartConstruction,quote:timeReductionQuote,reduce:reduceJobTimeWithCoins,minimumFinishAt:constructionMinimumFinishAt,openDialog:openCoinTimeReductionDialog,runTest:runConstructionPremiumCoinTest};
