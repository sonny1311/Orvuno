// WorldProject - sichtbares Ausbauzentrum fuer zeitbasierte Betriebsausbaustufen.
// Zeigt vor dem Kauf Kosten, Bonus und Dauer; laufende Auftraege mit Phase, Restzeit und Freundeshilfe.
import { UpgradeTracks } from './BusinessUpgradeSystem.js';

const euro=v=>`${Math.round(Number(v)||0).toLocaleString('de-DE')} €`;
const pct=v=>`${((Number(v)||0)*100).toFixed(2).replace('.',',').replace(/,?0+$/,'')} %`;
const duration=ms=>{let m=Math.max(0,Math.ceil(Number(ms||0)/60000));if(m>=1440)return`${Math.floor(m/1440)} T ${Math.ceil((m%1440)/60)} Std.`;if(m>=60)return`${Math.floor(m/60)} Std. ${m%60} Min.`;return`${m} Min.`;};
const coinCost=ms=>Math.max(0,Math.ceil(Math.max(0,Number(ms||0))/300000));
const company=()=>window.worldPlayerCompany||window.worldEconomyGameplay?.company||window.worldEngine?.company||null;
const system=()=>window.worldAccounts?.businessUpgrades||null;
function close(){document.querySelector('[data-world-upgrade-center]')?.remove();}
function dirty(type,detail={}){window.dispatchEvent(new CustomEvent(type,{detail}));window.dispatchEvent(new CustomEvent('world:game-state-dirty',{detail:{reason:type,...detail}}));}
const icons={production:'🏭',storage:'🏬',efficiency:'⚙️',quality:'🧪',logistics:'🚚',administration:'🗂️'};
const effects={production:'Produktion wird schneller.',storage:'Mehr Lagerkapazität steht zur Verfügung.',efficiency:'Laufende Betriebskosten sinken.',quality:'Die erreichbare Produktqualität steigt.',logistics:'Liefer- und Logistikabläufe werden effizienter.',administration:'Verwaltungsaufwand und Verwaltungskosten sinken.'};
function trackIcon(track){return icons[track]||'🛠️';}

function requestFriendHelp(c,job){const detail={companyId:c?.id||c?.serverCompanyId||null,jobId:job.id,track:job.track,targetLevel:job.targetLevel,finishAt:job.finishAt,maxHelpers:job.maxHelpers,helpers:(job.helpers||[]).map(h=>h.friendId)};window.dispatchEvent(new CustomEvent('world:upgrade-help-requested',{detail}));const social=window.worldFriends||window.worldSocial||window.worldFriendSystem;if(social?.requestUpgradeHelp){social.requestUpgradeHelp(detail);return true;}return false;}

export function receiveUpgradeFriendHelp({jobId,friendId,friendName=null}={}){const c=company(),s=system();if(!c||!s)throw new Error('Ausbausystem nicht verfügbar');const result=s.applyFriendHelp(c,jobId,{friendId,friendName,now:Date.now()});dirty('world:business-upgrade-helped',{jobId,friendId});return result;}

export function openTimedBusinessUpgradeCenter(){
 if(typeof document==='undefined')return false;close();const c=company(),s=system();if(!c||!s){alert('Ausbausystem ist noch nicht geladen.');return false;}s.process(c,Date.now());
 const overlay=document.createElement('div');overlay.dataset.worldUpgradeCenter='1';Object.assign(overlay.style,{position:'fixed',inset:'0',zIndex:64000,background:'rgba(0,0,0,.62)',display:'grid',placeItems:'center',padding:'18px'});
 const box=document.createElement('section');Object.assign(box.style,{width:'min(980px,97vw)',maxHeight:'90vh',overflow:'auto',background:'#0f172a',color:'#f8fafc',borderRadius:'16px',padding:'18px',boxShadow:'0 22px 70px rgba(0,0,0,.55)'});
 const head=document.createElement('div');Object.assign(head.style,{display:'flex',justifyContent:'space-between',gap:'16px',alignItems:'start',position:'sticky',top:'-18px',zIndex:'4',background:'#0f172a',padding:'14px 0'});head.innerHTML=`<div><h2 style="margin:0">⚙️ Betrieb ausbauen</h2><small style="color:#cbd5e1">Bonus wird erst nach abgeschlossenem Umbau wirksam · Betriebsgeld: <b>${euro(c.money)}</b></small></div>`;const x=document.createElement('button');x.textContent='✕';Object.assign(x.style,{fontSize:'20px',padding:'6px 11px',cursor:'pointer'});x.onclick=close;head.append(x);box.append(head);
 const note=document.createElement('div');note.innerHTML='<b>⏱️ Ausbau braucht Zeit – normales Warten bleibt kostenlos.</b><br><span>Bezahlen startet Umbau, Schulung und Abnahme. Optional kannst du die laufende Restzeit mit Coins verkürzen: <b>1 Coin je angefangene 5 Minuten</b>; 60 Minuten kosten 12 Coins. Freundeshilfe bleibt zusätzlich möglich.</span>';Object.assign(note.style,{padding:'12px',border:'1px solid #334155',background:'#111827',borderRadius:'10px',marginBottom:'14px',color:'#e2e8f0'});box.append(note);
 const grid=document.createElement('div');Object.assign(grid.style,{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(290px,1fr))',gap:'12px'});
 for(const track of Object.keys(UpgradeTracks)){
  const st=s.status(c,track,Date.now()),q=st.next,card=document.createElement('article');Object.assign(card.style,{border:'1px solid #334155',borderRadius:'12px',padding:'14px',background:'#111827'});
  const title=document.createElement('div');title.innerHTML=`<div style="font-size:17px;font-weight:800">${trackIcon(track)} ${q.label}</div><small style="color:#94a3b8">Aktuelle Stufe ${st.level} · aktiver Bonus ${pct(st.modifier-1)}</small><div style="margin-top:5px;font-size:12px;color:#cbd5e1">${effects[track]||''}</div>`;card.append(title);
  if(st.active){
   const job=st.job,helpers=(job.helpers||[]).length,max=job.maxHelpers||0,remainingMs=Math.max(0,Number(job.finishAt||0)-Date.now()),coins=coinCost(remainingMs);const status=document.createElement('div');Object.assign(status.style,{marginTop:'12px',padding:'11px',borderRadius:'10px',background:'#1e293b'});status.innerHTML=`<b>🔧 Ausbau auf Stufe ${job.targetLevel} läuft</b><br><span>${s.phase(job,Date.now())}</span><br><small>Noch ${duration(remainingMs)} · 🪙 sofort fertig ca. ${coins} Coin${coins===1?'':'s'} · Freundeshilfe ${helpers}/${max}</small><div style="height:8px;background:#334155;border-radius:999px;margin-top:9px;overflow:hidden"><div style="height:100%;width:${s.progress(job,Date.now())}%;background:#e2e8f0"></div></div>`;card.append(status);
   const help=document.createElement('button');help.textContent=max&&helpers>=max?'🤝 Freundeshilfe ausgeschöpft':'🤝 Freunde um Hilfe bitten';help.disabled=max&&helpers>=max;Object.assign(help.style,{width:'100%',marginTop:'10px',padding:'9px',fontWeight:'800',cursor:help.disabled?'not-allowed':'pointer'});help.onclick=()=>{const connected=requestFriendHelp(c,job);help.textContent=connected?'✅ Hilfeanfrage gesendet':'🤝 Hilfeanfrage vorgemerkt';};card.append(help);
  }else if(q.maxed){
   const done=document.createElement('div');done.innerHTML=`<b>✅ Maximale Stufe erreicht</b><br><small>Stufe ${st.level} · Gesamtbonus ${pct(st.modifier-1)}</small>`;Object.assign(done.style,{marginTop:'12px',padding:'11px',borderRadius:'10px',background:'#1e293b'});card.append(done);
  }else{
   const details=document.createElement('div');Object.assign(details.style,{marginTop:'12px',lineHeight:'1.55'});details.innerHTML=`Nächste Stufe: <b>${q.nextLevel}</b><br>Kosten: <b>${euro(q.cost)}</b><br>Zusätzlicher Bonus: <b>+${pct(q.effectGain)}</b><br>Gesamtbonus danach: <b>${pct(q.effectTotal)}</b><br>Dauer: <b>${duration(q.durationMs)}</b><br>🪙 Vollständige Zeitverkürzung direkt nach Start: <b>${coinCost(q.durationMs)} Coins</b><br><small style="color:#94a3b8">1 Coin je angefangene 5 Min. Restzeit · normales Warten kostenlos · bis zu ${q.maxHelpers} Freunde können helfen.</small>`;card.append(details);
   const start=document.createElement('button');start.textContent=Number(c.money||0)>=q.cost?`Ausbau für ${euro(q.cost)} starten`:'Nicht genug Betriebsgeld';start.disabled=Number(c.money||0)<q.cost;Object.assign(start.style,{width:'100%',marginTop:'12px',padding:'10px',fontWeight:'800',cursor:start.disabled?'not-allowed':'pointer'});start.onclick=()=>{try{const r=s.startUpgrade(c,track,{now:Date.now()});dirty('world:business-upgrade-started',{track,jobId:r.job.id,targetLevel:r.job.targetLevel});openTimedBusinessUpgradeCenter();}catch(error){alert(error.message);}};card.append(start);
  }
  grid.append(card);
 }
 box.append(grid);overlay.append(box);overlay.onclick=e=>{if(e.target===overlay)close();};document.body.append(overlay);return true;
}

export function processTimedBusinessUpgrades(){const c=company(),s=system();if(!c||!s)return[];const done=s.process(c,Date.now());for(const job of done)dirty('world:business-upgrade-completed',{track:job.track,jobId:job.id,targetLevel:job.targetLevel});return done;}

export function installTimedBusinessUpgradeButton(){if(typeof document==='undefined')return false;let b=document.querySelector('[data-world-upgrade-button]');if(b)return true;b=document.createElement('button');b.dataset.worldUpgradeButton='1';b.textContent='⚙️ Ausbau';Object.assign(b.style,{position:'fixed',right:'18px',bottom:'72px',zIndex:44000,padding:'9px 13px',borderRadius:'999px',border:'1px solid #475569',background:'#0f172a',color:'#fff',fontWeight:'800',cursor:'pointer'});b.onclick=openTimedBusinessUpgradeCenter;document.body.append(b);return true;}

if(typeof window!=='undefined'){window.worldTimedBusinessUpgrades={open:openTimedBusinessUpgradeCenter,process:processTimedBusinessUpgrades,receiveFriendHelp:receiveUpgradeFriendHelp,install:installTimedBusinessUpgradeButton};window.addEventListener('world:upgrade-friend-help',e=>{try{receiveUpgradeFriendHelp(e.detail||{});}catch(error){console.warn('Freundeshilfe konnte nicht angewendet werden',error);}});const boot=()=>{installTimedBusinessUpgradeButton();processTimedBusinessUpgrades();setInterval(processTimedBusinessUpgrades,15000);};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();}
