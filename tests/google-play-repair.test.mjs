import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=path=>fs.readFileSync(path,'utf8');
const index=read('index.html');
const platform=read('js/core/AppPlatformBridge.js');
const storeBootstrap=read('js/core/StorePaymentProviderBootstrap.js');
const playClient=read('js/core/GooglePlayBillingIntegration.js');
const playPriceUi=read('js/core/GooglePlayPriceUiIntegration.js');
const mobileUi=read('js/core/MobileAppUsabilityIntegration.js');
const edge=read('supabase/functions/world-google-play/index.ts');
const migration=read('database/031_google_play_billing_fulfillment.sql');
const appLoader=read('js/app-loader.js');
const assetlinks=read('api/assetlinks.js');
const vercel=JSON.parse(read('vercel.json'));

function test(name,fn){
  try{fn();console.log(`PASS ${name}`);}catch(error){console.error(`FAIL ${name}`);throw error;}
}

function runPlatform({search='',referrer='',standalone=false,stored=''}){
  const memory=new Map(stored?[['orvuno.nativeStore',stored]]:[]);
  const document={referrer,documentElement:{dataset:{}},querySelectorAll:()=>[]};
  const navigator={onLine:true};
  const window={
    navigator,
    matchMedia:()=>({matches:standalone}),
    addEventListener:()=>{},
    dispatchEvent:()=>{},
    localStorage:{getItem:key=>memory.get(key)||null,setItem:(key,value)=>memory.set(key,String(value))}
  };
  const context={
    window,document,navigator,
    location:{search,protocol:'https:'},
    localStorage:window.localStorage,
    URLSearchParams,
    CustomEvent:function(type,init){this.type=type;this.detail=init?.detail;},
    addEventListener:()=>{},
    getComputedStyle:()=>({display:'none',visibility:'hidden'}),
    console,
    Map
  };
  vm.runInNewContext(platform,context,{filename:'AppPlatformBridge.js'});
  return {store:window.orvunoAppBridge.store,memory};
}

test('index has no unconditional external payment scripts',()=>{
  assert(!index.includes('src="js/core/BraintreePaymentCheckoutIntegration.js"'));
  assert(!index.includes('src="js/core/StripePaymentCheckoutIntegration.js"'));
  assert(index.includes('src="js/core/StorePaymentProviderBootstrap.js"'));
});

test('heavy game bootstrap is deferred behind app-loader',()=>{
  assert(index.includes('src="js/app-loader.js"'));
  assert(!index.includes('src="js/bootstrap.js"'));
  assert(appLoader.indexOf('ensureAccess()')<appLoader.indexOf("import('./bootstrap.js')"));
});

test('normal web visit stays web even after a stored native marker',()=>{
  assert.equal(runPlatform({stored:'google'}).store,'web');
});

test('android-app referrer is fail-closed to Google Play by default',()=>{
  assert.equal(runPlatform({referrer:'android-app://de.nadena.orvuno'}).store,'google');
});

test('legacy standalone source=app launch is recognized as Google Play',()=>{
  assert.equal(runPlatform({search:'?source=app',standalone:true}).store,'google');
});

test('explicit Amazon context is preserved',()=>{
  assert.equal(runPlatform({search:'?orvuno_store=amazon'}).store,'amazon');
});

test('store bootstrap never imports external checkout for Google or Amazon branches',()=>{
  const googleBlock=storeBootstrap.slice(storeBootstrap.indexOf("if(store==='google')"),storeBootstrap.indexOf("}else if(store==='amazon')"));
  const amazonBlock=storeBootstrap.slice(storeBootstrap.indexOf("}else if(store==='amazon')"),storeBootstrap.indexOf('}else{'));
  assert(googleBlock.includes('GooglePlayBillingIntegration.js'));
  assert(!/Stripe|Braintree/.test(googleBlock));
  assert(!/Stripe|Braintree/.test(amazonBlock));
});

test('Google Play browser flow uses official billing method and server verification',()=>{
  assert(playClient.includes("https://play.google.com/billing"));
  assert(playClient.includes('new PaymentRequest'));
  assert(playClient.includes("edge('verify_purchase'"));
  assert(playClient.includes('restoreGooglePlayPurchases'));
  assert(!/stripe|braintree|paypal/i.test(playClient));
});

test('Google Play price UI disables purchases until Play catalog is available',()=>{
  assert(playPriceUi.includes('b.disabled=true'));
  assert(playPriceUi.includes('getCatalogDetails'));
  assert(playPriceUi.includes('In Google Play nicht verfügbar'));
});

test('Google Play edge verifies purchase server-side and uses hashed token idempotency key',()=>{
  assert(edge.includes('androidpublisher.googleapis.com/androidpublisher/v3/applications'));
  assert(edge.includes('/purchases/products/'));
  assert(edge.includes('purchaseState)!==0'));
  assert(edge.includes('sha256Hex(purchaseToken)'));
  assert(edge.includes('fulfill_google_play_purchase'));
  assert(edge.includes(':consume'));
  assert(edge.includes('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON'));
  assert(edge.includes('GOOGLE_PLAY_SKU_MAP_JSON'));
});

test('verified Google Play product IDs are mapped to every active ORVUNO product',()=>{
  const expected={
    coins_100:'orvuno_coins_100',
    coins_550:'orvuno_coins_550',
    coins_1200:'orvuno_coins_1200',
    coins_2600:'orvuno_coins_2600',
    coins_6000:'orvuno_coins_6000',
    coins_13000:'orvuno_coins_13000',
    coins_26000:'orvuno_coins_26000',
    coins_50000:'orvuno_coins_50000',
    premium_1m:'orvuno_premium_1m',
    premium_3m:'orvuno_premium_3m',
    premium_6m:'orvuno_premium_6m',
    premium_12m:'orvuno_premium_12m'
  };
  for(const [internalSku,playSku] of Object.entries(expected)){
    assert(edge.includes(`${internalSku}:"${playSku}"`),`${internalSku} must map to ${playSku}`);
  }
  assert(edge.includes('if(!raw)return {...DEFAULT_SKU_MAP}'));
});

test('payment migration fixes status domain and locks fulfillment to service role',()=>{
  for(const status of ["'paid'","'succeeded'","'purchased'"])assert(migration.includes(status));
  assert(migration.includes("values(p_user_id,'google_play'"));
  assert(migration.includes('on conflict(provider,provider_transaction_id) do nothing'));
  assert(migration.includes('REVOKE EXECUTE ON FUNCTION public.fulfill_google_play_purchase'));
  assert(migration.includes('GRANT EXECUTE ON FUNCTION public.fulfill_google_play_purchase'));
});

test('mobile DOM normalization is throttled and limited to structural mutations',()=>{
  assert(mobileUi.includes('setTimeout(()=>requestAnimationFrame'));
  assert(mobileUi.includes('if(!isMobile()||queued)return'));
  assert(mobileUi.includes('m.addedNodes.length||m.removedNodes.length'));
  assert(mobileUi.includes('observer.disconnect()'));
});

test('Digital Asset Links route is fail-closed and package-bound',()=>{
  assert.deepEqual(vercel.rewrites,[{source:'/.well-known/assetlinks.json',destination:'/api/assetlinks'}]);
  const transformed=assetlinks.replace('export default function handler','function handler')+'\nthis.__handler=handler;';
  const execute=fingerprint=>{
    const result={status:null,body:null,headers:{}};
    const res={setHeader:(k,v)=>result.headers[k]=v,status(code){result.status=code;return this;},json(body){result.body=body;return this;}};
    const context={process:{env:{GOOGLE_PLAY_APP_SIGNING_SHA256:fingerprint}},console};
    vm.runInNewContext(transformed,context,{filename:'assetlinks.js'});
    context.__handler({},res);
    return result;
  };
  assert.equal(execute('').status,503);
  const valid=Array.from({length:32},()=> 'AA').join(':');
  const ok=execute(valid);
  assert.equal(ok.status,200);
  assert.equal(ok.body[0].target.package_name,'de.nadena.orvuno');
  assert.equal(ok.body[0].target.sha256_cert_fingerprints[0],valid);
});

console.log('All Google Play repair tests passed.');
