// ORVUNO - Lagerausbau darf nicht als scheinbar toter/gesperrter Button enden.
// Der Button bleibt anklickbar und erklaert bzw. startet den naechsten sinnvollen Schritt.
import { UniversalOperationsDialog } from './UniversalOperationsDialog.js';
import { warehouseExpansionOverview, startWarehouseExpansion } from './WarehouseConstructionExpansionSystem.js';

const old=UniversalOperationsDialog.prototype.render_expansion;
const money=v=>Number(v||0).toLocaleString('de-DE',{style:'currency',currency:'EUR'});
const mins=m=>{m=Math.max(0,Math.ceil(Number(m||0)));return m>=60?`${Math.floor(m/60)} Std. ${m%60} Min.`:`${m} Min.`;};

UniversalOperationsDialog.prototype.render_expansion=function(body,c){
  if(typeof old==='function')old.call(this,body,c);
  if(!c||!body)return;
  const sections=[...body.querySelectorAll('section')];
  const section=sections.find(s=>/Lagerausbau/i.test(s.textContent||''));
  if(!section)return;
  const o=warehouseExpansionOverview(c),q=o.next;
  let action=section.querySelector('[data-orvuno-warehouse-expand-action]');
  if(!action){
    action=document.createElement('button');
    action.dataset.orvunoWarehouseExpandAction='1';
    action.style.cssText='display:block;margin-top:12px;padding:10px 14px;font-weight:900;cursor:pointer';
    section.append(action);
  }
  const freeCrew=(o.bookings||[]).find(x=>x.status==='booked'&&Number(x.availableAt||0)<=Date.now()&&Number(x.assignedUntil||0)<=Date.now());
  const enRoute=(o.bookings||[]).find(x=>x.status==='booked'&&Number(x.availableAt||0)>Date.now());
  const missing=(o.materials||[]).filter(x=>Number(x.missing||0)>0);
  const crewCost=freeCrew?Math.round(Number(freeCrew.dailyCost||0)*Math.max(1,Number(q.baseDurationMinutes||0)/Math.max(.1,Number(freeCrew.speedFactor||1))/1440)):0;
  const estimatedTotal=Number(q.buildCost||0)+crewCost;

  if(o.active)action.textContent=`🏗️ Lagerausbau läuft · noch ca. ${mins((Number(o.active.finishAt||0)-Date.now())/60000)}`;
  else if(!q.landAvailable)action.textContent='🌍 Lager ausbauen – zuerst Grundstück erweitern';
  else if(missing.length)action.textContent=`🚚 Lager ausbauen – ${missing.length} Materialart${missing.length===1?'':'en'} fehlt/fehlen`;
  else if(enRoute&&!freeCrew)action.textContent=`👷 Lager ausbauen – Bautrupp noch ${mins((Number(enRoute.availableAt)-Date.now())/60000)} unterwegs`;
  else if(!freeCrew)action.textContent='👷 Lager ausbauen – zuerst Bautrupp buchen';
  else if(Number(c.money||0)<estimatedTotal)action.textContent=`💶 Lager ausbauen – ca. ${money(estimatedTotal)} benötigt`;
  else action.textContent=`🏬 Lager jetzt ausbauen (+${q.addSlots} Plätze)`;
  action.disabled=false;

  action.onclick=()=>{
    try{
      const live=warehouseExpansionOverview(c),next=live.next;
      if(live.active){alert('Der Lagerausbau läuft bereits.');return;}
      if(!next.landAvailable){alert(`Für den Lagerausbau fehlen Grundstücksflächen. Benötigt: ${next.requiredSqm} m², frei: ${next.freeSqm} m². Bitte oben zuerst „Grundstück erweitern“ verwenden.`);return;}
      const miss=(live.materials||[]).filter(x=>Number(x.missing||0)>0);
      if(miss.length){alert('Für den Lagerausbau fehlt noch Baumaterial:\n\n'+miss.map(x=>`${x.label}: ${x.missing} ${x.unit}`).join('\n')+'\n\nDie Bestellbuttons stehen direkt im Abschnitt Lagerausbau.');return;}
      const crew=(live.bookings||[]).find(x=>x.status==='booked'&&Number(x.availableAt||0)<=Date.now()&&Number(x.assignedUntil||0)<=Date.now());
      if(!crew){const inbound=(live.bookings||[]).find(x=>x.status==='booked'&&Number(x.availableAt||0)>Date.now());if(inbound){alert(`Der Bautrupp ist noch unterwegs. Verfügbar in ca. ${mins((Number(inbound.availableAt)-Date.now())/60000)}.`);}else{alert('Es ist kein freier Bautrupp gebucht. Bitte oben im Bautrupp-Markt einen Trupp buchen.');}return;}
      const job=startWarehouseExpansion(c,{crewBookingId:crew.id});
      alert(`Lagerausbau gestartet. +${job.addSlots} Palettenplätze nach Fertigstellung.`);
      window.dispatchEvent(new CustomEvent('world:game-state-dirty'));
      this.render();
    }catch(error){alert(error?.message||String(error));}
  };
};

if(typeof window!=='undefined')window.worldWarehouseExpansionUsabilityFix=true;
