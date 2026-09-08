// ORVUNO – lädt ausschließlich den Zahlungsanbieter, der auf der aktuellen Plattform erlaubt ist.
const store=window.orvunoAppBridge?.store||'web';
const crazyGamesBasic=window.orvunoCrazyGames?.active===true&&window.orvunoCrazyGames?.basicLaunch===true;

window.worldPaymentProviders??={};

if(crazyGamesBasic){
  // CrazyGames Basic Launch erlaubt keine Monetarisierung. Deshalb wird dort bewusst
  // kein Store-/Web-Zahlungsanbieter geladen.
  window.worldPaymentCheckout=null;
}else if(store==='google'){
  await import('./GooglePlayBillingIntegration.js');
}else if(store==='amazon'){
  // Amazon-App: ausschließlich native Amazon-IAP-Brücke + serverseitige RVS-Prüfung.
  // Externe Web-Zahlungsanbieter werden in der Amazon-App nicht geladen.
  await import('./AmazonAppstoreBillingIntegration.js');
}else{
  // Nur die normale Webversion darf externe Zahlungsanbieter laden.
  await import('./BraintreePaymentCheckoutIntegration.js');
  await import('./StripePaymentCheckoutIntegration.js');
}