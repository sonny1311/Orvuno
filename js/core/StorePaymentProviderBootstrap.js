// ORVUNO – lädt ausschließlich den Zahlungsanbieter, der auf der aktuellen Plattform erlaubt ist.
const params=new URLSearchParams(location.search);
const crazyGamesBasic=
  params.get('source')==='crazygames'||
  params.get('crazygames')==='1'||
  params.get('platform')==='crazygames'||
  (window.orvunoCrazyGames?.active===true&&window.orvunoCrazyGames?.basicLaunch===true);
const store=window.orvunoAppBridge?.store||'web';

window.worldPaymentProviders??={};

if(crazyGamesBasic){
  // CrazyGames Basic Launch: keine Monetarisierung und vor allem keine schweren
  // Web-Zahlungs-SDKs im Startpfad laden.
  window.orvunoCrazyGames={...(window.orvunoCrazyGames||{}),active:true,basicLaunch:true};
  window.worldPaymentCheckout=null;
}else if(store==='google'){
  await import('./GooglePlayBillingIntegration.js');
}else if(store==='amazon'){
  await import('./AmazonAppstoreBillingIntegration.js');
}else{
  await import('./BraintreePaymentCheckoutIntegration.js');
  await import('./StripePaymentCheckoutIntegration.js');
}
