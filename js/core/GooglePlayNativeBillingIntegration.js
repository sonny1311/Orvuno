// ORVUNO – native Google Play Billing bridge for the Android wrapper.
// The Android side opens Play Billing; this module performs authenticated server verification and fulfillment.
const bridge=()=>window.OrvunoGooglePlay||window.OrvunoGoogleBilling||null;
const authApi=()=>window.worldAccounts?.authApi;
let catalogCache=null;
let nativeProducts=new Map();
let productsWaiter=null;
const pending=new Map();

async function edge(action,data={}){
  const api=authApi();
  if(!api)throw new Error('Google Play Billing ist noch nicht bereit');
  const token=await api.ensureAccessToken();
  if(!token)throw new Error('Bitte zuerst anmelden');
  const response=await fetch(`${api.baseUrl}/functions/v1/world-google-play`,{
    method:'POST',
    headers:{apikey:api.publishableKey,Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
    body:JSON.stringify({action,...data})
  });
  const body=await response.json().catch(()=>({}));
  if(!response.ok||body.success===false)throw new Error(body.error||body.message||`Google Play Billing fehlgeschlagen (${response.status})`);
  return body;
}

async function catalog(){
  if(catalogCache)return catalogCache;
  const result=await edge('catalog');
  catalogCache=Array.isArray(result?.products)?result.products:[];
  if(!catalogCache.length)throw new Error('Google-Play-Produktkatalog ist noch nicht konfiguriert');
  return catalogCache;
}

async function refreshEntitlements(){
  try{
    await window.worldAccounts?.gameStateSync?.refreshBalances?.();
    await window.worldAccounts?.premiumLifecycle?.refreshAccount?.(window.worldAccounts?.authApi);
  }catch(error){console.warn('Google-Play-Gutschrift konnte nicht sofort neu geladen werden',error);}
}

function requireBridge(){
  const value=bridge();
  if(!value||typeof value.purchase!=='function')throw new Error('Native Google Play Billing ist in dieser App nicht verfügbar');
  return value;
}

function requestNativeProducts(){
  const value=requireBridge();
  if(typeof value.queryProducts==='function')value.queryProducts();
}

function waitForProducts(timeoutMs=10000){
  if(nativeProducts.size)return Promise.resolve(nativeProducts);
  if(productsWaiter)return productsWaiter;
  productsWaiter=new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>{productsWaiter=null;reject(new Error('Google Play hat keine Produktdaten geliefert'));},timeoutMs);
    const done=()=>{clearTimeout(timeout);productsWaiter=null;resolve(nativeProducts);};
    window.addEventListener('orvuno:google-play-products',done,{once:true});
    requestNativeProducts();
  });
  return productsWaiter;
}

window.addEventListener('orvuno:google-play-products',event=>{
  const rows=Array.isArray(event?.detail?.products)?event.detail.products:[];
  nativeProducts=new Map(rows.map(row=>[String(row.productId||''),row]).filter(([sku])=>sku));
});

async function verifyNativePurchase(detail={}){
  const playSku=String(detail.productId||detail.products?.[0]||'').trim();
  const purchaseToken=String(detail.purchaseToken||'').trim();
  if(!playSku||!purchaseToken)throw new Error('Google Play hat keinen vollständigen Kaufbeleg zurückgegeben');
  const products=await catalog();
  const mapped=products.find(x=>x.playSku===playSku);
  if(!mapped)throw new Error(`Google-Play-Produkt ${playSku} ist ORVUNO nicht zugeordnet`);
  const verified=await edge('verify_purchase',{internalSku:mapped.internalSku,playSku,purchaseToken});
  if(!verified?.verified||!verified?.fulfilled)throw new Error('Google-Play-Kauf wurde nicht serverseitig bestätigt');
  await refreshEntitlements();
  window.dispatchEvent(new CustomEvent('world:payment-return',{detail:{provider:'google_play',status:'fulfilled',paid:true,fulfilled:true,sku:mapped.internalSku,playSku,consumePending:!!verified.consumePending}}));
  return verified;
}

window.addEventListener('orvuno:google-play-purchase',async event=>{
  const detail=event?.detail||{};
  const playSku=String(detail.productId||detail.products?.[0]||'').trim();
  try{
    const result=await verifyNativePurchase(detail);
    const waiter=pending.get(playSku);
    if(waiter){pending.delete(playSku);waiter.resolve(result);}
  }catch(error){
    console.error('[ORVUNO Google Play native] Verifizierung fehlgeschlagen',error);
    const waiter=pending.get(playSku);
    if(waiter){pending.delete(playSku);waiter.reject(error);}
  }
});

window.addEventListener('orvuno:google-play-error',event=>{
  const detail=event?.detail||{};
  const sku=String(detail.sku||'').trim();
  const message=String(detail.message||detail.stage||'Google Play Billing fehlgeschlagen');
  if(sku&&pending.has(sku)){
    const waiter=pending.get(sku);pending.delete(sku);waiter.reject(new Error(message));return;
  }
  if(detail.stage==='USER_CANCELED'){
    for(const [key,waiter] of pending){pending.delete(key);waiter.reject(new Error('Google-Play-Kauf wurde abgebrochen'));}
  }
});

export async function getGooglePlayCatalogDetails(){
  const [products,details]=await Promise.all([catalog(),waitForProducts()]);
  return products.map(product=>{
    const native=details.get(product.playSku)||null;
    const micros=Number(native?.priceAmountMicros);
    return {
      ...product,
      nativeDetail:native,
      detail:native?{
        itemId:product.playSku,
        title:native.title||'',
        description:native.description||'',
        price:{value:Number.isFinite(micros)?String(micros/1000000):'',currency:String(native.priceCurrencyCode||'EUR')}
      }:null
    };
  });
}

export async function beginGooglePlayPurchase({internalSku}={}){
  if(!internalSku)throw new Error('Ungültiges Kaufprodukt');
  const products=await catalog();
  const product=products.find(x=>x.internalSku===internalSku);
  if(!product?.playSku)throw new Error('Dieses Produkt ist für Google Play nicht freigeschaltet');
  await waitForProducts();
  if(!nativeProducts.has(product.playSku))throw new Error('Dieses Produkt wurde von Google Play auf diesem Gerät nicht gefunden');
  if(pending.has(product.playSku))throw new Error('Dieser Kauf wird bereits verarbeitet');
  const value=requireBridge();
  return new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>{
      if(pending.has(product.playSku)){pending.delete(product.playSku);reject(new Error('Google Play hat den Kauf nicht rechtzeitig beantwortet'));}
    },120000);
    pending.set(product.playSku,{resolve:r=>{clearTimeout(timeout);resolve(r);},reject:e=>{clearTimeout(timeout);reject(e);}});
    try{value.purchase(product.playSku);}catch(error){clearTimeout(timeout);pending.delete(product.playSku);reject(error);}
  });
}

export async function restoreGooglePlayPurchases(){
  const value=requireBridge();
  if(typeof value.restorePurchases!=='function')return [];
  value.restorePurchases();
  return [];
}

export function beginCoinPurchase(request={}){return beginGooglePlayPurchase({internalSku:request.packageId});}
export function beginPremiumPurchase(plan={}){return beginGooglePlayPurchase({internalSku:plan.id||plan.planId});}

const provider={id:'google_play',label:'Google Play',native:true,begin:beginGooglePlayPurchase,beginCoinPurchase,beginPremiumPurchase,getCatalogDetails:getGooglePlayCatalogDetails,restorePurchases:restoreGooglePlayPurchases};
window.worldPaymentProviders??={};
window.worldPaymentProviders.google_play=provider;
window.worldPaymentCheckout=provider;
window.orvunoGooglePlayBilling=provider;
requestNativeProducts();
