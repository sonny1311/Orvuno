// ORVUNO - gefuehrter Spielerfluss fuer eine einfache Bedienung.
// Baut auf bestehenden Dialogen und Buchungslogiken auf. Keine Wirtschaftsdaten werden hier veraendert.
import { EconomyDashboard } from './EconomyDashboard.js';
import { productionReadinessChecklist } from './ProductionReadinessChecklist.js';

const FLOW_ID='orvuno-guided-next-steps';
const num=v=>Number.isFinite(Number(v))?Number(v):0;

function activeCompany(dashboard){return window.worldPlayerCompany||window.worldEconomyGameplay?.company||window.worldEngine?.company||dashboard?.company||null;}
function openWorkforce(){
  const dialog=window.worldAccounts?.workforceOperationsDialog;
  if(dialog?.open)return dialog.open().catch?.(e=>alert(e?.message||String(e)));
  const hidden=[...document.querySelectorAll('#world-main-nav > button')].find(b=>/personal|mitarbeiter/i.test(String(b.textContent||'')));
  hidden?.click?.();
}
function openBusinesses(){
  const dialog=window.worldAccounts?.businessPortfolioDialog;
  if(dialog?.open)return dialog.open().catch?.(e=>alert(e?.message||String(e)));
  const hidden=document.getElementById('world-businesses-button');hidden?.click?.();
}
function jumpOrders(dashboard){
  dashboard?.jumpTo?.('dashboard-customer-orders');
}
function finishedStock(company,product){
  const finished=company?.operationalSupplyState?.warehouseStock?.finished||{};
  return num(finished?.[product]??company?.inventory?.[product]??0);
}
function openFix(dashboard,fix){
  const kind=String(fix?.kind||'');
  if(kind==='buy_equipment')return dashboard.openOperationalSupplyChain?.('machines');
  if(kind==='hire')return openWorkforce();
  if(kind==='procure')return dashboard.openOperationalSupplyChain?.('buy');
  return dashboard.openOperationalSupplyChain?.('production');
}

function nextSteps(dashboard){
  const c=activeCompany(dashboard);if(!c)return [];
  const steps=[];
  if(c.setupPhase&&c.setupPhase!=='operating'){
    steps.push({priority:100,icon:'🧭',title:'Betrieb fertig einrichten',detail:'Dein Betrieb ist noch in der Gründungsphase. Schließe zuerst die Einrichtung ab, bevor Einkauf und Produktion vollständig genutzt werden.',label:'Unternehmen öffnen',run:()=>openBusinesses()});
    return steps;
  }
  const deliveries=[...(c.operationalSupplyState?.orders||[]),...(c.supplierOrders||[])];
  const arrived=deliveries.filter(o=>['arrived','waiting_storage'].includes(String(o?.status||'')));
  if(arrived.length)steps.push({priority:98,icon:'📦',title:`${arrived.length} Lieferung${arrived.length===1?' ist':'en sind'} angekommen`,detail:'Die Ware ist noch nicht im nutzbaren Lagerbestand. Lagere sie zuerst ein, damit Produktion und Verkauf darauf zugreifen können.',label:'Jetzt einlagern',run:()=>dashboard.openOperationalSupplyChain?.('deliveries')});

  let readiness=[];try{readiness=productionReadinessChecklist(c);}catch{}
  const blocked=readiness.find(row=>!row.ready&&row.nextFix);
  if(blocked){
    const stage=blocked.stages?.find(s=>s.state==='missing'||s.state==='waiting');
    steps.push({priority:90,icon:'🏭',title:`${blocked.productLabel}: ${stage?.label||'noch nicht startklar'}`,detail:`ORVUNO hat den nächsten fehlenden Schritt bereits erkannt. Behebe zuerst diesen Engpass; danach wird die Produktion erneut geprüft.`,label:blocked.nextFix?.label||'Problem lösen',run:()=>openFix(dashboard,blocked.nextFix)});
  }else if(readiness.some(row=>row.ready)){
    const ready=readiness.find(row=>row.ready);
    steps.push({priority:72,icon:'✅',title:`${ready.productLabel} kann produziert werden`,detail:'Maschine, Personal und Material sind für diesen Produktionsweg vorhanden.',label:'Produktion öffnen',run:()=>dashboard.openOperationalSupplyChain?.('production')});
  }

  const running=(c.productionQueue||[]).filter(p=>String(p?.status||'')==='running');
  const queued=(c.productionQueue||[]).filter(p=>String(p?.status||'')==='queued');
  if(queued.length&&!running.length)steps.push({priority:86,icon:'▶️',title:`${queued.length} Produktion${queued.length===1?' wartet':'en warten'} auf Start`,detail:'Geplante Aufträge produzieren noch nichts. Prüfe die Voraussetzungen und starte den nächsten Auftrag.',label:'Produktion starten',run:()=>dashboard.openOperationalSupplyChain?.('production')});

  const orders=(c.customerOrders||[]).filter(o=>String(o?.status||'').toLowerCase()==='open');
  const deliverable=orders.find(o=>{
    const product=o.product||o.productId||o.itemId;const open=num(o.remainingAmount??o.remaining??o.amount??o.quantity);
    return product&&open>0&&finishedStock(c,product)>0;
  });
  if(deliverable)steps.push({priority:82,icon:'🚚',title:'Fertige Ware kann ausgeliefert werden',detail:'Für mindestens einen offenen Kundenauftrag liegt bereits Fertigware im Lager. Du kannst jetzt Umsatz realisieren.',label:'Auftrag liefern',run:()=>jumpOrders(dashboard)});
  else if(orders.length)steps.push({priority:58,icon:'🧾',title:`${orders.length} offene${orders.length===1?'r':''} Kundenauftrag${orders.length===1?'':'e'}`,detail:'Plane Einkauf und Produktion vom Liefertermin rückwärts. So siehst du sofort, welche Ware als Nächstes benötigt wird.',label:'Aufträge ansehen',run:()=>jumpOrders(dashboard)});

  const delayed=deliveries.filter(o=>String(o?.status||'')==='delayed');
  if(delayed.length)steps.push({priority:76,icon:'⏰',title:`${delayed.length} verspätete Lieferung${delayed.length===1?'':'en'}`,detail:'Prüfe die laufenden Lieferungen, bevor du weitere Produktion auf dieses Material planst.',label:'Lieferungen prüfen',run:()=>dashboard.openOperationalSupplyChain?.('deliveries')});

  return steps.sort((a,b)=>b.priority-a.priority).slice(0,3);
}

function button(dashboard,label,run,primary=false){
  const b=dashboard.button(label,run);Object.assign(b.style,{margin:'0',background:primary?'#2563eb':'#172033',color:'#fff',border:`1px solid ${primary?'#60a5fa':'#475569'}`,padding:'9px 12px'});return b;
}
function renderFlow(dashboard,panel){
  panel.querySelector(`#${FLOW_ID}`)?.remove();
  const steps=nextSteps(dashboard);
  const box=dashboard.el('section');box.id=FLOW_ID;box.setAttribute('aria-label','Naechste Schritte');
  Object.assign(box.style,{margin:'0 0 16px',padding:'14px',border:'1px solid #334155',borderRadius:'13px',background:'linear-gradient(135deg,rgba(30,58,95,.78),rgba(11,21,36,.94))'});
  const head=dashboard.el('div');Object.assign(head.style,{display:'flex',alignItems:'baseline',justifyContent:'space-between',gap:'12px',flexWrap:'wrap'});
  const title=dashboard.el('strong','🧭 Als Nächstes');Object.assign(title.style,{fontSize:'18px'});head.append(title,dashboard.small('ORVUNO zeigt dir die wichtigsten nächsten Schritte.'));
  box.append(head);
  if(!steps.length){
    const ok=dashboard.el('div','✅ Im Moment ist nichts Dringendes offen. Prüfe Aufträge, Markt und Ausbau, wenn du weiter wachsen möchtest.');Object.assign(ok.style,{marginTop:'10px',padding:'10px',borderRadius:'9px',background:'rgba(22,101,52,.25)'});box.append(ok);
  }else{
    steps.forEach((step,index)=>{
      const row=dashboard.el('div');Object.assign(row.style,{display:'grid',gridTemplateColumns:'minmax(0,1fr) auto',gap:'12px',alignItems:'center',marginTop:'10px',padding:'11px',borderRadius:'10px',background:index===0?'rgba(37,99,235,.18)':'rgba(15,23,42,.55)',border:index===0?'1px solid #3b82f6':'1px solid #334155'});
      const text=dashboard.el('div');const strong=dashboard.el('div',`${step.icon} ${step.title}`);Object.assign(strong.style,{fontWeight:'850',marginBottom:'3px'});text.append(strong,dashboard.small(step.detail));
      row.append(text,button(dashboard,step.label,step.run,index===0));box.append(row);
    });
  }
  const nav=document.getElementById('world-main-nav');
  if(nav?.parentElement===panel&&nav.nextSibling)panel.insertBefore(box,nav.nextSibling);else if(nav?.parentElement===panel)nav.after(box);else{
    const summary=[...panel.children].find(el=>el?.querySelector?.('[data-world-dashboard-quick-actions]'));
    if(summary)summary.before(box);else panel.firstElementChild?.after?.(box);
  }
}

const proto=EconomyDashboard.prototype;
if(!proto.__orvunoGuidedPlayerFlow){
  proto.__orvunoGuidedPlayerFlow=true;
  const originalRender=proto.render;
  proto.render=function(panel,...args){const result=originalRender.call(this,panel,...args);renderFlow(this,panel);return result;};
}

export function guidedNextStepsForTest(dashboard){return nextSteps(dashboard).map(x=>({title:x.title,label:x.label,priority:x.priority}));}
if(typeof window!=='undefined')window.orvunoGuidedPlayerFlow={nextSteps:()=>nextSteps(window.worldEconomyDashboard)};
