// ORVUNO – Brücke zwischen Webspiel und nativen Android-Store-Wrappern.
// Enthält absichtlich keine produktiven SDK-IDs, Secrets oder Store-spezifischen Schlüssel.

const params=new URLSearchParams(location.search);
const explicitStore=String(params.get('app')||'').toLowerCase();
const sourceApp=String(params.get('source')||'').toLowerCase()==='app';
const twaReferrer=String(document.referrer||'').startsWith('android-app://');
const isStandalone=()=>window.matchMedia?.('(display-mode: standalone)')?.matches||window.navigator.standalone===true;
let rememberedStore='';
try{rememberedStore=sessionStorage.getItem('orvuno-native-store')||'';}catch(_e){}
const detectedStore=explicitStore==='amazon'?'amazon':explicitStore==='google'?'google':window.OrvunoAmazonIap?'amazon':(sourceApp||twaReferrer||rememberedStore==='google')?'google':'web';
const nativeApp=detectedStore==='amazon'||detectedStore==='google';
try{if(nativeApp)sessionStorage.setItem('orvuno-native-store',detectedStore);}catch(_e){}

const GOOGLE_BILLING_METHOD='https://play.google.com/billing';
const googlePlayProducts=Object.freeze({
  coins_100:'orvuno_coins_100',
  coins_550:'orvuno_coins_550',
  coins_1200:'orvuno_coins_1200',
  coins_2600:'orvuno_coins_2600',
  coins_6000:'orvuno_coins_6000',
  coins_13000:'orvuno_coins_13000',
  coins_26000:'orvuno_coins_26000',
  coins_50000:'orvuno_coins_50000',
  premium_1m:'orvuno_premium_1m',
  premium_3m:'orvuno_premium_3m',
  premium_6m:'orvuno_premium_6m',
  premium_12m:'orvuno_premium_12m'
});
const internalSkuByGoogleProduct=Object.freeze(Object.fromEntries(Object.entries(googlePlayProducts).map(([sku,id])=>[id,sku])));

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

function paymentApi(){
  const api=window.worldAccounts?.authApi;
  if(!api)throw new Error('Zahlungssystem ist noch nicht bereit');
  return api;
}
async function paymentEdge(action,data={}){
  const api=paymentApi(),token=await api.ensureAccessToken();
  if(!token)throw new Error('Bitte zuerst anmelden');
  const response=await fetch(`${api.baseUrl}/functions/v1/world-payments`,{method:'POST',headers:{apikey:api.publishableKey,Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({action,...data})});
  const body=await response.json().catch(()=>({}));
  if(!response.ok||body.success===false)throw new Error(body.error||body.message||`Google-Play-Zahlung fehlgeschlagen (${response.status})`);
  return body;
}
async function googleBillingService(){
  if(typeof window.getDigitalGoodsService!=='function')throw new Error('Google Play Billing ist in dieser App-Sitzung nicht verfügbar');
  try{return await window.getDigitalGoodsService(GOOGLE_BILLING_METHOD);}
  catch(_error){throw new Error('Google Play Billing konnte nicht verbunden werden');}
}
function googleProductId(internalSku){
  const productId=googlePlayProducts[String(internalSku||'')];
  if(!productId)throw new Error('Dieses ORVUNO-Produkt ist bei Google Play nicht freigeschaltet');
  return productId;
}
async function refreshEntitlements(){
  try{
    await window.worldAccounts?.gameStateSync?.refreshBalances?.();
    await window.worldAccounts?.premiumLifecycle?.refreshAccount?.(window.worldAccounts?.authApi);
  }catch(error){console.warn('Google-Play-Gutschrift konnte nicht sofort neu geladen werden',error);}
}
async function getGooglePlayDetails(internalSkus=[]){
  const service=await googleBillingService();
  const wanted=[...new Set(internalSkus.map(String).filter(Boolean))];
  const ids=wanted.map(googleProductId);
  const details=await service.getDetails(ids);
  return (details||[]).map(item=>({
    sku:internalSkuByGoogleProduct[String(item?.itemId||'')]||'',
    productId:String(item?.itemId||''),
    title:String(item?.title||''),
    description:String(item?.description||''),
    price:item?.price||null
  })).filter(item=>item.sku);
}
async function fulfillGooglePlayPurchase(productId,purchaseToken){
  return paymentEdge('google_play_purchase',{productId,purchaseToken});
}
async function beginGooglePlayPurchase({sku}={}){
  const internalSku=String(sku||'');
  const productId=googleProductId(internalSku);
  const service=await googleBillingService();
  const request=new PaymentRequest([{supportedMethods:GOOGLE_BILLING_METHOD,data:{sku:productId}}],{total:{label:'ORVUNO',amount:{currency:'EUR',value:'0'}}});
  let response;
  try{response=await request.show();}
  catch(error){
    if(error?.name==='AbortError')throw new Error('Kauf wurde abgebrochen');
    throw error;
  }
  const purchaseToken=String(response?.details?.purchaseToken||response?.details?.token||'').trim();
  if(!purchaseToken){try{await response.complete('fail');}catch(_e){}throw new Error('Google Play hat keinen gültigen Kaufbeleg geliefert');}
  try{
    const result=await fulfillGooglePlayPurchase(productId,purchaseToken);
    if(result?.fulfilled!==true&&result?.success!==true)throw new Error('Google-Play-Kauf wurde noch nicht gutgeschrieben');
    try{await response.complete('success');}catch(_e){}
    await refreshEntitlements();
    window.dispatchEvent(new CustomEvent('world:server-balances-changed',{detail:result}));
    window.dispatchEvent(new CustomEvent('world:payment-return',{detail:{provider:'google-play',status:'fulfilled',paid:true,fulfilled:true,sku:internalSku,productId}}));
    return result;
  }catch(error){
    try{await response.complete('fail');}catch(_e){}
    throw error;
  }
}
async function reconcileGooglePlayPurchases(){
  if(detectedStore!=='google')return {success:true,processed:0};
  const service=await googleBillingService();
  const purchases=await service.listPurchases();
  let processed=0,changed=false;
  for(const purchase of purchases||[]){
    const productId=String(purchase?.itemId||'');
    const purchaseToken=String(purchase?.purchaseToken||purchase?.token||'').trim();
    if(!internalSkuByGoogleProduct[productId]||!purchaseToken)continue;
    try{const result=await fulfillGooglePlayPurchase(productId,purchaseToken);processed++;if(result?.success)changed=true;}
    catch(error){console.warn('Offener Google-Play-Kauf konnte noch nicht abgeglichen werden',productId,error?.message||error);}
  }
  if(changed)await refreshEntitlements();
  return {success:true,processed};
}
function installGooglePlayCheckout(){
  if(detectedStore!=='google')return false;
  const provider={
    id:'google-play',label:'Google Play',
    begin:beginGooglePlayPurchase,
    beginCoinPurchase(request={}){return beginGooglePlayPurchase({sku:request.packageId});},
    beginPremiumPurchase(plan={}){return beginGooglePlayPurchase({sku:plan.id||plan.planId});},
    getDetails:getGooglePlayDetails,
    reconcile:reconcileGooglePlayPurchases
  };
  window.worldPaymentProviders??={};
  window.worldPaymentProviders.googlePlay=provider;
  window.worldPaymentCheckout=provider;
  return true;
}
function scheduleGooglePlayReconciliation(){
  if(detectedStore!=='google')return;
  let attempts=0;
  const run=async()=>{
    if(window.worldAccounts?.authApi){try{await reconcileGooglePlayPurchases();}catch(error){console.warn('Google-Play-Wiederherstellung wird später erneut versucht',error?.message||error);}return;}
    if(++attempts<40)setTimeout(run,500);
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else queueMicrotask(run);
}

window.orvunoAppBridge={
  version:3,
  standalone:isStandalone(),
  store:detectedStore,
  isNativeApp:nativeApp,
  googlePlayProducts,
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
installGooglePlayCheckout();
scheduleGooglePlayReconciliation();
registerServiceWorker();
