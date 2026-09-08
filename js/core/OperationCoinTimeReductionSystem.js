// WorldProject - einheitliche Coin-Zeitverkuerzung fuer alle sinnvollen Vorgangstimer.
// Verbindliche Regel: 1 Coin je angefangene 5 Minuten tatsaechlich verkuerzter Restzeit.
import { AuthApiClient } from './AuthApiClient.js';
import { timerEnd,shiftKnownEndTimes } from './TimeValueUtils.js';

const api=new AuthApiClient();
const ELIGIBLE=new Set(['production','delivery','construction','land','warehouse_expansion','machine_upgrade','business_upgrade','equipment','maintenance','crew_arrival']);
const inFlight=new Set();
const n=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
export const COIN_TIME_UNIT_MINUTES=5;
export const COIN_TIME_UNIT_MS=COIN_TIME_UNIT_MINUTES*60000;
export const COIN_TIME_RULE_LABEL='1 Coin je angefangene 5 Min.';
export function coinCostForMs(ms){const value=Math.max(0,n(ms));return value>0?Math.max(1,Math.ceil(value/COIN_TIME_UNIT_MS)):0;}
export function canReduceOperation(row={}){return ELIGIBLE.has(row.kind)&&row.id!=null&&row.raw&&n(row.remainingMs)>0&&!!timerEnd(row.raw);}
export function operationTimeReductionQuote(row={},hours=1,{now=Date.now()}={}){
 if(!canReduceOperation(row))throw new Error('Dieser Vorgang kann nicht mit Coins beschleunigt werden');
 const end=timerEnd(row.raw)?.value||0,remainingMs=Math.max(0,end-now);if(!remainingMs)throw new Error('Der Vorgang ist bereits fertig');
 const requestedHours=hours==='all'||hours===Infinity?Math.max(1,Math.ceil(remainingMs/3600000)):Math.max(1,Math.min(87600,Math.floor(n(hours,1))));
 const reducedMs=Math.min(remainingMs,requestedHours*3600000),costCoins=coinCostForMs(reducedMs);
 return{requestedHours,reducedMs,costCoins,remainingMs,newRemainingMs:remainingMs-reducedMs,priceUnitMinutes:COIN_TIME_UNIT_MINUTES,coinsPerUnit:1,full:reducedMs>=remainingMs};
}
export function fullOperationTimeReductionQuote(row={},options={}){return operationTimeReductionQuote(row,'all',options);}
async function waitForSave(sync,limit=50){for(let i=0;i<limit&&sync?.saving;i++)await new Promise(resolve=>setTimeout(resolve,40));}
async function flushBeforeReduction(){const sync=typeof window!=='undefined'?window.worldAccounts?.gameStateSync:null;if(!sync?.save)return null;await waitForSave(sync);await sync.save().catch(error=>{throw new Error(`Spielstand konnte vor der Coin-Buchung nicht gesichert werden: ${error?.message||error}`);});await waitForSave(sync);return sync;}
export async function reduceOperationTimeWithCoins(company={},row={},hours=1){
 const q=operationTimeReductionQuote(row,hours),companyId=Number(company.serverCompanyId);if(!Number.isFinite(companyId)||companyId<=0)throw new Error('Server-Betrieb fehlt');
 const key=`${row.kind}:${row.id}`;if(inFlight.has(key))throw new Error('Diese Zeitverkürzung wird bereits verarbeitet. Bitte kurz warten.');
 inFlight.add(key);let sync=null,saveLock=false;
 try{
  sync=await flushBeforeReduction();
  // Zwischen dem letzten vollständigen Save und der atomaren RPC-Buchung darf der normale
  // 5-Sekunden-Autosave die alte Endzeit nicht wieder über den gerade geänderten Serverzustand schreiben.
  if(sync&&!sync.saving){sync.saving=true;saveLock=true;}
  if(typeof window!=='undefined')window.worldCoinTimeReductionInFlight=true;
  const r=await api.rpc('shorten_company_timed_action',{p_company_id:companyId,p_action_kind:row.kind,p_action_id:String(row.id),p_hours:q.requestedHours});
  const reducedMs=n(r?.reducedMs),newBalance=n(r?.newBalance,company.coins);if(reducedMs<=0)throw new Error('Zeit konnte nicht verkürzt werden');
  shiftKnownEndTimes(row.raw,-reducedMs,{floorMs:Date.now()});company.coins=newBalance;
  if((row.kind==='construction'||row.kind==='land')&&row.raw.buildingInstanceId){const room=company?.buildingState?.rooms?.find(x=>String(x.instanceId)===String(row.raw.buildingInstanceId));if(room&&timerEnd(room))shiftKnownEndTimes(room,-reducedMs,{floorMs:Date.now()});}
  if(row.kind==='machine_upgrade'&&row.raw.machineInstanceId){const machine=company?.buildingState?.equipment?.find(x=>String(x.instanceId)===String(row.raw.machineInstanceId));if(machine)shiftKnownEndTimes(machine,-reducedMs,{floorMs:Date.now()});}
  window.dispatchEvent(new CustomEvent('world:game-state-dirty',{detail:{reason:'secure-coin-time-reduction',kind:row.kind,id:row.id,costCoins:n(r?.costCoins),reducedMs}}));
  window.dispatchEvent(new CustomEvent('world:server-balances-changed',{detail:{coinBalance:newBalance}}));
  return{...r,reducedMs,newBalance};
 }finally{
  if(typeof window!=='undefined')window.worldCoinTimeReductionInFlight=false;
  if(saveLock&&sync)sync.saving=false;
  inFlight.delete(key);
  const saver=sync|| (typeof window!=='undefined'?window.worldAccounts?.gameStateSync:null);
  if(saver?.save)setTimeout(()=>saver.save().catch(()=>{}),0);
 }
}
export function runOperationCoinTimeReductionTest(){
 const now=1000000;
 const exactHour={kind:'production',id:'p0',remainingMs:60*60000,raw:{id:'p0',finishAt:now+60*60000}},h=fullOperationTimeReductionQuote(exactHour,{now});if(h.costCoins!==12||h.reducedMs!==60*60000)throw new Error('60 Minuten müssen exakt 12 Coins kosten');
 const sixtyOne={kind:'production',id:'p1',remainingMs:61*60000,raw:{id:'p1',finishAt:now+61*60000}},q=fullOperationTimeReductionQuote(sixtyOne,{now});if(q.costCoins!==13)throw new Error('61 Minuten müssen 13 Coins kosten');
 const five={kind:'delivery',id:'d0',remainingMs:5*60000,raw:{id:'d0',arrivalAt:now+5*60000}},f=fullOperationTimeReductionQuote(five,{now});if(f.costCoins!==1)throw new Error('5 Minuten müssen exakt 1 Coin kosten');
 const partial={kind:'delivery',id:'d1',remainingMs:5*60000+1,raw:{id:'d1',arrivalAt:now+5*60000+1}},p=fullOperationTimeReductionQuote(partial,{now});if(p.costCoins!==2)throw new Error('Angefangene zweite 5-Minuten-Einheit muss aufgerundet werden');
 const equipment={kind:'equipment',id:'eq1',remainingMs:20*60000,raw:{instanceId:'eq1',installationFinishAt:now+20*60000}};if(fullOperationTimeReductionQuote(equipment,{now}).costCoins!==4)throw new Error('Maschinenmontage verwendet nicht die 5-Minuten-Regel');
 return true;
}
if(typeof window!=='undefined')window.worldOperationCoinTimeReduction={canReduce:canReduceOperation,quote:operationTimeReductionQuote,fullQuote:fullOperationTimeReductionQuote,costForMs:coinCostForMs,rule:COIN_TIME_RULE_LABEL,reduce:reduceOperationTimeWithCoins,test:runOperationCoinTimeReductionTest};
