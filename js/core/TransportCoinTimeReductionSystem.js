// WorldProject - aktive Warentransporte mit Coins beschleunigen.
// Verbindliche Regel: 1 Coin je angefangene 5 Minuten tatsaechlich verkuerzter Restzeit.
import { timeMs,timerEnd } from './TimeValueUtils.js';
import { coinCostForMs,operationTimeReductionQuoteForCoins,reduceOperationTimeWithCoins } from './OperationCoinTimeReductionSystem.js';
const n=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
function arrivalKey(transport={}){for(const k of ['arrivalTime','arrivalAt','arriveAt','arrivesAt','trafficEta','eta','finishAt'])if(timeMs(transport[k])>0)return k;return'arrivalTime';}
function arrivalMs(transport={}){return timeMs(transport[arrivalKey(transport)]);}
export function transportTimeReductionQuote(company={},transport,hours=1,{now=Date.now()}={}){
 if(!transport)throw new Error('Transport fehlt');
 const end=arrivalMs(transport);if(end<=now)throw new Error('Transport ist bereits angekommen');
 const requested=Math.max(1,Math.min(87600,Math.floor(n(hours,1)))),remainingMs=end-now,reductionMs=Math.min(remainingMs,requested*3600000),cost=coinCostForMs(reductionMs);
 return{hours:requested,requestedHours:requested,cost,remainingMs,reductionMs,newArrivalMs:Math.max(now,end-reductionMs),coins:n(company.coins),priceUnitMinutes:5,coinsPerUnit:1};
}
export function transportTimeReductionQuoteForCoins(company={},transport,coinBudget=1,{now=Date.now()}={}){const end=timerEnd(transport)?.value||arrivalMs(transport);if(!transport?.id||end<=now)throw new Error('Transport ist bereits angekommen oder besitzt keine gültige ID');const row={kind:'delivery',id:transport.id,raw:transport,remainingMs:end-now};const q=operationTimeReductionQuoteForCoins(row,coinBudget,{now});return{...q,cost:q.costCoins,newArrivalMs:Math.max(now,end-q.reducedMs),coins:n(company.coins)};}
export async function reduceTransportTimeWithCoins(company={},transport,hours=1,{now=Date.now(),coinBudget=null}={}){
 const end=timerEnd(transport)?.value||arrivalMs(transport);if(!transport?.id||end<=now)throw new Error('Transport ist bereits angekommen oder besitzt keine gültige ID');
 const row={kind:'delivery',id:transport.id,raw:transport,remainingMs:end-now};
 return reduceOperationTimeWithCoins(company,row,hours,{coinBudget});
}
export function runTransportCoinTimeReductionTest(){const now=1000000,c={coins:10},t={id:'t1',arrivalTime:new Date(now+90*60000),totalHours:1.5};const r=transportTimeReductionQuoteForCoins(c,t,10,{now});if(r.cost!==10||r.reducedMs!==50*60000||r.newRemainingMs!==40*60000)throw new Error('10 Coins müssen 50 von 90 Minuten Lieferung verkürzen');const short={id:'short',arrivalTime:new Date(now+5*60000)},q=transportTimeReductionQuoteForCoins(c,short,1,{now});if(q.cost!==1||!q.full)throw new Error('5 Minuten Lieferung müssen mit 1 Coin fertig werden');return true;}
if(typeof window!=='undefined')window.worldTransportCoinTimeReduction={quote:transportTimeReductionQuote,quoteForCoins:transportTimeReductionQuoteForCoins,reduce:reduceTransportTimeWithCoins,test:runTransportCoinTimeReductionTest};
