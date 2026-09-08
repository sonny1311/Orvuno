// ORVUNO - Premium-Zeitvorteil als zentrale Laufzeitregel.
// Aktives Premium reduziert die Restzeit jedes echten Betriebs-Timers einmalig um 25 %.
// Dadurch gilt derselbe Vorteil fuer Produktion, Lieferungen, Bau, Montage, Upgrades,
// Wartung, Lagerausbau und Bautrupp-Anfahrten. Kunden-Lieferfristen werden bewusst NICHT
// verkuerzt, weil das ein Nachteil fuer den Spieler waere.
import { PremiumEntitlementSystem } from './PremiumEntitlementSystem.js';
import { activeOperationsSummary } from './ActiveOperationsOverview.js';
import { timerEnd,shiftKnownEndTimes } from './TimeValueUtils.js';

const premium=new PremiumEntitlementSystem();
const ELIGIBLE_KINDS=new Set([
 'production','delivery','construction','land','warehouse_expansion',
 'machine_upgrade','business_upgrade','equipment','maintenance','crew_arrival'
]);
const currentAccount=()=>window.worldCurrentUser||window.worldAccount||window.worldPlayerAccount||window.worldUserAccount||{};
const currentCompany=()=>window.worldPlayerCompany||window.worldActiveServerCompany||window.worldEconomyGameplay?.company||null;

export function premiumTimeState(now=Date.now()){
 const account=currentAccount();
 return {account,...premium.state(account,now),multiplier:premium.timeMultiplier(account,now)};
}

export function applyPremiumTimeToRow(row,{now=Date.now()}={}){
 if(!row?.raw||!ELIGIBLE_KINDS.has(String(row.kind||'')))return{changed:false,reason:'not_eligible'};
 const state=premiumTimeState(now);
 if(!state.active)return{changed:false,reason:'premium_inactive'};
 const raw=row.raw;
 if(raw.premiumTimeApplied===true||Number(raw.premiumTimeMultiplier)===.75)return{changed:false,reason:'already_applied'};
 const endInfo=timerEnd(raw),end=Number(endInfo?.value||0);
 if(!(end>now))return{changed:false,reason:'no_active_timer'};
 const remaining=end-now;
 const reducedRemaining=Math.max(0,Math.round(remaining*.75));
 const nextEnd=now+reducedRemaining;
 const delta=nextEnd-end;
 if(!(delta<0))return{changed:false,reason:'no_reduction'};
 // shiftKnownEndTimes keeps parallel ETA/finish fields in sync.
 shiftKnownEndTimes(raw,delta,{floorMs:now});
 raw.premiumTimeApplied=true;
 raw.premiumTimeMultiplier=.75;
 raw.premiumTimeAppliedAt=now;
 raw.premiumTimeOriginalRemainingMs=remaining;
 raw.premiumTimeReducedMs=Math.max(0,remaining-reducedRemaining);
 raw.premiumTimeBenefitLabel='Premium: 25 % schneller';
 return{changed:true,kind:row.kind,id:row.id,reducedMs:raw.premiumTimeReducedMs,newRemainingMs:reducedRemaining};
}

export function applyPremiumTimeToCompany(company=currentCompany(),{now=Date.now(),persist=true}={}){
 if(!company)return{changed:0,rows:[],reason:'no_company'};
 const state=premiumTimeState(now);
 if(!state.active)return{changed:0,rows:[],reason:'premium_inactive'};
 const rows=activeOperationsSummary(company,now).rows||[];
 const results=[];
 for(const row of rows){const result=applyPremiumTimeToRow(row,{now});if(result.changed)results.push(result);}
 if(results.length&&persist){
  try{window.dispatchEvent(new CustomEvent('world:game-state-dirty',{detail:{reason:'premium-time-25-percent',count:results.length}}));}catch{}
 }
 return{changed:results.length,rows:results,reason:results.length?'applied':'nothing_new'};
}

function premiumBadgeText(){return '⭐ Premium aktiv: alle laufenden Betriebszeiten 25 % kürzer';}
function decorateVisiblePremiumTime(){
 const state=premiumTimeState();
 for(const root of document.querySelectorAll('.world-operational-tabbar, [data-active-operations], .world-machine-purchase-section')){
  const old=root.parentElement?.querySelector?.('[data-orvuno-premium-time-badge]');
  if(!state.active){old?.remove();continue;}
  if(old)continue;
  const badge=document.createElement('div');badge.dataset.orvunoPremiumTimeBadge='1';badge.textContent=premiumBadgeText();
  Object.assign(badge.style,{margin:'8px 0',padding:'8px 10px',borderRadius:'8px',border:'1px solid #a78bfa',background:'rgba(76,29,149,.22)',fontWeight:'900',fontSize:'12px'});
  root.parentElement?.insertBefore(badge,root.nextSibling);
 }
}

let timer=null;
export function installPremiumUniversalTimeAcceleration(){
 if(typeof window==='undefined')return false;
 const run=()=>{try{applyPremiumTimeToCompany();decorateVisiblePremiumTime();}catch(error){console.warn('Premium-Zeitvorteil konnte nicht angewendet werden',error);}};
 const events=[
  'worldproject:company-loaded','worldproject:company-founded','worldproject:company-switched','worldproject:company-activated',
  'world:game-state-dirty','world:premium-updated','world:payment-return','world:monetization-updated'
 ];
 for(const eventName of events)window.addEventListener(eventName,()=>setTimeout(run,0));
 timer=setInterval(run,1000);
 setTimeout(run,0);
 return true;
}

export function runPremiumUniversalTimeAccelerationTest(){
 const now=Date.parse('2026-09-08T12:00:00Z');
 const oldCurrent=globalThis.window?.worldCurrentUser;
 if(typeof window!=='undefined')window.worldCurrentUser={premiumUntil:new Date(now+86400000).toISOString(),premiumPlan:'premium_basic'};
 const raw={id:'d1',status:'in_transit',orderedAt:now-1000,arrivalAt:now+3600000,eta:now+3600000};
 const result=applyPremiumTimeToRow({kind:'delivery',id:'d1',raw},{now});
 const expected=now+2700000;
 if(!result.changed||Number(raw.arrivalAt)!==expected||Number(raw.eta)!==expected||raw.premiumTimeMultiplier!==.75)throw new Error('Premium-Zeitverkürzung fehlerhaft');
 const second=applyPremiumTimeToRow({kind:'delivery',id:'d1',raw},{now});
 if(second.changed)throw new Error('Premium-Zeitverkürzung darf nicht mehrfach angewendet werden');
 const deadline={id:'c1',status:'open',createdAt:now-1000,dueAt:now+3600000};
 const customer=applyPremiumTimeToRow({kind:'customer_order',id:'c1',raw:deadline},{now});
 if(customer.changed)throw new Error('Premium darf Kundenfristen nicht verkuerzen');
 if(typeof window!=='undefined')window.worldCurrentUser=oldCurrent;
 return true;
}

if(typeof window!=='undefined'){
 window.worldPremiumUniversalTime={apply:applyPremiumTimeToCompany,state:premiumTimeState,test:runPremiumUniversalTimeAccelerationTest};
 installPremiumUniversalTimeAcceleration();
}
