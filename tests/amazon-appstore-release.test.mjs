import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(path,'utf8');
const billing=read('js/core/AmazonAppstoreBillingIntegration.js');
const bootstrap=read('js/core/StorePaymentProviderBootstrap.js');
const edge=read('supabase/functions/world-amazon-iap/index.ts');
const gradle=read('android/amazon/app/build.gradle.kts');
const manifest=read('android/amazon/app/src/main/AndroidManifest.xml');
const activity=read('android/amazon/app/src/main/java/de/nadena/orvuno/MainActivity.java');
const migration=read('database/032_amazon_appstore_catalog.sql');

function test(name,fn){try{fn();console.log(`PASS ${name}`);}catch(error){console.error(`FAIL ${name}`);throw error;}}

const expected={
  coins_100:'orvuno_coins_100',
  coins_550:'orvuno_coins_550',
  coins_1200:'orvuno_coins_1200',
  coins_2600:'orvuno_coins_2600',
  coins_6000:'orvuno_coins_6000',
  coins_13000:'orvuno_coins_13000',
  coins_26000:'orvuno_coins_26000',
  coins_50000:'orvuno_coins_50000',
  premium_1m:'orvuno_premium_4w',
  premium_3m:'orvuno_premium_3m',
  premium_6m:'orvuno_premium_6m',
  premium_12m:'orvuno_premium_12m'
};

test('Amazon catalog maps every active ORVUNO offer',()=>{
  for(const [internalSku,amazonSku] of Object.entries(expected)){
    assert(billing.includes(`${internalSku}:'${amazonSku}'`),`${internalSku} must map to ${amazonSku}`);
    assert(edge.includes(`"${amazonSku}":"${internalSku==='premium_1m'?'premium_4w':internalSku}"`),`${amazonSku} missing in server verification map`);
  }
});

test('Amazon short premium offer is the live 4-week SKU',()=>{
  assert(billing.includes("premium_1m:'orvuno_premium_4w'"));
  assert(billing.includes("title.textContent='4 Wochen Premium'"));
  assert(billing.includes("sub.textContent='28 Tage Premium'"));
  assert(migration.includes("sku='premium_4w'"));
});

test('Amazon app never falls back to web checkout',()=>{
  const amazonBlock=bootstrap.slice(bootstrap.indexOf("}else if(store==='amazon')"),bootstrap.indexOf('}else{'));
  assert(amazonBlock.includes("AmazonAppstoreBillingIntegration.js"));
  assert(!/Stripe|Braintree/.test(amazonBlock));
});

test('Amazon purchases are server verified before fulfillment notification',()=>{
  const verifyPos=billing.indexOf('/functions/v1/world-amazon-iap');
  const successPos=billing.indexOf("body?.success!==true");
  const fulfilledPos=billing.indexOf("bridge.notifyFulfilled(receiptId)");
  assert(verifyPos>=0&&successPos>verifyPos&&fulfilledPos>successPos);
  assert(edge.includes('appstore-sdk.amazon.com/version/1.0/verifyReceiptId'));
  assert(edge.includes('fulfill_amazon_purchase'));
  assert(edge.includes('verified?.receiptId'));
  assert(edge.includes('verified?.productId'));
  assert(edge.includes('verified?.cancelDate'));
});

test('Amazon native wrapper is an update of the existing package',()=>{
  assert(gradle.includes('applicationId = "de.nadena.orvuno"'));
  assert(gradle.includes('versionCode = 2'));
  assert(gradle.includes('versionName = "1.0.1"'));
  assert(gradle.includes('com.amazon.device:amazon-appstore-sdk:3.0.9'));
});

test('Amazon manifest contains Appstore discovery and response receiver',()=>{
  assert(manifest.includes('com.amazon.sdktestclient'));
  assert(manifest.includes('com.amazon.venezia'));
  assert(manifest.includes('com.amazon.device.iap.ResponseReceiver'));
  assert(manifest.includes('com.amazon.inapp.purchasing.Permission.NOTIFY'));
  assert(manifest.includes('com.amazon.inapp.purchasing.NOTIFY'));
  assert(!manifest.includes('com.android.vending.BILLING'));
});

test('Native bridge exposes product, purchase, restore and fulfillment operations',()=>{
  for(const method of ['purchase(final String sku)','notifyFulfilled(final String receiptId)','requestProductData(final String jsonSkus)','requestPurchaseUpdates(final boolean reset)'])assert(activity.includes(method),`Missing native method ${method}`);
  assert(activity.includes('PurchasingService.registerListener'));
  assert(activity.includes('PurchasingService.enablePendingPurchases'));
  assert(activity.includes('orvuno:amazon-iap-products'));
  assert(activity.includes('orvuno:amazon-iap-purchase'));
});

console.log('All Amazon Appstore release tests passed.');
