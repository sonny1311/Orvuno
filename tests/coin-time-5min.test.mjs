import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runTimeValueUtilsTest} from '../js/core/TimeValueUtils.js';
import {runActiveOperationsOverviewTest} from '../js/core/ActiveOperationsOverview.js';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [operation,migration,home,transport,construction,policy,ui,upgrades,maintenanceUI]=await Promise.all([
 read('js/core/OperationCoinTimeReductionSystem.js'),
 read('database/032_coin_time_reduction_five_minute_rate.sql'),
 read('js/core/HomeDeliveryCoinShortcutIntegration.js'),
 read('js/core/TransportCoinTimeReductionSystem.js'),
 read('js/core/ConstructionPremiumCoinSystem.js'),
 read('js/core/ConstructionCoinAccelerationPolicy.js'),
 read('js/core/CoinTimeAccelerationUIIntegration.js'),
 read('js/core/TimedBusinessUpgradeUI.js'),
 read('js/core/MachineMaintenanceUIIntegration.js')
]);

const coinCost=ms=>ms>0?Math.ceil(ms/300000):0;
assert.equal(coinCost(5*60000),1,'5 Minuten müssen 1 Coin kosten');
assert.equal(coinCost(60*60000),12,'60 Minuten müssen 12 Coins kosten');
assert.equal(coinCost(61*60000),13,'61 Minuten müssen 13 Coins kosten');
assert.equal(coinCost(5*60000+1),2,'angefangene zweite 5-Minuten-Einheit muss aufgerundet werden');

assert.match(operation,/COIN_TIME_UNIT_MINUTES=5/,'Client kennt die 5-Minuten-Einheit nicht');
assert.match(operation,/Math\.ceil\(value\/COIN_TIME_UNIT_MS\)/,'Client rundet Coin-Kosten nicht je angefangene 5 Minuten');
assert.match(operation,/fullOperationTimeReductionQuote/,'Vollständige Zeitverkürzung fehlt');
assert.match(operation,/shorten_company_timed_action/,'Coin-Abbuchung läuft nicht über den sicheren Server-RPC');
assert.match(operation,/inFlight\.has\(key\)/,'Doppelklick-/Parallel-Schutz fehlt im Client');
assert.match(operation,/sync\.saving=true/,'Autosave wird während der atomaren Serverbuchung nicht blockiert');
assert.doesNotMatch(operation,/company\.coins\s*=\s*n\(company\.coins\)\s*-/,'Generischer Client zieht Coins selbst ab');

assert.match(migration,/ceil\(v_reduction_ms::numeric \/ 300000\)/,'Server verwendet nicht 1 Coin je angefangene 5 Minuten');
assert.match(migration,/FOR UPDATE/,'Server sperrt Wallet/Betrieb nicht gegen parallele Buchungen');
assert.match(migration,/SECURITY DEFINER[\s\S]*SET search_path TO ''/,'SECURITY-DEFINER-RPC ist nicht gehärtet');
for(const kind of ['production','delivery','construction','land','warehouse_expansion','machine_upgrade','business_upgrade','equipment','maintenance','crew_arrival'])assert.match(migration,new RegExp(`WHEN '${kind}'`),`Serverpfad fehlt für ${kind}`);
assert.match(migration,/constructionSite[^\n]*deliveries/,'Baumaterial-Lieferungen fehlen im Serverpfad');
assert.match(migration,/maintenanceJob/,'Maschinenwartung fehlt im Serverpfad');
assert.match(migration,/crewBookings/,'Bautrupp-Anfahrt fehlt im Serverpfad');

assert.match(home,/COIN_TIME_RULE_LABEL/,'Startseite zeigt die Coin-Zeitregel nicht');
assert.match(home,/fullOperationTimeReductionQuote/,'Startseite bietet keine exakte Sofort-Fertig-Kalkulation');
assert.match(home,/reduceOperationTimeWithCoins/,'Startseite verwendet nicht den sicheren generischen RPC-Pfad');
assert.doesNotMatch(home,/reduceTransportTimeWithCoins/,'Startseite verwendet noch die alte lokale Transportabbuchung');
assert.match(ui,/60 Min\. = 12 Coins/,'Spieloberflächen erklären das 60-Minuten-Beispiel nicht');
assert.match(ui,/Sofort fertig/,'Sichtbarer Coin-Zeit-Button fehlt');
assert.match(ui,/Maschinenmontage|Montage|equipment/,'Maschinenzeiten werden nicht integriert');
assert.match(ui,/maintenance/,'Wartungszeiten werden nicht integriert');
assert.match(ui,/crew_arrival/,'Bautrupp-Anfahrt wird nicht integriert');
assert.match(ui,/construction_material_order/,'Baumaterial-Lieferzeit wird nicht integriert');
assert.match(ui,/business_upgrade/,'Betriebsausbau wird nicht integriert');

assert.match(transport,/coinCostForMs/,'Transportquote nutzt die 5-Minuten-Regel nicht');
assert.match(transport,/reduceOperationTimeWithCoins/,'Transportverkürzung läuft nicht über den sicheren Serverpfad');
assert.doesNotMatch(transport,/company\.coins\s*=.*-/,'Transport-Client zieht Coins noch selbst ab');
assert.match(construction,/COIN_TIME_RULE_LABEL/,'Bau-/Ausbaudialog zeigt die Regel nicht');
assert.match(construction,/reduceOperationTimeWithCoins/,'Bau-/Ausbaudialog verwendet nicht den sicheren Serverpfad');
assert.match(policy,/minutesPerCoin:5/,'Montage-/Baupolicy ist nicht auf 5 Minuten gestellt');
assert.match(policy,/coinsPerHour:12/,'60 Minuten werden in der Policy nicht als 12 Coins abgebildet');
assert.doesNotMatch(policy,/minimumRealTimeRatio:0\.25/,'Alte 25-Prozent-Zwangswartezeit ist noch aktiv');

assert.match(upgrades,/1 Coin je angefangene 5 Minuten/,'Betriebsausbau erklärt die 5-Minuten-Regel nicht');
assert.match(upgrades,/60 Minuten kosten 12 Coins/,'Betriebsausbau erklärt das 60-Minuten-Beispiel nicht');
assert.doesNotMatch(upgrades,/Keine Sofort-Upgrades/,'Betriebsausbau enthält noch widersprüchlichen Alttext');
assert.match(upgrades,/Vollständige Zeitverkürzung direkt nach Start/,'Betriebsausbau zeigt den Coin-Preis vor dem Start nicht');
assert.match(maintenanceUI,/1 Coin je angefangene 5 Min/,'Wartungsoberfläche erklärt die 5-Minuten-Regel nicht');
assert.match(maintenanceUI,/persistIndustryEquipment/,'Wartungstimer in building_state werden nicht vor sicherer Coin-Verkürzung persistiert');

assert.equal(runTimeValueUtilsTest(),true,'Timerfelder-Regressionsprüfung fehlgeschlagen');
assert.equal(runActiveOperationsOverviewTest(),true,'Vorgangsübersicht erkennt nicht alle Zeitvorgänge');
console.log('✅ ORVUNO 5-MINUTEN-COIN-ZEITREGEL REGRESSIONSTEST ERFOLGREICH');
