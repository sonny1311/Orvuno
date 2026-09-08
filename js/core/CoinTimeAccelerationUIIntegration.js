// ORVUNO – sichtbare Coin-Zeitverkürzung an allen wichtigen zeitbasierten Spielflächen.
// Wird absichtlich erst nach dem kompletten Bootstrap installiert, damit bestehende UI-Wrapper
// nicht verdrängt werden. Verbindliche Regel: 1 Coin je angefangene 5 Minuten Restzeit.
let installed=false;
let modules=null;
const text=v=>String(v||'').replace(/\s+/g,' ').trim();
const company=()=>window.worldPlayerCompany||window.worldEconomyGameplay?.company||window.worldEngine?.company||null;
const costLabel=n=>`${n} Coin${Number(n)===1?'':'s'}`;

async function loadModules(){
 if(modules)return modules;
 const [ops,time,dialogMod,dashMod,universalMod,equipmentMod,maintenanceMod,activeMod]=await Promise.all([
  import('./OperationCoinTimeReductionSystem.js'),import('./TimeValueUtils.js'),import('./OperationalSupplyChainDialog.js'),import('./EconomyDashboard.js'),import('./UniversalOperationsDialog.js'),import('./IndustryEquipmentMarketplace.js'),import('./MachineMaintenanceSystem.js'),import('./ActiveOperationsOverview.js')
 ]);
 modules={ops,time,OperationalSupplyChainDialog:dialogMod.OperationalSupplyChainDialog,EconomyDashboard:dashMod.EconomyDashboard,UniversalOperationsDialog:universalMod.UniversalOperationsDialog,equipmentMod,maintenanceMod,activeMod};return modules;
}
function rowFor(kind,raw,id=null){
 const end=modules?.time?.timerEnd(raw)?.value||0,now=Date.now();return{kind,id:id??raw?.id??raw?.instanceId??null,raw,remainingMs:Math.max(0,end-now)};
}
function removeOldAcceleration(container){
 for(const button of container?.querySelectorAll?.('button')||[]){const t=text(button.textContent).toLowerCase();if(t.includes('beschleunigen')&& !button.dataset.orvunoCoinTimeButton)button.remove();}
 for(const div of container?.querySelectorAll?.('div')||[]){const t=text(div.textContent);if(t.startsWith('Coin-Regel:')||t.includes('letzten 25 % der ursprünglichen Arbeitszeit'))div.remove();}
}
function appendControl(container,row,c,{onDone=null,compact=false}={}){
 if(!container||!row?.id||!modules?.ops?.canReduceOperation(row))return null;
 let wrap=container.querySelector?.(`:scope > [data-orvuno-coin-time-control="${CSS.escape(String(row.kind)+':'+String(row.id))}"]`);
 if(!wrap){wrap=document.createElement('div');wrap.dataset.orvunoCoinTimeControl=`${row.kind}:${row.id}`;Object.assign(wrap.style,{display:'flex',alignItems:'center',gap:'8px',flexWrap:'wrap',marginTop:'9px',padding:'9px 10px',borderRadius:'8px',border:'1px solid #8a6b16',background:'rgba(99,72,8,.20)',color:'inherit'});container.append(wrap);}
 const fresh=rowFor(row.kind,row.raw,row.id);if(!modules.ops.canReduceOperation(fresh)){wrap.remove();return null;}
 const quote=modules.ops.fullOperationTimeReductionQuote(fresh),coins=Number(c?.coins||0);wrap.innerHTML='';
 const info=document.createElement(compact?'span':'div');info.dataset.orvunoCoinTimeInfo='1';info.textContent=`🪙 ${modules.ops.COIN_TIME_RULE_LABEL} · Sofort fertig: ${costLabel(quote.costCoins)}`;Object.assign(info.style,{fontSize:compact?'12px':'13px',fontWeight:'800',lineHeight:'1.4',flex:'1 1 230px'});
 const button=document.createElement('button');button.type='button';button.dataset.orvunoCoinTimeButton='1';button.textContent=`⚡ Sofort fertig · ${costLabel(quote.costCoins)}`;Object.assign(button.style,{padding:'7px 10px',borderRadius:'7px',border:'1px solid #d6a52d',background:'#2a210b',color:'#f7c95d',fontWeight:'900',cursor:'pointer'});button.disabled=coins<quote.costCoins;if(button.disabled){button.style.opacity='.55';button.title=`Nicht genug Coins · Guthaben ${coins} · benötigt aktuell ${quote.costCoins}`;}else button.title=`Normales Warten bleibt kostenlos. Aktuelle Restzeit vollständig verkürzen.`;
 button.onclick=async event=>{event.preventDefault();event.stopPropagation();const current=rowFor(row.kind,row.raw,row.id);let q;try{q=modules.ops.fullOperationTimeReductionQuote(current);}catch(error){alert(error.message);return;}if(!confirm(`Zeit jetzt vollständig verkürzen?\n\n${modules.ops.COIN_TIME_RULE_LABEL}\nAktuelle Kosten: höchstens ${costLabel(q.costCoins)}.\nNormales Warten bleibt kostenlos.`))return;button.disabled=true;button.textContent='Wird gebucht…';try{const result=await modules.ops.reduceOperationTimeWithCoins(c,current,'all');if(typeof onDone==='function')await onDone(result);window.worldHomeOperationsDashboard?.render?.();setTimeout(decorateVisibleOverlays,0);}catch(error){alert(error?.message||String(error));button.disabled=false;button.textContent=`⚡ Sofort fertig · ${costLabel(q.costCoins)}`;}};
 wrap.append(info,button);return wrap;
}
function addRuleNotice(container,key='default'){
 if(!container||container.querySelector?.(`[data-orvuno-coin-rule="${key}"]`))return;const box=document.createElement('div');box.dataset.orvunoCoinRule=key;box.textContent='🪙 Zeitverkürzung: 1 Coin je angefangene 5 Min. tatsächlicher Restzeit · 60 Min. = 12 Coins · normales Warten bleibt kostenlos.';Object.assign(box.style,{margin:'8px 0 10px',padding:'8px 10px',border:'1px solid #8a6b16',borderRadius:'8px',background:'rgba(99,72,8,.16)',fontSize:'12px',fontWeight:'800',lineHeight:'1.45'});container.prepend(box);
}
function smallestMatching(root,needle,extra=''){const nodes=[...root.querySelectorAll('div,article')].filter(el=>text(el.textContent).includes(needle)&&(!extra||text(el.textContent).includes(extra)));return nodes.filter(el=>!nodes.some(other=>other!==el&&el.contains(other)))[0]||nodes[nodes.length-1]||null;}
function annotateQuotedDeliveryTimes(section){
 if(!section)return;
 for(const row of section.querySelectorAll('div')){const raw=text(row.textContent),match=raw.match(/ca\.\s*([\d.,]+)\s*Std\./i);if(!match||row.querySelector(':scope > [data-orvuno-quoted-delivery-coins]'))continue;const hours=Number(match[1].replace(',','.'));if(!(hours>0))continue;const coins=modules.ops.coinCostForMs(hours*3600000),note=document.createElement('small');note.dataset.orvunoQuotedDeliveryCoins='1';note.textContent=`🪙 Sofort nach Bestellung: ${costLabel(coins)} · 1 Coin je angefangene 5 Min.`;Object.assign(note.style,{display:'block',gridColumn:'1 / -1',fontWeight:'800',color:'#8a6500',marginTop:'2px'});row.append(note);}
}
function attachPlannedProductionPrice(card){
 if(!card)return;let note=card.querySelector(':scope > [data-orvuno-production-coin-rule]');if(!note){note=document.createElement('div');note.dataset.orvunoProductionCoinRule='1';Object.assign(note.style,{marginTop:'7px',fontSize:'12px',fontWeight:'800',color:'#8a6500'});card.append(note);}
 const refresh=()=>{const match=text(card.textContent).match(/Dauer ca\.\s*(\d+)\s*min/i),minutes=Number(match?.[1]||0),coins=modules?.ops?.coinCostForMs?.(minutes*60000)||0;note.textContent=minutes>0?`🪙 Sofort nach Start: ${costLabel(coins)} · 1 Coin je angefangene 5 Min. Restzeit · normales Warten kostenlos.`:'🪙 Nach dem Start optional beschleunigen: 1 Coin je angefangene 5 Min. Restzeit.';};
 refresh();for(const input of card.querySelectorAll('input'))if(input.dataset.orvunoCoinPriceBound!=='1'){input.dataset.orvunoCoinPriceBound='1';input.addEventListener('input',()=>queueMicrotask(refresh));input.addEventListener('change',()=>queueMicrotask(refresh));}
}

function patchOperationalDialog(){
 const p=modules.OperationalSupplyChainDialog?.prototype;if(!p||p.__orvunoFiveMinuteCoins)return;p.__orvunoFiveMinuteCoins=true;
 const oldPurchase=p.renderPurchase;p.renderPurchase=function(panel,c,suppliers){const result=oldPurchase.call(this,panel,c,suppliers),section=[...panel.querySelectorAll('section')].find(s=>text(s.querySelector(':scope > h3')?.textContent).startsWith('Rohstoffe & Verpackung einkaufen'));if(section){addRuleNotice(section,'purchase-delivery');annotateQuotedDeliveryTimes(section);}return result;};
 const oldDeliveries=p.renderDeliveries;p.renderDeliveries=function(panel,c,suppliers){const result=oldDeliveries.call(this,panel,c,suppliers),section=[...panel.querySelectorAll('section')].find(s=>text(s.querySelector(':scope > h3')?.textContent).startsWith('Laufende Lieferungen'));if(section){addRuleNotice(section,'deliveries');const orders=(this.orders?.orders||[]).filter(o=>!['stored','cancelled','arrived'].includes(String(o?.status||'').toLowerCase()));for(const order of orders){const r=rowFor('delivery',order,order.id);if(!modules.ops.canReduceOperation(r))continue;const label=this.materialMeta?.(order.material)?.label||order.material||'',card=smallestMatching(section,label,'Restzeit');if(card)appendControl(card,r,c,{onDone:()=>this.render(panel)});}}return result;};
 const oldQueue=p.renderQueue;p.renderQueue=function(panel,c,recipes){const result=oldQueue.call(this,panel,c,recipes),section=[...panel.querySelectorAll('section')].find(s=>text(s.querySelector(':scope > h3')?.textContent).startsWith('Produktionswarteschlange'));if(section){addRuleNotice(section,'production-queue');for(const job of this.planner?.queue||[]){if(!['running','paused'].includes(String(job?.status||'').toLowerCase()))continue;const r=rowFor('production',job,job.id);if(!modules.ops.canReduceOperation(r))continue;const card=[...section.children].find(el=>el.tagName==='DIV'&&text(el.textContent).startsWith(`#${job.id} ·`))||smallestMatching(section,job.recipe?.label||job.recipe?.id||String(job.id));if(card)appendControl(card,r,c,{onDone:()=>this.render(panel)});}}return result;};
 const oldCard=p.renderProductionCard;p.renderProductionCard=function(parent,...args){const result=oldCard.call(this,parent,...args),card=parent.lastElementChild;attachPlannedProductionPrice(card);return result;};
 const oldRender=p.render;p.render=function(panel,...args){const result=oldRender.call(this,panel,...args);queueMicrotask(()=>decorateMachineMarket(this,panel));return result;};
}
function decorateMachineMarket(dialog,panel){
 const c=dialog?.companyProvider?.()||company(),section=panel?.querySelector?.('.world-machine-purchase-section');if(!c||!section)return;addRuleNotice(section,'machines');let market=[];try{market=modules.equipmentMod.visibleEquipmentMarketplace(c);}catch{return;}
 for(const item of market.filter(x=>x.working&&x.ownedInstance)){const name=item.name||item.label||item.id,card=[...section.children].find(el=>el.tagName==='DIV'&&text(el.textContent).includes(name));if(!card)continue;const hasNativeSecure=[...card.querySelectorAll('button')].some(button=>text(button.textContent).startsWith('⚡ Sofort fertig'));if(hasNativeSecure)continue;removeOldAcceleration(card);const raw=item.ownedInstance,r=rowFor('equipment',raw,raw.instanceId||raw.id);appendControl(card,r,c,{onDone:async()=>{modules.equipmentMod.processIndustryEquipmentInstallations(c,{now:Date.now()});await modules.equipmentMod.persistIndustryEquipment(c).catch(()=>{});dialog.ensureMachines?.(c);dialog.__worldFocusedSection='machines';if(dialog.overlay?.firstElementChild)dialog.render(dialog.overlay.firstElementChild);}});}
}
function patchMaintenance(){
 const p=modules.EconomyDashboard?.prototype;if(!p||p.__orvunoFiveMinuteMaintenance)return;p.__orvunoFiveMinuteMaintenance=true;const old=p.render;p.render=function(panel,...args){const result=old.call(this,panel,...args);queueMicrotask(()=>{const box=panel?.querySelector?.('[data-machine-maintenance-ui]');if(!box)return;addRuleNotice(box,'maintenance');for(const machine of modules.maintenanceMod.allMachines(this.company)){const job=machine?.maintenanceJob;if(!job||String(job.status||'').toLowerCase()!=='maintenance')continue;const r=rowFor('maintenance',job,job.id),name=machine.label||machine.name||machine.id||'Maschine',card=smallestMatching(box,String(name),'Wartung läuft');if(card)appendControl(card,r,this.company,{onDone:()=>{modules.maintenanceMod.processMachineMaintenance(this.company,Date.now());this.render(panel);}});}});return result;};
}
function patchExpansion(){
 const p=modules.UniversalOperationsDialog?.prototype;if(!p||p.__orvunoFiveMinuteExpansion)return;p.__orvunoFiveMinuteExpansion=true;const old=p.render_expansion;if(typeof old!=='function')return;p.render_expansion=function(body,c,...args){const result=old.call(this,body,c,...args);queueMicrotask(()=>decorateExpansion(this,body,c));return result;};
}
function decorateExpansion(dialog,body,c){
 if(!body||!c)return;addRuleNotice(body,'expansion');const summary=modules.activeMod.activeOperationsSummary(c).rows;
 for(const r of summary.filter(x=>x.kind==='delivery'&&x.raw?.kind==='construction_material_order'&&Number(x.remainingMs)>0)){const item=String(r.raw.item||''),labelMap={concrete:'Beton',steel:'Stahl',brick:'Ziegel',insulation:'Dämmung',electrical:'Elektro',pipes:'Rohre',roofing:'Dachmaterial'},card=smallestMatching(body,labelMap[item]||item,'Ankunft');if(card)appendControl(card,rowFor('delivery',r.raw,r.id),c,{onDone:()=>dialog.render()});}
 for(const r of summary.filter(x=>x.kind==='crew_arrival'&&Number(x.remainingMs)>0)){const card=smallestMatching(body,String(r.raw?.label||''),'Ankunft');if(card)appendControl(card,rowFor('crew_arrival',r.raw,r.id),c,{onDone:()=>dialog.render()});}
 for(const r of summary.filter(x=>x.kind==='warehouse_expansion'&&Number(x.remainingMs)>0)){const section=[...body.querySelectorAll('section')].find(s=>text(s.textContent).includes('Lagerausbau'));if(section)appendControl(section,rowFor('warehouse_expansion',r.raw,r.id),c,{onDone:()=>dialog.render()});}
 for(const b of body.querySelectorAll('button')){const t=text(b.textContent),m=t.match(/Anfahrt\s+(\d+)\s+Min/i);if(m&&!t.includes('Coin')){const coins=Math.ceil(Number(m[1])/5);b.textContent=`${t} · 🪙 sofort ${costLabel(coins)}`;}}
}
function decorateUpgradeCenter(){
 const center=document.querySelector('[data-world-upgrade-center]'),c=company();if(!center||!c)return;let notice=center.querySelector('[data-orvuno-upgrade-coin-rule]');if(!notice){notice=document.createElement('div');notice.dataset.orvunoUpgradeCoinRule='1';notice.textContent='🪙 Umbauzeit optional verkürzen: 1 Coin je angefangene 5 Min. Restzeit · 60 Min. = 12 Coins. Normales Warten und Freundeshilfe bleiben kostenlos.';Object.assign(notice.style,{padding:'10px 12px',margin:'8px 0 12px',border:'1px solid #8a6b16',borderRadius:'9px',background:'#2a210b',color:'#f7d67a',fontWeight:'800',fontSize:'12px'});const box=center.querySelector('section');box?.insertBefore(notice,box.children[1]||null);}
 const rows=modules.activeMod.activeOperationsSummary(c).rows.filter(r=>r.kind==='business_upgrade'&&Number(r.remainingMs)>0);for(const r of rows){const target=String(r.raw?.targetLevel||''),cards=[...center.querySelectorAll('article')].filter(x=>text(x.textContent).includes(`Stufe ${target}`)&&text(x.textContent).includes('läuft')),card=cards[0];if(card)appendControl(card,rowFor('business_upgrade',r.raw,r.id),c,{onDone:()=>{document.querySelector('[data-world-upgrade-center]')?.remove();window.worldTimedBusinessUpgrades?.open?.();}});}
}
function decorateActiveOverview(){const overlay=document.querySelector('[data-world-active-operations-overlay]');if(!overlay)return;const box=overlay.querySelector('section');if(box)addRuleNotice(box,'active-overview');}
function updateHelpText(){const topics=window.orvunoHelp?.topics;if(!topics)return;const extra=' Optional kannst du laufende Wartezeit mit Coins verkürzen: 1 Coin je angefangene 5 Minuten tatsächlicher Restzeit; 60 Minuten kosten 12 Coins. Normales Warten bleibt kostenlos.';for(const key of ['production','delivery','machines','expansion']){const item=topics[key];if(item&&typeof item.note==='string'&&!item.note.includes('1 Coin je angefangene 5'))item.note+=extra;}}
function decorateVisibleOverlays(){if(!modules)return;decorateUpgradeCenter();decorateActiveOverview();const op=window.worldOperationalSupplyChainDialog;if(op?.overlay?.firstElementChild)decorateMachineMarket(op,op.overlay.firstElementChild);}
async function install(){if(installed)return;installed=true;await loadModules();patchOperationalDialog();patchMaintenance();patchExpansion();updateHelpText();const observer=new MutationObserver(()=>queueMicrotask(decorateVisibleOverlays));observer.observe(document.documentElement,{childList:true,subtree:true});decorateVisibleOverlays();window.addEventListener('world:server-balances-changed',()=>setTimeout(decorateVisibleOverlays,0));window.worldCoinTimeAccelerationUI={rule:'1 Coin je angefangene 5 Min.',decorate:decorateVisibleOverlays,appendControl};}
if(typeof window!=='undefined'){
 const start=()=>install().catch(error=>console.error('Coin-Zeit-UI konnte nicht installiert werden',error));
 if(window.orvunoBootComplete)setTimeout(start,0);else window.addEventListener('orvuno:boot-complete',start,{once:true});
}
