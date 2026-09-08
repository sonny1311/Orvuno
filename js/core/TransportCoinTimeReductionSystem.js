// WorldProject - aktive Warentransporte mit Coins beschleunigen.
// Verbindliche Regel: 1 Coin je angefangene 5 Minuten tatsaechlich verkuerzter Restzeit.
import { timeMs,timerEnd } from './TimeValueUtils.js';
import { coinCostForMs,reduceOperationTimeWithCoins } from './OperationCoinTimeReductionSystem.js';
const n=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
function arrivalKey(transport={}){for(const k of ['arrivalTime','arrivalAt','arriveAt','arrivesAt','trafficEta','eta','finishAt'])if(timeMs(transport[k])>0)return k;return'arrivalTime';}
function arrivalMs(transport={}){return timeMs(transport[arrivalKey(transport)]);}
export function transportTimeReductionQuote(company={},transport,hours=1,{now=Date.now()}={}){
 if(!transport)throw new Error('Transport fehlt');
 const end=arrivalMs(transport);if(end<=now)throw new Error('Transport ist bereits angekommen');
 const requested=Math.max(1,Math.min(87600,Math.floor(n(hours,1)))),remainingMs=end-now,reductionMs=Math.min(remainingMs,requested*3600000),cost=coinCostForMs(reductionMs);
 return{hours:requested,requestedHours:requested,cost,remainingMs,reductionMs,newArrivalMs:Math.max(now,end-reductionMs),coins:n(company.coins),priceUnitMinutes:5,coinsPerUnit:1};
}
export async function reduceTransportTimeWithCoins(company={},transport,hours=1,{now=Date.now()}={}){
 const end=timerEnd(transport)?.value||arrivalMs(transport);if(!transport?.id||end<=now)throw new Error('Transport ist bereits angekommen oder besitzt keine gültige ID');
 const row={kind:'delivery',id:transport.id,raw:transport,remainingMs:end-now};
 return reduceOperationTimeWithCoins(company,row,hours);
}
export function runTransportCoinTimeReductionTest(){const now=1000000,c={coins:100},t={id:'t1',arrivalTime:new Date(now+60*60000),totalHours:1};const r=transportTimeReductionQuote(c,t,1,{now});if(r.cost!==12||r.reductionMs!==60*60000)throw new Error('60 Minuten Lieferung müssen 12 Coins kosten');const short={id:'short',arrivalTime:new Date(now+5*60000)},q=transportTimeReductionQuote(c,short,1,{now});if(q.cost!==1)throw new Error('5 Minuten Lieferung müssen 1 Coin kosten');const partial={id:'partial',arrivalTime:new Date(now+61*60000)},qp=transportTimeReductionQuote(c,partial,2,{now});if(qp.cost!==13)throw new Error('61 Minuten Lieferung müssen 13 Coins kosten');return true;}
if(typeof window!=='undefined')window.worldTransportCoinTimeReduction={quote:transportTimeReductionQuote,reduce:reduceTransportTimeWithCoins,test:runTransportCoinTimeReductionTest};
