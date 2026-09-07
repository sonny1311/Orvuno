// ORVUNO – sichere Brücke zwischen Webspiel und nativen Store-Wrappern.
// Native Store-Kontext wird fail-closed erkannt: in einer erkannten Store-App darf
// niemals stillschweigend auf Stripe/PayPal zurückgefallen werden.

const params=new URLSearchParams(location.search);
const explicitStore=String(params.get('orvuno_store')||params.get('app')||'').toLowerCase();
const appSource=params.get('source')==='app'||params.get('orvuno_app')==='android';
const androidReferrer=/^android-app:\/\//i.test(String(document.referrer||''));
const isStandalone=()=>window.matchMedia?.('(display-mode: standalone)')?.matches||window.navigator.standalone===true;

function storedStore(){
  try{return String(localStorage.getItem('orvuno.nativeStore')||'').toLowerCase();}catch(_e){return '';}
}
function rememberStore(store){
  if(!['google','amazon'].includes(store))return;
  try{localStorage.setItem('orvuno.nativeStore',store);}catch(_e){}
}
function detectStore(){
  if(explicitStore==='google'||explicitStore==='amazon'){rememberStore(explicitStore);return explicitStore;}
  if(window.OrvunoAmazonIap){rememberStore('amazon');return 'amazon';}
  const persisted=storedStore();
  if(androidReferrer){
    const detected=persisted==='amazon'?'amazon':'google';
    rememberStore(detected);
    return detected;
  }
  // source=app ist ausschließlich für den paketierten Android-Start vorgesehen.
  // Trusted Web Activities melden display-mode nicht auf allen Geräten zuverlässig als
  // standalone. Deshalb darf dieser Marker nicht zusätzlich davon abhängig sein.
  if(appSource){
    const detected=persisted==='amazon'?'amazon':'google';
    rememberStore(detected);
    return detected;
  }
  // Ein normaler Browserbesuch ohne App-Marker bleibt Web, selbst wenn dasselbe
  // Chrome-Profil zuvor die TWA verwendet hat.
  return 'web';
}

const detectedStore=detectStore();
const nativeApp=detectedStore==='google'||detectedStore==='amazon';

function topVisibleOverlay(){
  const candidates=[...document.querySelectorAll('[data-orvuno-payment-overlay],[role="dialog"],.orvuno-modal,.modal,.dialog')]
    .filter(el=>{
      const s=getComputedStyle(el);
      const r=el.getBoundingClientRect();
      return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0;
    });
  return candidates.at(-1)||null;
}

function closeTopOverlay(){
  const overlay=topVisibleOverlay();
  if(!overlay)return false;
  const close=overlay.querySelector('[data-close],[aria-label*="schließ" i],[aria-label*="close" i],.close,.modal-close,button');
  if(close&&typeof close.click==='function'){
    close.click();
    return true;
  }
  return false;
}

function handleBack(){
  if(closeTopOverlay())return true;
  window.dispatchEvent(new CustomEvent('orvuno:app-back-unhandled'));
  return false;
}

const adProviders=new Map();
function registerRewardedAdProvider(id,provider){
  if(!id||typeof provider?.showRewarded!=='function')throw new Error('Ungültiger Rewarded-Ad-Provider');
  adProviders.set(String(id),provider);
  return true;
}
async function showRewardedAd(context={}){
  const preferred=context.providerId&&adProviders.get(String(context.providerId));
  const provider=preferred||adProviders.values().next().value;
  if(!provider)throw new Error('Noch kein nativer Werbeanbieter eingerichtet');
  return provider.showRewarded(context);
}

function setConnectionState(){
  document.documentElement.dataset.orvunoOnline=navigator.onLine?'1':'0';
  document.documentElement.dataset.orvunoStore=detectedStore;
  document.documentElement.dataset.orvunoNativeApp=nativeApp?'1':'0';
  window.dispatchEvent(new CustomEvent('orvuno:connection-changed',{detail:{online:navigator.onLine}}));
}

async function registerServiceWorker(){
  if(!('serviceWorker' in navigator)||location.protocol==='file:')return null;
  try{return await navigator.serviceWorker.register('./service-worker.js',{scope:'./'});}
  catch(error){console.warn('ORVUNO App-Service-Worker konnte nicht registriert werden',error);return null;}
}

window.orvunoAppBridge={
  version:5,
  standalone:isStandalone(),
  store:detectedStore,
  isNativeApp:nativeApp,
  androidReferrer,
  handleBack,
  closeTopOverlay,
  registerRewardedAdProvider,
  showRewardedAd,
  get online(){return navigator.onLine;}
};

window.addEventListener('orvuno:native-back',handleBack);
window.addEventListener('online',setConnectionState);
window.addEventListener('offline',setConnectionState);
setConnectionState();
registerServiceWorker();
