// ORVUNO – Stripe Hosted Checkout provider.
// Preis und Kaufprodukt werden serverseitig aus store_products aufgelöst.
function api(){const a=window.worldAccounts?.authApi;if(!a)throw new Error('Zahlungssystem ist noch nicht bereit');return a;}
function assertCheckoutContext(){if(window.worldBusinessSwitchPaymentGuard?.blocked?.())throw new Error('Während eines Betriebswechsels kann keine Zahlung gestartet werden');}
async function edge(action,data={}){const a=api(),token=await a.ensureAccessToken();if(!token)throw new Error('Bitte zuerst anmelden');const r=await fetch(`${a.baseUrl}/functions/v1/world-payments`,{method:'POST',headers:{apikey:a.publishableKey,Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({action,...data})});const b=await r.json().catch(()=>({}));if(!r.ok||b.success===false)throw new Error(b.error||b.message||`Zahlung fehlgeschlagen (${r.status})`);return b;}

export async function beginStripePurchase({sku}={}){
 assertCheckoutContext();
 if(!sku)throw new Error('Ungültiges Kaufprodukt');
 if(window.orvunoAppBridge?.isNativeApp)throw new Error('Externe Zahlungen sind in der Store-App deaktiviert');
 const result=await edge('stripe_checkout',{sku});
 const environment=result?.environment,sessionId=String(result?.sessionId||''),prefix=environment==='live'?'cs_live_':environment==='test'?'cs_test_':'';
 if(!prefix||!sessionId.startsWith(prefix)||!result?.url)throw new Error('Stripe-Checkout konnte nicht sicher gestartet werden');
 location.assign(result.url);
 return {success:true,opened:true,provider:'stripe',environment,sessionId};
}
export function beginCoinPurchase(request={}){return beginStripePurchase({sku:request.packageId});}
export function beginPremiumPurchase(plan={}){return beginStripePurchase({sku:plan.id||plan.planId});}

function cleanStripeReturnUrl(){
 try{const u=new URL(location.href);u.searchParams.delete('payment');u.searchParams.delete('session_id');history.replaceState(history.state,'',u.pathname+(u.search?u.search:'')+u.hash);}catch(_e){}
}
function emitReturn(detail){
 try{window.dispatchEvent(new CustomEvent('world:payment-return',{detail}));}catch(_e){}
}
function showPaymentNotice(message,kind='info'){
 if(window.worldNotifications?.show){window.worldNotifications.show(message,{kind});return;}
 if(!document?.body)return;
 const box=document.createElement('div');
 box.setAttribute('role','status');
 box.textContent=message;
 box.style.cssText='position:fixed;right:18px;bottom:18px;z-index:2147483647;max-width:420px;padding:12px 16px;border-radius:10px;background:#172033;color:#fff;box-shadow:0 8px 28px rgba(0,0,0,.35);font:600 14px/1.4 system-ui,sans-serif';
 document.body.appendChild(box);
 setTimeout(()=>box.remove(),6500);
}
async function waitForPaymentApi(){
 for(let i=0;i<24;i++){
  if(window.worldAccounts?.authApi)return window.worldAccounts.authApi;
  await new Promise(resolve=>setTimeout(resolve,250));
 }
 throw new Error('Zahlungssystem ist noch nicht bereit');
}
async function verifyFulfillment(sessionId){
 let result=null;
 for(let i=0;i<6;i++){
  result=await edge('stripe_status',{sessionId});
  if(result?.fulfilled===true||result?.paid!==true)return result;
  if(i<5)await new Promise(resolve=>setTimeout(resolve,650));
 }
 return result;
}
async function refreshEntitlements(){
 try{
  await window.worldAccounts?.gameStateSync?.refreshBalances?.();
  await window.worldAccounts?.premiumLifecycle?.refreshAccount?.(window.worldAccounts.authApi);
 }catch(error){console.warn('Stripe-Gutschrift konnte nicht sofort neu geladen werden',error);}
}

export async function verifyStripeReturn(){
 if(window.orvunoAppBridge?.isNativeApp)return null;
 let url;
 try{url=new URL(location.href);}catch(_e){return null;}
 const state=url.searchParams.get('payment');
 if(state!=='stripe_success'&&state!=='stripe_cancelled')return null;

 if(state==='stripe_cancelled'){
  cleanStripeReturnUrl();
  const detail={provider:'stripe',status:'cancelled',paid:false,fulfilled:false};
  emitReturn(detail);
  showPaymentNotice('Stripe-Zahlung abgebrochen. Es wurde nichts gekauft.','info');
  return detail;
 }

 const sessionId=String(url.searchParams.get('session_id')||'');
 if(!/^cs_(test|live)_/.test(sessionId)){
  cleanStripeReturnUrl();
  const detail={provider:'stripe',status:'invalid_return',paid:false,fulfilled:false};
  emitReturn(detail);
  showPaymentNotice('Stripe-Rückkehr konnte nicht sicher geprüft werden. Es wurde clientseitig nichts gutgeschrieben.','error');
  return detail;
 }

 try{
  await waitForPaymentApi();
  const result=await verifyFulfillment(sessionId);
  cleanStripeReturnUrl();
  const environment=result?.environment;
  const paid=['test','live'].includes(environment)&&result?.sessionId===sessionId&&result?.paid===true;
  const fulfilled=paid&&result?.fulfilled===true;
  const detail={provider:'stripe',environment,status:fulfilled?'fulfilled':paid?'paid_pending_fulfillment':'pending',paid,fulfilled,sessionId,sku:result?.sku||'',checkoutStatus:result?.checkoutStatus||'',paymentStatus:result?.paymentStatus||''};
  emitReturn(detail);
  if(fulfilled){await refreshEntitlements();showPaymentNotice('✅ Stripe-Zahlung bestätigt und serverseitig gutgeschrieben.','success');}
  else if(paid)showPaymentNotice('Stripe-Zahlung ist bestätigt. Die serverseitige Gutschrift ist noch in Bearbeitung; es erfolgt keine clientseitige Doppelgutschrift.','info');
  else showPaymentNotice('Stripe-Zahlung ist noch nicht als bezahlt bestätigt. Es wurde noch nichts gutgeschrieben.','info');
  return detail;
 }catch(error){
  cleanStripeReturnUrl();
  const detail={provider:'stripe',status:'verification_failed',paid:false,fulfilled:false,sessionId,error:error instanceof Error?error.message:String(error)};
  emitReturn(detail);
  showPaymentNotice('Stripe-Zahlung konnte nicht sicher bestätigt werden. Es wurde clientseitig nichts gutgeschrieben.','error');
  return detail;
 }
}

function install(){
 if(window.orvunoAppBridge?.isNativeApp)return false;
 window.worldPaymentProviders??={};
 const provider={id:'stripe',label:'Stripe',beginCoinPurchase,beginPremiumPurchase,begin:beginStripePurchase,verifyReturn:verifyStripeReturn};
 window.worldPaymentProviders.stripe=provider;
 window.worldPaymentCheckout=provider;
 const run=()=>verifyStripeReturn().catch(()=>{});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else queueMicrotask(run);
 return true;
}
if(typeof window!=='undefined')install();
