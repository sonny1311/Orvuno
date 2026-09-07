import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync('js/core/GooglePlayBillingIntegration.js','utf8');
const start=source.indexOf('export async function beginGooglePlayPurchase');
const end=source.indexOf('export function beginCoinPurchase',start);
assert(start>=0&&end>start,'beginGooglePlayPurchase block must exist');
const block=source.slice(start,end);

const showIndex=block.indexOf('request.show()');
const firstAwaitIndex=block.indexOf('await ');
assert(showIndex>=0,'checkout must call PaymentRequest.show()');
assert(firstAwaitIndex<0||showIndex<firstAwaitIndex,'PaymentRequest.show() must run before the first await so transient user activation is preserved');
assert(!block.includes('Promise.all([service(),productFor'), 'purchase path must not await Digital Goods service/catalog before show()');
assert(block.includes('cachedProductFor(internalSku)'), 'purchase path must use the catalog already hydrated before the buy button is enabled');

console.log('PASS Google Play checkout preserves transient user activation');
