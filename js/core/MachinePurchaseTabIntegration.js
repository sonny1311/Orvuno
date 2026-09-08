// WorldProject – zentraler Maschinenkauf als eigener Reiter der bestehenden Betriebsverwaltung.
// Nutzt ausschließlich IndustryEquipmentMarketplace und OperationalSupplyChainDialog.
import './IndustryEquipmentCatalogSupplement.js';
import { OperationalSupplyChainDialog } from './OperationalSupplyChainDialog.js';
import { EconomyDashboard } from './EconomyDashboard.js';
import { visibleEquipmentMarketplace,buyIndustryEquipment,upgradeIndustryEquipment,persistIndustryEquipment,repairDuplicateIndustryEquipment,equipmentInstallationHours,MAX_EQUIPMENT_LEVEL } from './IndustryEquipmentMarketplace.js';
import { recipesForCompany } from './OperationalSupplyChainSystem.js';
import { compatibleMachineIds } from './IndustryMachineCompatibility.js';
import { coinCostForMs } from './OperationCoinTimeReductionSystem.js';

const SECTION_TITLES={
  buy:['Rohstoffe & Verpackung einkaufen'],
  deliveries:['Laufende Lieferungen'],
  warehouse:['Lagerbestand'],
  machines:['Maschinenkauf'],
  production:['Produktionsplanung','Produktionswarteschlange']
};
const WINDOW_TITLES={
  buy:'📦 Einkauf',deliveries:'🚚 Lieferungen & Transporte',warehouse:'🏬 Lager',machines:'⚙️ Maschinenkauf',production:'🏗️ Produktion'
};

function applySectionFocus(dialog,section){
  const overlay=dialog?.overlay,wanted=SECTION_TITLES[section];
  if(!overlay||!wanted)return false;
  const h2=overlay.querySelector('h2');if(h2)h2.textContent=WINDOW_TITLES[section]||'📦 Betrieb';
  overlay.querySelectorAll('section').forEach(sec=>{
    const text=sec.querySelector('h3')?.textContent||'';
    sec.style.display=wanted.some(title=>text.includes(title))?'':'none';
  });
  overlay.querySelectorAll('[data-operational-tab]').forEach(btn=>{
    const active=btn.dataset.operationalTab===section;
    btn.setAttribute('aria-pressed',active?'true':'false');
    Object.assign(btn.style,{fontWeight:active?'800':'600',outline:active?'2px solid #60a5fa':'none',background:active?'#1e3a5f':'#1e293b',color:'#f8fafc',border:'1px solid #64748b'});
  });
  return true;
}

function machineUsage(company,item,recipes){
  return recipes.filter(recipe=>compatibleMachineIds(company,recipe.machineType).includes(item.id)).map(recipe=>recipe.label||recipe.id);
}
function remainingLabel(ms){const min=Math.max(0,Math.ceil(Number(ms||0)/60000));if(min<60)return`${min} Min.`;const h=Math.floor(min/60),m=min%60;return`${h} Std.${m?` ${m} Min.`:''}`;}
function performanceLabel(multiplier){return`${Math.round(Number(multiplier||1)*100)} % Leistung`;}
function coinLabel(ms){const cost=coinCostForMs(ms);return`${cost} Coin${cost===1?'':'s'}`;}

function purchaseSnapshot(company){
  return {
    money:Number(company.money||0),
    coins:Number(company.coins||0),
    setupPhase:company.setupPhase,
    setup_phase:company.setup_phase,
    buildingState:structuredClone(company.buildingState||company.building_state||{}),
    costLedger:structuredClone(company.costLedger||[]),
    financialLog:structuredClone(company.financialLog||[]),
    requestIds:structuredClone(company.equipmentPurchaseRequestIds||[])
  };
}
function restorePurchaseSnapshot(company,snapshot){
  company.money=snapshot.money;
  company.coins=snapshot.coins;
  company.setupPhase=snapshot.setupPhase;
  company.setup_phase=snapshot.setup_phase;
  company.buildingState=snapshot.buildingState;
  company.costLedger=snapshot.costLedger;
  company.financialLog=snapshot.financialLog;
  company.equipmentPurchaseRequestIds=snapshot.requestIds;
}

function renderMachineMarket(dialog,panel,company,recipes){
  const repair=repairDuplicateIndustryEquipment(company);
  if(repair.repaired){
    persistIndustryEquipment(company).catch(error=>console.error('❌ Maschinen-Duplikatkorrektur konnte nicht gespeichert werden',error));
    window.dispatchEvent(new CustomEvent('world:game-state-dirty',{detail:{reason:'equipment-duplicate-repair',removed:repair.removed.length,refund:repair.refund}}));
  }
  const section=dialog.el('section');section.className='world-machine-purchase-section';
  section.append(dialog.el('h3','Maschinenkauf'),dialog.el('p','Hier findest du zentral alle Maschinen und Betriebsausstattungen für deinen aktuellen Betriebslevel. Neue Maschinen müssen montiert werden; vorhandene Maschinen können bis Stufe 5 aufgerüstet werden und erhalten je Stufe mehr Produktionsleistung. Zeitverkürzung ist optional: Du wählst selbst die Coin-Anzahl, 1 Coin je angefangene 5 Minuten Restzeit, 60 Minuten = 12 Coins. Normales Warten bleibt kostenlos.'));
  if(repair.repaired){const note=dialog.el('div',`✅ ${repair.removed.length} doppelte Maschineninstanz${repair.removed.length===1?'':'en'} bereinigt${repair.refund>0?` · ${dialog.money(repair.refund)} zurückerstattet`:''}.`);Object.assign(note.style,{padding:'9px 11px',margin:'8px 0',borderRadius:'8px',background:'#eef8ee',fontWeight:'700'});section.append(note);}
  const market=visibleEquipmentMarketplace(company).sort((a,b)=>Number(b.required&&!b.owned)-Number(a.required&&!a.owned)||Number(a.owned)-Number(b.owned)||Number(a.price||0)-Number(b.price||0));
  if(!market.length){section.append(dialog.el('p','Für dieses Gewerbe sind auf deinem aktuellen Betriebslevel noch keine kaufbaren Maschinen verfügbar.'));panel.append(section);return;}
  for(const item of market){
    const row=dialog.el('div');Object.assign(row.style,{border:'1px solid #d7d7d7',borderRadius:'10px',padding:'11px',margin:'8px 0',background:item.working?'#eff6ff':item.owned?'#f3fbf3':'#fafafa'});
    const top=dialog.el('div');Object.assign(top.style,{display:'flex',justifyContent:'space-between',gap:'12px',alignItems:'center',flexWrap:'wrap'});
    const name=dialog.el('strong',item.name||item.label||item.id);const status=dialog.el('strong',item.installing?'🔧 Montage läuft':item.upgrading?`⬆️ Aufrüstung auf Stufe ${item.ownedInstance?.pendingUpgradeLevel||item.level+1}`:item.owned?`✅ Betriebsbereit · Stufe ${item.level}`:item.required?'🔴 Für Betrieb benötigt':'⚙️ Verfügbar');top.append(name,status);row.append(top);
    const usage=machineUsage(company,item,recipes);const details=[];
    if(item.description)details.push(item.description);
    if(item.capacity)details.push(`Grundkapazität: ${dialog.number(item.capacity)} ${item.capacityUnit||'Einheiten/h'}`);
    if(item.owned)details.push(`Aktuell: ${performanceLabel(1+(Math.max(1,Number(item.level||1))-1)*.15)}`);
    if(item.room)details.push(`Bereich: ${item.room==='production'?'Produktion':item.room==='storage'?'Lager':item.room}`);
    if(item.requiredLevel>1)details.push(`Freigeschaltet ab Betriebslevel ${item.requiredLevel}`);
    if(usage.length)details.push(`Benötigt für: ${usage.join(', ')}`);
    if(item.working){const remainingMs=Math.max(0,Number(item.installation?.remainingMs||0));details.push(`${item.upgrading?'Aufrüstungs':'Montage'}-Restzeit: ${remainingLabel(remainingMs)}`);details.push(`🪙 Ganz fertig: ${coinLabel(remainingMs)} · Teilverkürzung frei wählbar`);}
    if(item.owned&&!item.working&&item.upgrade?.available){const upgradeMs=Number(item.upgrade.hours||0)*3600000;details.push(`Nächste Stufe ${item.upgrade.targetLevel}: ${performanceLabel(item.upgrade.performanceAfter)} · ${dialog.money(item.upgrade.cost)} · ${item.upgrade.hours} Std. · 🪙 ganz fertig nach Start ${coinLabel(upgradeMs)} · Teilverkürzung frei wählbar`);}
    if(!item.owned){const installMs=equipmentInstallationHours(item)*3600000;details.push(`Montagezeit: ${remainingLabel(installMs)} · 🪙 ganz fertig nach Kauf ${coinLabel(installMs)} · Teilverkürzung frei wählbar`);}
    if(item.owned&&!item.working&&!item.upgrade?.available)details.push(`Maximalstufe ${MAX_EQUIPMENT_LEVEL} erreicht`);
    if(details.length){const info=dialog.el('div',details.join(' · '));Object.assign(info.style,{margin:'6px 0',fontSize:'13px',lineHeight:'1.45'});row.append(info);}
    const price=dialog.el('strong',item.working?`${item.upgrading?'Aufrüstung':'Montage'} läuft · noch nicht einsatzbereit`:item.owned?'Bereits gekauft':dialog.money(item.price));Object.assign(price.style,{marginRight:'8px'});row.append(price);
    // Laufende Montage/Aufrüstung wird zentral durch CoinTimeAccelerationUIIntegration dekoriert.
    // Dadurch gilt hier dieselbe frei wählbare Coin-Menge wie bei Produktion, Lieferungen und allen anderen Timern.
    if(item.owned&&!item.working&&item.upgrade?.available){
      const upgrade=dialog.btn(`⬆️ Auf Stufe ${item.upgrade.targetLevel} aufrüsten · ${dialog.money(item.upgrade.cost)}`,async()=>{
        const snapshot=purchaseSnapshot(company);upgrade.disabled=true;
        try{
          const result=upgradeIndustryEquipment(company,item.ownedInstance.instanceId,{now:Date.now()});
          const persisted=await persistIndustryEquipment(company);
          if(persisted?.persisted===false&&company.serverCompanyId)throw new Error(persisted.reason||'Maschinenaufrüstung konnte nicht gespeichert werden');
          dialog.ensureMachines(company);dialog.__worldFocusedSection='machines';dialog.render(panel);
          window.dispatchEvent(new CustomEvent('world:game-state-dirty',{detail:{reason:'equipment-upgrade',equipmentId:item.id,fromLevel:result.quote.currentLevel,toLevel:result.quote.targetLevel,cost:result.quote.cost}}));
        }catch(error){restorePurchaseSnapshot(company,snapshot);upgrade.disabled=false;alert(`Aufrüstung nicht durchgeführt: ${error.message}`);}
      });
      upgrade.disabled=Number(company.money||0)<Number(item.upgrade.cost||0);upgrade.title=upgrade.disabled?'Firmenkonto reicht für diese Aufrüstung nicht aus':`Stufe ${item.level} → ${item.upgrade.targetLevel}: Produktionsleistung steigt von ${performanceLabel(item.upgrade.performanceBefore)} auf ${performanceLabel(item.upgrade.performanceAfter)}`;row.append(upgrade);
    }
    if(!item.owned){
      const button=dialog.btn(item.affordable?'Kaufen':'Nicht genug Geld',async()=>{
        const snapshot=purchaseSnapshot(company);
        button.disabled=true;
        try{
          buyIndustryEquipment(company,item.id,{requestId:`machine-tab-${item.id}-${Date.now()}`});
          const persisted=await persistIndustryEquipment(company);
          if(persisted?.persisted===false&&company.serverCompanyId)throw new Error(persisted.reason||'Maschinenkauf konnte nicht gespeichert werden');
          dialog.ensureMachines(company);
          dialog.__worldFocusedSection='machines';
          dialog.render(panel);
          window.dispatchEvent(new CustomEvent('world:game-state-dirty',{detail:{reason:'equipment-purchase',equipmentId:item.id}}));
        }catch(error){
          restorePurchaseSnapshot(company,snapshot);
          button.disabled=false;
          alert(`Kauf nicht durchgeführt: ${error.message}`);
        }
      });
      button.disabled=!item.affordable;button.title=item.affordable?`${item.name||item.id} kaufen`:'Firmenkonto reicht für diese Maschine nicht aus';row.append(button);
    }
    section.append(row);
  }
  panel.append(section);
}

function pinTabBar(panel,bar){
  const head=panel?.firstElementChild;
  const headHeight=Math.max(58,Math.ceil(head?.getBoundingClientRect?.().height||0));
  Object.assign(bar.style,{position:'sticky',top:`${headHeight}px`,zIndex:'300009',background:'#111827',padding:'8px 0',borderBottom:'1px solid #475569',boxShadow:'0 5px 12px rgba(0,0,0,.35)'});
  return headHeight;
}

function addTabBar(dialog,panel){
  panel.querySelector('.world-operational-tabbar')?.remove();
  const head=panel.firstElementChild,bar=dialog.el('div');bar.className='world-operational-tabbar';Object.assign(bar.style,{display:'flex',gap:'6px',flexWrap:'wrap'});
  const tabs=[['buy','📦 Einkauf'],['deliveries','🚚 Lieferungen'],['warehouse','🏬 Lager'],['machines','⚙️ Maschinenkauf'],['production','🏗️ Produktion']];
  for(const [key,label] of tabs){const btn=dialog.btn(label,()=>{dialog.__worldFocusedSection=key;applySectionFocus(dialog,key);});btn.dataset.operationalTab=key;Object.assign(btn.style,{background:'#1e293b',color:'#f8fafc',border:'1px solid #64748b'});bar.append(btn);}
  if(head?.nextSibling)panel.insertBefore(bar,head.nextSibling);else panel.append(bar);
  pinTabBar(panel,bar);
  requestAnimationFrame(()=>pinTabBar(panel,bar));
}

const dialogProto=OperationalSupplyChainDialog.prototype;
if(!dialogProto.__worldMachinePurchaseTabIntegrated){
  dialogProto.__worldMachinePurchaseTabIntegrated=true;
  const originalRender=dialogProto.render;
  dialogProto.render=function(panel,...args){
    const result=originalRender.call(this,panel,...args),company=this.companyProvider();
    if(company){
      let recipes=[];try{recipes=recipesForCompany(company);}catch{}
      renderMachineMarket(this,panel,company,recipes);
      addTabBar(this,panel);
      if(this.__worldFocusedSection)applySectionFocus(this,this.__worldFocusedSection);
    }
    return result;
  };
}

const dashboardProto=EconomyDashboard.prototype;
if(!dashboardProto.__worldMachinePurchaseTabDashboardIntegrated){
  dashboardProto.__worldMachinePurchaseTabDashboardIntegrated=true;
  const originalFocus=dashboardProto.focusOperationalDialog;
  dashboardProto.focusOperationalDialog=function(section='buy'){
    if(['warehouse','machines'].includes(section)){
      const dialog=window.worldOperationalSupplyChainDialog;if(dialog)dialog.__worldFocusedSection=section;
      const result=applySectionFocus(dialog,section);return result;
    }
    const result=originalFocus.call(this,section);applySectionFocus(window.worldOperationalSupplyChainDialog,section);return result;
  };
  const originalRender=dashboardProto.render;
  dashboardProto.render=function(panel){
    const result=originalRender.call(this,panel),card=panel.querySelector('#dashboard-production');
    if(card&&!card.querySelector('.world-machine-market-button')){
      const button=this.button('⚙️ Maschinenkauf',()=>this.openOperationalSupplyChain('machines'));button.classList.add('world-machine-market-button');card.append(button);
    }
    return result;
  };
}

export { applySectionFocus,machineUsage,purchaseSnapshot,restorePurchaseSnapshot,pinTabBar,remainingLabel,performanceLabel };
if(typeof window!=='undefined')window.worldMachinePurchaseTab={applySectionFocus,machineUsage,pinTabBar,remainingLabel,performanceLabel};
