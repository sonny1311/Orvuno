// ORVUNO – prevents stale web prices from being offered inside the Google Play TWA.
(function(){
  if(window.orvunoAppBridge?.store!=='google')return;
  let running=false,loaded=false,retryTimer=null;
  const buttons=()=>[...document.querySelectorAll('[data-premium-offer],[data-coin-offer]')];
  function lock(){for(const b of buttons()){b.disabled=true;b.dataset.googlePlayPricePending='1';b.textContent='Google Play wird geladen …';}}
  function money(detail){
    const value=Number(detail?.price?.value),currency=String(detail?.price?.currency||'EUR');
    if(!Number.isFinite(value))return String(detail?.price?.value||'');
    try{return new Intl.NumberFormat(navigator.language||'de-DE',{style:'currency',currency}).format(value);}catch(_e){return `${value.toFixed(2)} ${currency}`;}
  }
  async function hydrate(){
    if(running||loaded)return;
    const provider=window.worldPaymentProviders?.google_play;
    if(!provider?.getCatalogDetails){retryTimer=setTimeout(hydrate,300);return;}
    if(!window.worldAccounts?.authApi){retryTimer=setTimeout(hydrate,500);return;}
    running=true;lock();
    try{
      const rows=await provider.getCatalogDetails();
      const byInternal=new Map(rows.filter(x=>x.detail).map(x=>[x.internalSku,x.detail]));
      for(const b of buttons()){
        const sku=b.dataset.premiumOffer||b.dataset.coinOffer||'';
        const detail=byInternal.get(sku);
        if(!detail){b.textContent='In Google Play nicht verfügbar';b.disabled=true;continue;}
        const label=money(detail);
        b.textContent=label||'Über Google Play kaufen';
        b.disabled=false;
        delete b.dataset.googlePlayPricePending;
        if(b.dataset.premiumOffer){
          const article=b.closest('article');
          const candidates=article?[...article.querySelectorAll('div')]:[];
          const priceNode=candidates.find(el=>/€|EUR|\d+[,.]\d{2}/.test((el.textContent||'').trim())&&getComputedStyle(el).fontWeight>=700);
          if(priceNode)priceNode.textContent=label;
        }
      }
      loaded=true;
    }catch(error){
      console.warn('Google-Play-Preise konnten nicht geladen werden',error);
      for(const b of buttons()){b.textContent='Google Play derzeit nicht verfügbar';b.disabled=true;}
    }finally{running=false;}
  }
  lock();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',hydrate,{once:true});else hydrate();
  window.addEventListener('world:open-premium',()=>{loaded=false;queueMicrotask(()=>{lock();hydrate();});});
  const observer=new MutationObserver(mutations=>{if(loaded||running)return;if(mutations.some(m=>m.addedNodes.length)){lock();hydrate();}});
  observer.observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('beforeunload',()=>{if(retryTimer)clearTimeout(retryTimer);observer.disconnect();},{once:true});
})();
