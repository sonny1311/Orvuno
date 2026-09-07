// ORVUNO – Amazon Appstore IAP. Kaufdaten werden serverseitig per Amazon RVS geprüft.
// Die native APK ist absichtlich nur eine generische Amazon-Brücke. SKU-Zuordnung,
// Preise/Labels und Kaufablauf bleiben im Webcode, damit Store-Fixes keine neue APK brauchen.
const AMAZON_SKU_MAP=Object.freeze({
  coins_100:'orvuno_coins_100',coins_550:'orvuno_coins_550',coins_1200:'orvuno_coins_1200',coins_2600:'orvuno_coins_2600',
  coins_6000:'orvuno_coins_6000',coins_13000:'orvuno_coins_13000',coins_26000:'orvuno_coins_26000',coins_50000:'orvuno_coins_50000',
  premium_1m:'orvuno_premium_4w',premium_3m:'orvuno_premium_3m',premium_6m:'orvuno_premium_6m',premium_12m:'orvuno_premium_12m'
});
const INTERNAL_BY_AMAZON=Object.freeze(Object.fromEntries(Object.entries(AMAZON_SKU_MAP).map(([k,v])=>[v,k])));
const productCache=new Map();
const inFlightReceipts=new Set();
let bridgeReady=false,uiQueued=false,catalogRetryTimer=null;

const nativeBridge=()=>window.OrvunoAmazonIap||window.OrvunoAmazonIAP||null;
const authApi=()=>window.worldAccounts?.authApi;
const feedback=(text,type='info')=>{
  const api=window.worldActionFeedback;
  if(api?.show)return api.show(text,{type,title:'Amazon Appstore'});
  if(api?.feedback)return api.feedback(text,{type,title:'Amazon Appstore'});
  console[type==='error'?'error':'log'](text);
};
function requireBridge(){
  const bridge=nativeBridge();
  if(!bridge||typeof bridge.purchase!=='function')throw new Error('Amazon Appstore-Käufe sind auf diesem Gerät nicht verfügbar.');
  return bridge;
}
async function refreshAccount(){
  try{await window.worldAccounts?.gameStateSync?.refreshBalances?.();}catch{}
  try{await window.worldAccounts?.premiumLifecycle?.refreshAccount?.(authApi());}catch{}
  window.dispatchEvent(new CustomEvent('world:amazon-iap-updated'));
}
async function verifyReceipt(detail={}){
  const receiptId=String(detail.receiptId||'').trim();
  const amazonSku=String(detail.sku||'').trim();
  const amazonUserId=String(detail.amazonUserId||'').trim();
  const internalSku=INTERNAL_BY_AMAZON[amazonSku]||'';
  if(!receiptId||!amazonSku||!amazonUserId||!internalSku)throw new Error('Amazon hat unvollständige Kaufdaten zurückgegeben.');
  if(inFlightReceipts.has(receiptId))return null;
  inFlightReceipts.add(receiptId);
  try{
    const api=authApi();
    if(!api)throw new Error('Spielersitzung ist noch nicht bereit.');
    const token=await api.ensureAccessToken();
    if(!token)throw new Error('Spielersitzung ist abgelaufen.');
    const response=await fetch(`${api.baseUrl}/functions/v1/world-amazon-iap`,{
      method:'POST',
      headers:{apikey:api.publishableKey,Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
      body:JSON.stringify({amazonUserId,receiptId,sku:amazonSku})
    });
    const body=await response.json().catch(()=>({}));
    if(!response.ok||body?.success!==true)throw new Error(body?.error||`Amazon-Kaufprüfung fehlgeschlagen (${response.status}).`);
    const bridge=requireBridge();
    if(typeof bridge.notifyFulfilled==='function')bridge.notifyFulfilled(receiptId);
    await refreshAccount();
    const grant=body.fulfillment||{};
    if(grant.kind==='coins')feedback(`✅ ${Number(grant.coins||0).toLocaleString('de-DE')} Coins gutgeschrieben.`,'success');
    else if(grant.kind==='premium')feedback('✅ Premium wurde gutgeschrieben.','success');
    else feedback('✅ Amazon-Kauf bestätigt und gutgeschrieben.','success');
    return body;
  }finally{inFlightReceipts.delete(receiptId);}
}
function updateAmazonCatalogUi(){
  document.querySelectorAll('[data-coin-offer],[data-premium-offer]').forEach(button=>{
    const internalSku=button.dataset.coinOffer||button.dataset.premiumOffer||'';
    const amazonSku=AMAZON_SKU_MAP[internalSku];
    if(!amazonSku)return;
    button.dataset.amazonSku=amazonSku;
    const product=productCache.get(amazonSku);

    // Produktmetadaten dienen nur für die Preis-/Textanzeige. Sie dürfen den Kauf
    // niemals blockieren. Amazon zeigt den verbindlichen Preis ohnehin im Kaufdialog.
    button.disabled=false;
    button.title='Abrechnung über Amazon Appstore';
    if(product?.price){
      const price=String(product.price);
      if(button.textContent!==price)button.textContent=price;
    }else if(button.dataset.amazonFallbackLabel!=='1'){
      button.textContent='Über Amazon kaufen';
      button.dataset.amazonFallbackLabel='1';
    }

    if(internalSku==='premium_1m'){
      const card=button.closest('article'),title=card?.querySelector('h3'),sub=card?.querySelector('p');
      if(title&&title.textContent!=='4 Wochen Premium')title.textContent='4 Wochen Premium';
      if(sub&&sub.textContent!=='28 Tage Premium')sub.textContent='28 Tage Premium';
    }
  });
}
function queueUiUpdate(){
  if(uiQueued)return;
  uiQueued=true;
  requestAnimationFrame(()=>{uiQueued=false;updateAmazonCatalogUi();});
}
function requestProducts(){
  const bridge=requireBridge();
  if(typeof bridge.requestProductData!=='function')throw new Error('Amazon-Produktdaten können nicht geladen werden.');
  bridge.requestProductData(JSON.stringify(Object.values(AMAZON_SKU_MAP)));
}
function refreshCatalogSoon(delay=0){
  clearTimeout(catalogRetryTimer);
  catalogRetryTimer=setTimeout(()=>{
    try{requestProducts();}catch(error){console.warn('Amazon-Produktdaten werden später erneut geladen',error);}
  },delay);
}
export async function beginAmazonPurchase({internalSku}={}){
  const normalized=String(internalSku||'');
  const amazonSku=AMAZON_SKU_MAP[normalized];
  if(!amazonSku)throw new Error('Dieses Produkt ist im Amazon Appstore nicht verfügbar.');

  // Wie bei Hofhain: der Klick geht direkt an die native Amazon-Brücke. Ein fehlender
  // Produktdaten-Cache darf keinen toten/gesperrten Kaufbutton erzeugen.
  const bridge=requireBridge();
  feedback('Amazon-Kauf wird geöffnet …','info');
  bridge.purchase(amazonSku);
  return {success:true,pending:true,provider:'amazon',sku:normalized,amazonSku};
}
export function beginCoinPurchase(request={}){return beginAmazonPurchase({internalSku:request.packageId});}
export function beginPremiumPurchase(plan={}){return beginAmazonPurchase({internalSku:plan.id||plan.planId});}
export function getAmazonCatalogDetails(){return Object.fromEntries(productCache);}
export function restoreAmazonPurchases(){
  const bridge=requireBridge();
  if(typeof bridge.requestPurchaseUpdates==='function')bridge.requestPurchaseUpdates(false);
  return {success:true,requested:true};
}
function install(){
  if(bridgeReady)return;
  bridgeReady=true;
  window.addEventListener('orvuno:amazon-iap-products',event=>{
    for(const [sku,p] of Object.entries(event.detail?.products||{}))productCache.set(sku,p||{});
    queueUiUpdate();
    window.dispatchEvent(new CustomEvent('world:amazon-catalog-ready',{detail:{products:getAmazonCatalogDetails()}}));
  });
  window.addEventListener('orvuno:amazon-iap-user',()=>refreshCatalogSoon(0));
  window.addEventListener('orvuno:amazon-iap-purchase',event=>verifyReceipt(event.detail||{}).catch(error=>feedback(error?.message||String(error),'error')));
  window.addEventListener('orvuno:amazon-iap-error',event=>feedback(event.detail?.message||'Amazon-IAP-Fehler','error'));
  const observer=new MutationObserver(mutations=>{if(mutations.some(m=>m.addedNodes.length||m.removedNodes.length))queueUiUpdate();});
  observer.observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){queueUiUpdate();refreshCatalogSoon(150);}});
  queueUiUpdate();
  refreshCatalogSoon(0);
  setTimeout(()=>refreshCatalogSoon(1200),1200);
  setTimeout(()=>{try{restoreAmazonPurchases();}catch{}},800);
}

const provider={id:'amazon',label:'Amazon Appstore',begin:beginAmazonPurchase,beginCoinPurchase,beginPremiumPurchase,getCatalogDetails:getAmazonCatalogDetails,restorePurchases:restoreAmazonPurchases};
window.worldPaymentProviders??={};
window.worldPaymentProviders.amazon=provider;
window.worldPaymentCheckout=provider;
window.worldAmazonIap={provider,AMAZON_SKU_MAP,getCatalogDetails:getAmazonCatalogDetails,restorePurchases:restoreAmazonPurchases};
install();