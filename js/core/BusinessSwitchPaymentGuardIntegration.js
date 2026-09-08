// ORVUNO – harte Trennung zwischen Betriebsnavigation und Echtgeld-Kauf.
// CrazyGames Basic lädt diesen Guard im HTML mit. Dort darf er NICHT über einen
// statischen Import den kompletten Account-/Gameplay-Graphen in den Startpfad ziehen.
const params=new URLSearchParams(location.search);
const crazyGames=params.get('source')==='crazygames'||params.get('crazygames')==='1'||params.get('platform')==='crazygames';

const SWITCH_BLOCK_MS = 1500;
let switchDepth = 0;
let blockedUntil = 0;
let cleanupTimer = null;
let observer = null;

function closeUnexpectedPaymentOverlay() {
  document.querySelectorAll('[data-orvuno-payment-overlay]').forEach(node => node.remove());
}

function stopObserverLater() {
  clearTimeout(cleanupTimer);
  cleanupTimer = setTimeout(() => {
    observer?.disconnect();
    observer = null;
    closeUnexpectedPaymentOverlay();
  }, SWITCH_BLOCK_MS + 100);
}

function guardDelayedPaymentOverlay() {
  blockedUntil = Math.max(blockedUntil, Date.now() + SWITCH_BLOCK_MS);
  closeUnexpectedPaymentOverlay();
  if (!observer && typeof MutationObserver !== 'undefined') {
    observer = new MutationObserver(() => {
      if (paymentBlockedByBusinessSwitch()) closeUnexpectedPaymentOverlay();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }
  stopObserverLater();
}

function installOn(businessPortfolio){
  if(!businessPortfolio||businessPortfolio.__orvunoPaymentSwitchGuardInstalled)return;
  businessPortfolio.__orvunoPaymentSwitchGuardInstalled=true;
  const originalActivate=businessPortfolio.activate.bind(businessPortfolio);
  businessPortfolio.activate=function(...args){
    switchDepth+=1;
    guardDelayedPaymentOverlay();
    try{return originalActivate(...args);}finally{queueMicrotask(()=>{switchDepth=Math.max(0,switchDepth-1);});}
  };
}

// Normale Web-/Store-Version: Verhalten wie bisher. CrazyGames: erst installieren,
// wenn der Account-Graph später tatsächlich geladen wurde.
if(!crazyGames){
  import('./AccountMultiplayerIntegration.js').then(m=>installOn(m.businessPortfolio)).catch(error=>console.warn('Betriebswechsel-Guard konnte nicht geladen werden',error));
}else{
  window.addEventListener('orvuno:full-runtime-ready',()=>installOn(window.worldAccounts?.businessPortfolio),{once:true});
}

export function paymentBlockedByBusinessSwitch() {
  return switchDepth > 0 || Date.now() < blockedUntil;
}

export function runBusinessSwitchPaymentGuardTest() {
  const oldUntil = blockedUntil;
  switchDepth += 1;
  try {
    if (!paymentBlockedByBusinessSwitch()) throw new Error('Betriebswechsel sperrt Checkout nicht');
  } finally {
    switchDepth = Math.max(0, switchDepth - 1);
    blockedUntil = oldUntil;
  }
  return true;
}

if (typeof window !== 'undefined') {
  window.worldBusinessSwitchPaymentGuard = {
    blocked: paymentBlockedByBusinessSwitch,
    test: runBusinessSwitchPaymentGuardTest
  };
}
