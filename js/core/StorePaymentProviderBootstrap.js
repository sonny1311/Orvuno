// ORVUNO – lädt ausschließlich den Zahlungsanbieter, der auf der aktuellen Plattform erlaubt ist.
const store=window.orvunoAppBridge?.store||'web';

window.worldPaymentProviders??={};

if(store==='google'){
  await import('./GooglePlayBillingIntegration.js');
  // Native Android wrapper: use BillingClient directly instead of relying on TWA PaymentRequest.
  if(window.OrvunoGooglePlay||window.OrvunoGoogleBilling){
    await import('./GooglePlayNativeBillingIntegration.js');
  }
}else if(store==='amazon'){
  // Amazon-App: ausschließlich native Amazon-IAP-Brücke + serverseitige RVS-Prüfung.
  // Externe Web-Zahlungsanbieter werden in der Amazon-App nicht geladen.
  await import('./AmazonAppstoreBillingIntegration.js');
}else{
  // Nur die normale Webversion darf externe Zahlungsanbieter laden.
  await import('./BraintreePaymentCheckoutIntegration.js');
  await import('./StripePaymentCheckoutIntegration.js');
}