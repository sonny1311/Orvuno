// ORVUNO – lädt ausschließlich den Zahlungsanbieter, der auf der aktuellen Plattform erlaubt ist.
const store=window.orvunoAppBridge?.store||'web';

function unavailable(label){
  const fail=()=>Promise.reject(new Error(`${label} ist in dieser App-Version noch nicht verfügbar.`));
  return {id:store,label,begin:fail,beginCoinPurchase:fail,beginPremiumPurchase:fail};
}

window.worldPaymentProviders??={};

if(store==='google'){
  await import('./GooglePlayBillingIntegration.js');
}else if(store==='amazon'){
  // Amazon wird separat über den nativen Amazon-IAP-Wrapper bedient. Niemals externen Checkout laden.
  if(window.worldPaymentProviders.amazon)window.worldPaymentCheckout=window.worldPaymentProviders.amazon;
  else window.worldPaymentCheckout=unavailable('Amazon In-App-Kauf');
}else{
  // Nur die normale Webversion darf externe Zahlungsanbieter laden.
  await import('./BraintreePaymentCheckoutIntegration.js');
  await import('./StripePaymentCheckoutIntegration.js');
}
