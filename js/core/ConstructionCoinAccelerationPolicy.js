// WorldProject - einheitliche Coin-Beschleunigung fuer Bau, Ausbau und Montage.
// Verbindliche ORVUNO-Regel: 1 Coin je angefangene 5 Minuten Zeitverkuerzung.
import { timeMs } from './TimeValueUtils.js';
export const CONSTRUCTION_COIN_POLICY=Object.freeze({
 minimumRealTimeRatio:0,
 maximumAcceleratedRatio:1,
 maximumHoursPerPurchase:10,
 minutesPerCoin:5,
 coinsPerHour:12,
 maximumCoinsPerPurchase:120
});

const num=v=>Number(v||0);
const explicitEnd=project=>timeMs(project?.upgradeFinishAt)||timeMs(project?.installationFinishAt)||timeMs(project?.finishAt)||timeMs(project?.busyUntil)||0;

export function constructionCoinAccelerationState(project,now=Date.now()){
 const startedAt=timeMs(project?.startedAt||project?.startTime||project?.createdAt);
 const originalDurationMs=Math.max(0,num(project?.originalDurationMs||project?.durationMs||project?.buildDurationMs));
 const acceleratedMs=Math.max(0,num(project?.coinAcceleratedMs));
 const naturalElapsedMs=startedAt?Math.max(0,num(now)-startedAt):0;
 const end=explicitEnd(project);
 const remainingMs=end?Math.max(0,end-num(now)):Math.max(0,originalDurationMs-naturalElapsedMs-acceleratedMs);
 const minimumRealMs=0,maximumAcceleratedMs=originalDurationMs,removableMs=remainingMs,effectiveElapsedMs=Math.max(0,originalDurationMs-remainingMs);
 return {startedAt,originalDurationMs,acceleratedMs,minimumRealMs,maximumAcceleratedMs,removableMs,naturalElapsedMs,effectiveElapsedMs,remainingMs,locked:remainingMs<=0};
}

export function constructionCoinAccelerationQuote(project,{hours=10,coins=null,now=Date.now()}={}){
 const state=constructionCoinAccelerationState(project,now);
 const requestedHours=Math.max(0,Math.min(CONSTRUCTION_COIN_POLICY.maximumHoursPerPurchase,num(hours)));
 const requestedMs=requestedHours*60*60*1000;
 const appliedMs=Math.min(requestedMs,state.removableMs,state.remainingMs);
 const appliedHours=appliedMs/3600000;
 const coinCost=appliedMs>0?Math.max(1,Math.ceil(appliedMs/(CONSTRUCTION_COIN_POLICY.minutesPerCoin*60000))):0;
 return {...state,requestedHours,appliedHours,appliedMs,coinCost,minimumRemainingRatio:0,canAccelerate:appliedMs>0,priceUnitMinutes:5,coinsPerUnit:1};
}

// Legacy-Laufzeithelfer. Sichtbare Spieleraktionen verwenden den serverautoritativen
// OperationCoinTimeReductionSystem-Pfad; diese Funktion bleibt fuer alte Runtime-Aufrufer kompatibel.
export function applyConstructionCoinAcceleration(project,company,options={}){
 const quote=constructionCoinAccelerationQuote(project,options);
 if(!quote.canAccelerate)throw new Error('Dieser Vorgang ist bereits fertig.');
 if(num(company?.coins)<quote.coinCost)throw new Error('Nicht genug Coins fuer diese Beschleunigung.');
 company.coins=num(company.coins)-quote.coinCost;
 project.originalDurationMs=quote.originalDurationMs;
 project.coinAcceleratedMs=quote.acceleratedMs+quote.appliedMs;
 project.coinAccelerationPolicy='one-coin-per-started-five-minutes';
 project.coinAccelerationPurchases=num(project.coinAccelerationPurchases)+1;
 return {project,company,quote};
}

export function ensureConstructionTiming(project,{startedAt=Date.now(),durationMs}={}){
 if(!project)return project;
 if(!timeMs(project.startedAt)&&!timeMs(project.startTime))project.startedAt=startedAt;
 if(!num(project.originalDurationMs))project.originalDurationMs=Math.max(0,num(durationMs||project.durationMs||project.buildDurationMs));
 if(!num(project.durationMs)&&num(project.originalDurationMs))project.durationMs=project.originalDurationMs;
 project.coinAcceleratedMs=Math.max(0,num(project.coinAcceleratedMs));
 return project;
}

export function runConstructionCoinAccelerationPolicyTest(){
 const now=1_000_000,duration=60*60000,project={startedAt:now,originalDurationMs:duration,durationMs:duration,installationFinishAt:now+duration,coinAcceleratedMs:0},company={coins:100};
 const q=constructionCoinAccelerationQuote(project,{hours:1,now});if(q.coinCost!==12||q.appliedMs!==duration)throw new Error('60 Minuten Montage muessen 12 Coins kosten');
 const p={startedAt:now,originalDurationMs:61*60000,durationMs:61*60000,finishAt:now+61*60000,coinAcceleratedMs:0};if(constructionCoinAccelerationQuote(p,{hours:2,now}).coinCost!==13)throw new Error('61 Minuten muessen 13 Coins kosten');
 applyConstructionCoinAcceleration(project,company,{hours:1,now});if(company.coins!==88)throw new Error('5-Minuten-Coinrate wird im Legacy-Helfer nicht eingehalten');return true;
}
