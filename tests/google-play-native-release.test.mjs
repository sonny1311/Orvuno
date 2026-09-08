import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');
const app=read('android/google/app/build.gradle');
const activity=read('android/google/app/src/main/java/de/nadena/orvuno/MainActivity.java');
const manifest=read('android/google/app/src/main/AndroidManifest.xml');
const bootstrap=read('js/core/StorePaymentProviderBootstrap.js');
const nativeClient=read('js/core/GooglePlayNativeBillingIntegration.js');
const premium=read('js/core/PremiumPlanUIIntegration.js');
const edge=read('supabase/functions/world-google-play/index.ts');

const expectedPlaySkus=[
  'orvuno_coins_100','orvuno_coins_550','orvuno_coins_1200','orvuno_coins_2600',
  'orvuno_coins_6000','orvuno_coins_13000','orvuno_coins_26000','orvuno_coins_50000',
  'orvuno_premium_1m','orvuno_premium_3m','orvuno_premium_6m','orvuno_premium_12m'
];

assert(app.includes("applicationId 'de.nadena.orvuno'"));
assert(app.includes('compileSdk 36'));
assert(app.includes('targetSdk 36'));
assert(app.includes('minSdk 23'));
assert(app.includes('versionCode 10'));
assert(app.includes("versionName '1.0.5'"));
assert(app.includes("com.android.billingclient:billing:9.1.0"));
assert(manifest.includes('android.permission.INTERNET'));
assert(activity.includes('BillingClient.newBuilder(this)'));
assert(activity.includes('enableOneTimeProducts()'));
assert(activity.includes('BillingClient.ProductType.INAPP'));
assert(activity.includes('launchBillingFlow'));
assert(activity.includes('queryPurchasesAsync'));
assert(activity.includes('OrvunoGooglePlay'));
assert(activity.includes('orvuno:google-play-purchase'));
assert(activity.includes('https://orvuno-worldproject.vercel.app/'));
for(const sku of expectedPlaySkus) assert(activity.includes(`"${sku}"`),`native wrapper missing ${sku}`);

const googleBlock=bootstrap.slice(bootstrap.indexOf("if(store==='google')"),bootstrap.indexOf("}else if(store==='amazon')"));
assert(googleBlock.includes('GooglePlayNativeBillingIntegration.js'));
assert(!/Stripe|Braintree|PayPal/i.test(googleBlock));
assert(nativeClient.includes("edge('verify_purchase'"));
assert(nativeClient.includes('purchaseToken'));
assert(nativeClient.includes('restoreGooglePlayPurchases'));
assert(nativeClient.includes('world:payment-return'));
assert(premium.includes("id:'premium_4w'"));
assert(premium.includes('durationDays:28'));
assert(!premium.includes("id:'premium_1m'"));

const expectedMap={
  coins_100:'orvuno_coins_100', coins_550:'orvuno_coins_550', coins_1200:'orvuno_coins_1200',
  coins_2600:'orvuno_coins_2600', coins_6000:'orvuno_coins_6000', coins_13000:'orvuno_coins_13000',
  coins_26000:'orvuno_coins_26000', coins_50000:'orvuno_coins_50000', premium_4w:'orvuno_premium_1m',
  premium_3m:'orvuno_premium_3m', premium_6m:'orvuno_premium_6m', premium_12m:'orvuno_premium_12m'
};
for(const [internal,play] of Object.entries(expectedMap)) assert(edge.includes(`${internal}:\"${play}\"`),`edge mapping missing ${internal} -> ${play}`);
assert(edge.includes('androidpublisher.googleapis.com/androidpublisher/v3/applications'));
assert(edge.includes('fulfill_google_play_purchase'));
assert(edge.includes(':consume'));
assert(edge.includes('sha256Hex(purchaseToken)'));
assert(edge.includes('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON'));

console.log('PASS: ORVUNO Google Play native release gates');
