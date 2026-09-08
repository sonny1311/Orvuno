// WorldProject - robuste Zeitwert-Helfer fuer gespeicherte/geladene Spielstaende.
// Akzeptiert Date, Millisekunden-Zahlen und ISO-Zeitstrings einheitlich.

export function timeMs(value,fallback=0){
 if(value instanceof Date){const t=value.getTime();return Number.isFinite(t)?t:fallback;}
 const direct=Number(value);if(Number.isFinite(direct)&&direct>0)return direct;
 if(typeof value==='string'&&value.trim()){const parsed=Date.parse(value);if(Number.isFinite(parsed)&&parsed>0)return parsed;}
 return fallback;
}

export const TIMER_END_KEYS=Object.freeze([
 'finishAt','completeAt','arrivalAt','arrivalTime','arriveAt','arrivesAt','deliveryAt','trafficEta','eta','endsAt','expectedAt',
 'readyAt','availableAt','installationFinishAt','upgradeFinishAt','busyUntil'
]);
export const TIMER_START_KEYS=Object.freeze([
 'startedAt','createdAt','orderedAt','departureTime','departAt','bookedAt','installationStartedAt','upgradeStartedAt','started_at','created_at'
]);

export function timerEnd(row={}){for(const key of TIMER_END_KEYS){const value=timeMs(row?.[key]);if(value>0)return{key,value};}return null;}
export function timerStart(row={}){for(const key of TIMER_START_KEYS){const value=timeMs(row?.[key]);if(value>0)return{key,value};}return null;}

export function writeTimeValue(target,key,nextMs){
 if(!target||!key)return false;const old=target[key];
 if(old instanceof Date)target[key]=new Date(nextMs);
 else if(typeof old==='string'&&Number.isNaN(Number(old))&&Number.isFinite(Date.parse(old)))target[key]=new Date(nextMs).toISOString();
 else target[key]=nextMs;
 return true;
}

export function shiftKnownEndTimes(row,deltaMs,{excludeKey=null,floorMs=0}={}){
 if(!row||!Number.isFinite(Number(deltaMs))||Number(deltaMs)===0)return 0;let changed=0;
 for(const key of TIMER_END_KEYS){if(key===excludeKey)continue;const value=timeMs(row[key]);if(!(value>0))continue;writeTimeValue(row,key,Math.max(Number(floorMs)||0,value+Number(deltaMs)));changed++;}
 return changed;
}

export function runTimeValueUtilsTest(){
 const iso='2026-08-14T12:00:00.000Z',ms=Date.parse(iso),row={startedAt:new Date(ms-1000).toISOString(),arrivalAt:iso};
 if(timeMs(iso)!==ms||timerEnd(row)?.value!==ms||timerStart(row)?.value!==ms-1000)throw new Error('Persistierte Zeitwerte werden nicht erkannt');
 writeTimeValue(row,'arrivalAt',ms-5000);if(Date.parse(row.arrivalAt)!==ms-5000)throw new Error('ISO-Zeitformat wird beim Schreiben nicht erhalten');
 const market={departureTime:new Date(ms-2000),arrivalTime:new Date(ms+3000)};if(timerStart(market)?.value!==ms-2000||timerEnd(market)?.value!==ms+3000)throw new Error('Marktlieferzeiten werden nicht erkannt');
 const constructionDelivery={orderedAt:ms-5000,arrivesAt:ms+9000};if(timerEnd(constructionDelivery)?.value!==ms+9000)throw new Error('Baumaterial-Lieferzeit wird nicht erkannt');
 const equipment={installationStartedAt:ms-1000,installationFinishAt:ms+12000};if(timerStart(equipment)?.value!==ms-1000||timerEnd(equipment)?.value!==ms+12000)throw new Error('Maschinenmontage-Zeit wird nicht erkannt');
 const crew={bookedAt:ms-1000,availableAt:ms+7000};if(timerStart(crew)?.value!==ms-1000||timerEnd(crew)?.value!==ms+7000)throw new Error('Bautrupp-Anfahrtszeit wird nicht erkannt');
 return true;
}
