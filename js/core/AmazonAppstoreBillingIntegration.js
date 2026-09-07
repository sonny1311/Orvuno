// ORVUNO – Amazon Appstore IAP. Kaufdaten werden serverseitig per Amazon RVS geprüft.
const AMAZON_SKU_MAP=Object.freeze({
  coins_100:'orvuno_coins_100',coins_550:'orvuno_coins_550',coins_1200:'orvuno_coins_1200',coins_2600:'orvuno_coins_2600',
  coins_6000:'orvuno_coins_6000',coins_13000:'orvuno_coins_13000',coins_26000:'orvuno_coins_26000',coins_50000:'orvuno_coins_50000',
  premium_1m:'orvuno_premium_4w',premium_3m:'orvuno_premium_3m',premium_6m:'orvuno_premium_6m',premium_12m:'orvuno_premium_12m'
});
const INTERNAL_BY_AMAZON=Object.freeze(Object.fromEntries(Object.entries(AMAZON_SKU_MAP).map(([k,v])=>[v,k])));
const productCache=new Map();
const inFlightReceipts=new Set();
let bridgeReady=false;

const nativeBridge=()=>window.OrvunoAmazonIap;
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
    if(product?.price){button.textContent=String(product.price);button.disabled=false;button.title='Abrechnung über Amazon Appstore';}
    else{button.disabled=true;button.title='Amazon-Preis wird geladen …';}
    if(internalSku==='premium_1m'){
      const card=button.closest('article');
      const title=card?.querySelector('h3');
      const sub=card?.querySelector('p');
      if(title)title.textContent='4 Wochen Premium';
      if(sub)sub.textContent='28 Tage Premium';
    }
  });
}
function requestProducts(){
  const bridge=requireBridge();
  if(typeof bridge.requestProductData!=='function')throw new Error('Amazon-Produktdaten können nicht geladen werden.');
  bridge.requestProductData(JSON.stringify(Object.values(AMAZON_SKU_MAP)));
}
export async function beginAmazonPurchase({internalSku}={}){
  const amazonSku=AMAZON_SKU_MAP[String(internalSku||'')];
  if(!amazonSku)throw new Error('Dieses Produkt ist im Amazon Appstore nicht verfügbar.');
  const product=productCache.get(amazonSku);
  if(!product)throw new Error('Der Amazon-Preis ist noch nicht geladen. Bitte einen Moment warten.');
  requireBridge().purchase(amazonSku);
  return {success:true,pending:true,provider:'amazon',sku:internalSku,amazonSku};
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
    const products=event.detail?.products||{};
    for(const [sku,p] of Object.entries(products))productCache.set(sku,p||{});
    updateAmazonCatalogUi();
    window.dispatchEvent(new CustomEvent('world:amazon-catalog-ready',{detail:{products:getAmazonCatalogDetails()}}));
  });
  window.addEventListener('orvuno:amazon-iap-purchase',event=>{
    verifyReceipt(event.detail||{}).catch(error=>feedback(error?.message||String(error),'error'));
  });
  window.addEventListener('orvuno:amazon-iap-error',event=>feedback(event.detail?.message||'Amazon-IAP-Fehler','error'));
  const observer=new MutationObserver(()=>updateAmazonCatalogUi());
  observer.observe(document.documentElement,{childList:true,subtree:true});
  updateAmazonCatalogUi();
  try{requestProducts();}catch(error){feedback(error?.message||String(error),'error');}
  setTimeout(()=>{try{restoreAmazonPurchases();}catch{}},800);
}

const provider={id:'amazon',label:'Amazon Appstore',begin:beginAmazonPurchase,beginCoinPurchase,beginPremiumPurchase,getCatalogDetails:getAmazonCatalogDetails,restorePurchases:restoreAmazonPurchases};
window.worldPaymentProviders??={};
window.worldPaymentProviders.amazon=provider;
window.worldPaymentCheckout=provider;
window.worldAmazonIap={provider,AMAZON_SKU_MAP,getCatalogDetails:getAmazonCatalogDetails,restorePurchases:restoreAmazonPurchases};
install();
