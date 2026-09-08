import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const bootstrap=await readFile('js/core/StorePaymentProviderBootstrap.js','utf8');
const amazon=await readFile('js/core/AmazonAppstoreBillingIntegration.js','utf8');
const css=await readFile('css/public-content.css','utf8');
const gameId=await readFile('js/core/GameIdAccess.js','utf8');

assert.match(bootstrap,/store==='amazon'[\s\S]*AmazonAppstoreBillingIntegration\.js/,'Amazon store must load the native Amazon billing integration');
for(const sku of [
  'orvuno_coins_100','orvuno_coins_550','orvuno_coins_1200','orvuno_coins_2600',
  'orvuno_coins_6000','orvuno_coins_13000','orvuno_coins_26000','orvuno_coins_50000',
  'orvuno_premium_4w','orvuno_premium_3m','orvuno_premium_6m','orvuno_premium_12m'
]) assert.ok(amazon.includes(sku),`Missing Amazon SKU ${sku}`);
assert.match(amazon,/premium_1m:'orvuno_premium_4w'/,'Amazon first premium offer must use the live 4-week SKU');
assert.ok(!amazon.includes("premium_1m:'orvuno_premium_1m'"),'Amazon must not request the nonexistent 1-month SKU');
assert.match(amazon,/OrvunoAmazonIap\|\|window\.OrvunoAmazonIAP/,'Both deployed native bridge spellings must remain supported');
assert.ok(amazon.includes('/functions/v1/world-amazon-iap'),'Amazon receipts must be verified by the server');
assert.ok(!amazon.includes("if(!productCache.get(amazonSku))throw"),'Amazon checkout must not be blocked by missing catalog metadata');
assert.match(amazon,/button\.disabled=false/,'Mapped Amazon purchase buttons must remain clickable while prices load');
assert.match(amazon,/bridge\.purchase\(amazonSku\)/,'Amazon checkout must call the generic native bridge directly');
assert.match(amazon,/orvuno:amazon-iap-user/,'Amazon catalog must refresh after the native Amazon user becomes available');
assert.match(amazon,/Im Appstore kaufen/,'Store build must show a usable neutral fallback label while catalog metadata is unavailable');
assert.doesNotMatch(amazon,/title:'Amazon Appstore'|Über Amazon kaufen|Amazon-Kauf wird geöffnet/,'Player-visible Amazon branding must not be used in the in-game purchase UI');
assert.match(css,/@media\(max-width:760px\)\{\.sitebar\{position:static\}/,'Mobile public pages must not lose reading space to a sticky header');
assert.match(gameId,/Spiel starten/,'Direct player start must remain available');
assert.doesNotMatch(gameId,/Spiel-ID laden|ORV-XXXXX-XXXXX-XXXXX-XXXXX|oder vorhandenen Spielstand laden/,'Amazon entry screen must not expose game-ID recovery');

console.log('Amazon Appstore IAP, direct player access and mobile guide regression checks passed.');