import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(path,'utf8');
const billing=read('js/core/AmazonAppstoreBillingIntegration.js');
const bootstrap=read('js/core/StorePaymentProviderBootstrap.js');
const edge=read('supabase/functions/world-amazon-iap/index.ts');
const migration=read('database/032_amazon_appstore_catalog.sql');

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

for(const [internalSku,amazonSku] of Object.entries(expected)){
  assert(billing.includes(`${internalSku}:'${amazonSku}'`),`browser map missing ${internalSku}`);
  const serverInternal=internalSku==='premium_1m'?'premium_4w':internalSku;
  assert(edge.includes(`\"${amazonSku}\":\"${serverInternal}\"`),`server map missing ${amazonSku}`);
}

const amazonStart=bootstrap.indexOf("}else if(store==='amazon')");
const webStart=bootstrap.indexOf('}else{',amazonStart);
assert(amazonStart>=0&&webStart>amazonStart,'Amazon payment branch must exist');
const amazonBlock=bootstrap.slice(amazonStart,webStart);
assert(amazonBlock.includes('AmazonAppstoreBillingIntegration.js'),'Amazon branch must load native runtime');
assert(!/Stripe|Braintree/.test(amazonBlock),'Amazon branch must never load web checkout');

const verifyPos=billing.indexOf('/functions/v1/world-amazon-iap');
const verifiedPos=billing.indexOf('body?.success!==true');
const fulfillPos=billing.indexOf('bridge.notifyFulfilled(receiptId)');
assert(verifyPos>=0&&verifiedPos>verifyPos&&fulfillPos>verifiedPos,'Amazon receipt must be server verified before fulfillment');
assert(edge.includes('appstore-sdk.amazon.com/version/1.0/verifyReceiptId'),'Amazon RVS endpoint missing');
assert(edge.includes('fulfill_amazon_purchase'),'Amazon idempotent fulfillment missing');
assert(migration.includes("sku='premium_4w'"),'Amazon 4-week premium must stay active');

console.log('All Amazon runtime checks passed.');
