// ORVUNO – Google Play Billing for Trusted Web Activity.
// Uses Digital Goods API for catalog access and Payment Request API for checkout.
// All entitlements are granted only after server-side verification in world-google-play.
const STORE_ID='https://play.google.com/billing';
let catalogPromise=null;
let servicePromise=null;
let autoRestorePromise=null;
let autoRestoreIdentity='';
let autoRestoreTimer=null;
let autoRestoreAttempts=0;

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

function restoreIdentity(){
  const user=window.worldCurrentUser||{};
  const id=String(user.id||user.authId||user.auth_user_id||user.public_id||'').trim();
  if(id)return id;
  const token=window.worldAccounts?.authApi?.session?.access_token||'';
  return token?`session:${String(token).slice(-24)}`:'';
}

export async function autoRestoreGooglePlayPurchases(){
  const auth=window.worldAccounts?.authApi;
  if(!auth?.session?.access_token||!window.worldCurrentUser)return false;
  const identity=restoreIdentity();
  if(!identity)return false;
  if(autoRestoreIdentity===identity)return true;
  if(autoRestorePromise)return autoRestorePromise;
  autoRestorePromise=(async()=>{
    try{
      const results=await restoreGooglePlayPurchases();
      const complete=results.every(result=>result?.success!==false);
      if(complete){
        autoRestoreIdentity=identity;
        window.dispatchEvent(new CustomEvent('world:google-play-restored',{detail:{results}}));
      }
      return complete;
    }catch(error){
      console.warn('Google-Play-Wiederherstellung wird später erneut versucht',error);
      return false;
    }finally{
      autoRestorePromise=null;
    }
  })();
  return autoRestorePromise;
}

function scheduleAutoRestore(delay=500){
  clearTimeout(autoRestoreTimer);
  autoRestoreTimer=setTimeout(async()=>{
    const complete=await autoRestoreGooglePlayPurchases();
    if(complete)return;
    if(autoRestoreAttempts>=4)return;
    autoRestoreAttempts+=1;
    scheduleAutoRestore(Math.min(4000,500*(2**autoRestoreAttempts)));
  },delay);
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
    if(verified.consumePending){autoRestoreIdentity='';autoRestoreAttempts=0;scheduleAutoRestore(700);}
    return verified;
  }catch(error){
    if(response){try{await response.complete('fail');}catch(_e){}}
    const errorName=String(error?.name||'').trim();
    const errorMessage=String(error?.message||'').trim();
    const errorCode=error?.code==null?'':String(error.code).trim();
    console.error('[ORVUNO Google Play] Kauf fehlgeschlagen',{
      stage:response?'after_checkout':'payment_request_show',
      internalSku,
      playSku:product.playSku,
      name:errorName,
      message:errorMessage,
      code:errorCode
    });
    if(errorName==='AbortError'){
      const details=[];
      if(errorMessage)details.push(`Meldung: ${errorMessage}`);
      if(errorCode)details.push(`Code: ${errorCode}`);
      throw new Error(`Google Play AbortError${details.length?` – ${details.join(' · ')}`:''}`);
    }
    throw error;
  }
}

export function beginCoinPurchase(request={}){return beginGooglePlayPurchase({internalSku:request.packageId});}
export function beginPremiumPurchase(plan={}){return beginGooglePlayPurchase({internalSku:plan.id||plan.planId});}

const provider={id:'google_play',label:'Google Play',begin:beginGooglePlayPurchase,beginCoinPurchase,beginPremiumPurchase,getCatalogDetails:getGooglePlayCatalogDetails,restorePurchases:restoreGooglePlayPurchases,autoRestorePurchases:autoRestoreGooglePlayPurchases};
window.worldPaymentProviders??={};
window.worldPaymentProviders.google_play=provider;
window.worldPaymentCheckout=provider;
window.orvunoGooglePlayBilling=provider;

const triggerAutoRestore=()=>{autoRestoreAttempts=0;scheduleAutoRestore(350);};
window.addEventListener('world:user-login',triggerAutoRestore);
window.addEventListener('world:access-granted',triggerAutoRestore);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>scheduleAutoRestore(900),{once:true});else scheduleAutoRestore(900);
