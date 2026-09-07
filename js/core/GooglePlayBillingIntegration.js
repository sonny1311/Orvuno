// ORVUNO – Google Play Billing for Trusted Web Activity.
// Uses Digital Goods API for catalog access and Payment Request API for checkout.
// All entitlements are granted only after server-side verification in world-google-play.
const STORE_ID='https://play.google.com/billing';
let catalogPromise=null;
let servicePromise=null;

function api(){const a=window.worldAccounts?.authApi;if(!a)throw new Error('Google Play Billing ist noch nicht bereit');return a;}
async function edge(action,data={}){const a=api(),token=await a.ensureAccessToken();if(!token)throw new Error('Bitte zuerst anmelden');const r=await fetch(`${a.baseUrl}/functions/v1/world-google-play`,{method:'POST',headers:{apikey:a.publishableKey,Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({action,...data})});const b=await r.json().catch(()=>({}));if(!r.ok||b.success===false)throw new Error(b.error||b.message||`Google Play Billing fehlgeschlagen (${r.status})`);return b;}
async function service(){if(servicePromise)return servicePromise;servicePromise=(async()=>{if(typeof window.getDigitalGoodsService!=='function')throw new Error('Google Play Billing ist in dieser App-Umgebung nicht verfügbar');return window.getDigitalGoodsService(STORE_ID);})();try{return await servicePromise;}catch(error){servicePromise=null;throw error;}}
async function catalog(){if(catalogPromise)return catalogPromise;catalogPromise=edge('catalog').then(result=>{const products=Array.isArray(result?.products)?result.products:[];if(!products.length)throw new Error('Google-Play-Produktkatalog ist noch nicht konfiguriert');return products;}).catch(error=>{catalogPromise=null;throw error;});return catalogPromise;}
function normalizeToken(details={}){return String(details.purchaseToken||details.token||'').trim();}
async function productFor(internalSku){const products=await catalog();const product=products.find(x=>x.internalSku===internalSku);if(!product?.playSku)throw new Error('Dieses Produkt ist für Google Play noch nicht freigeschaltet');return product;}
async function refreshEntitlements(){try{await window.worldAccounts?.gameStateSync?.refreshBalances?.();await window.worldAccounts?.premiumLifecycle?.refreshAccount?.(window.worldAccounts?.authApi);}catch(error){console.warn('Google-Play-Gutschrift konnte nicht sofort neu geladen werden',error);}}

export async function getGooglePlayCatalogDetails(){
  const [svc,products]=await Promise.all([service(),catalog()]);
  const details=await svc.getDetails(products.map(x=>x.playSku));
  const byPlaySku=new Map((details||[]).map(x=>[String(x.itemId),x]));
  return products.map(product=>({
    ...product,
    detail:byPlaySku.get(product.playSku)||null
  }));
}

export async function restoreGooglePlayPurchases(){
  const svc=await service();
  const products=await catalog();
  const internalByPlay=new Map(products.map(x=>[x.playSku,x]));
  const purchases=await svc.listPurchases();
  const results=[];
  for(const purchase of purchases||[]){
    const playSku=String(purchase.itemId||purchase.sku||'');
    const mapped=internalByPlay.get(playSku);
    const purchaseToken=String(purchase.purchaseToken||purchase.token||'').trim();
    if(!mapped||!purchaseToken)continue;
    try{results.push(await edge('verify_purchase',{internalSku:mapped.internalSku,playSku,purchaseToken}));}
    catch(error){results.push({success:false,playSku,error:error?.message||String(error)});}
  }
  await refreshEntitlements();
  return results;
}

export async function beginGooglePlayPurchase({internalSku}={}){
  if(!internalSku)throw new Error('Ungültiges Kaufprodukt');
  const [svc,product]=await Promise.all([service(),productFor(internalSku)]);
  const request=new PaymentRequest([{supportedMethods:STORE_ID,data:{sku:product.playSku}}],{total:{label:'ORVUNO',amount:{currency:'EUR',value:'0'}}});
  let response=null;
  try{
    response=await request.show();
    const purchaseToken=normalizeToken(response?.details||{});
    if(!purchaseToken)throw new Error('Google Play hat keinen Kaufbeleg zurückgegeben');
    const verified=await edge('verify_purchase',{internalSku:product.internalSku,playSku:product.playSku,purchaseToken});
    if(!verified?.verified||!verified?.fulfilled)throw new Error('Google-Play-Kauf wurde nicht serverseitig bestätigt');
    try{await response.complete('success');}catch(_e){}
    await refreshEntitlements();
    window.dispatchEvent(new CustomEvent('world:payment-return',{detail:{provider:'google_play',status:'fulfilled',paid:true,fulfilled:true,sku:product.internalSku,playSku:product.playSku,consumePending:!!verified.consumePending}}));
    return verified;
  }catch(error){
    if(response){try{await response.complete('fail');}catch(_e){}}
    if(error?.name==='AbortError')throw new Error('Google-Play-Kauf wurde abgebrochen');
    throw error;
  }
}

export function beginCoinPurchase(request={}){return beginGooglePlayPurchase({internalSku:request.packageId});}
export function beginPremiumPurchase(plan={}){return beginGooglePlayPurchase({internalSku:plan.id||plan.planId});}

const provider={id:'google_play',label:'Google Play',begin:beginGooglePlayPurchase,beginCoinPurchase,beginPremiumPurchase,getCatalogDetails:getGooglePlayCatalogDetails,restorePurchases:restoreGooglePlayPurchases};
window.worldPaymentProviders??={};
window.worldPaymentProviders.google_play=provider;
window.worldPaymentCheckout=provider;
window.orvunoGooglePlayBilling=provider;
