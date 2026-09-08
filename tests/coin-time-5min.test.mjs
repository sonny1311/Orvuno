import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runTimeValueUtilsTest} from '../js/core/TimeValueUtils.js';
import {runActiveOperationsOverviewTest} from '../js/core/ActiveOperationsOverview.js';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [operation,migrationBase,migrationPartial,home,transport,construction,policy,ui,upgrades,maintenanceUI,machinePurchase,activeOverviewOverride]=await Promise.all([
 read('js/core/OperationCoinTimeReductionSystem.js'),
 read('database/032_coin_time_reduction_five_minute_rate.sql'),
 read('database/033_partial_coin_time_budget.sql'),
 read('js/core/HomeDeliveryCoinShortcutIntegration.js'),
 read('js/core/TransportCoinTimeReductionSystem.js'),
 read('js/core/ConstructionPremiumCoinSystem.js'),
 read('js/core/ConstructionCoinAccelerationPolicy.js'),
 read('js/core/CoinTimeAccelerationUIIntegration.js'),
 read('js/core/TimedBusinessUpgradeUI.js'),
 read('js/core/MachineMaintenanceUIIntegration.js'),
 read('js/core/MachinePurchaseTabIntegration.js'),
 read('js/core/ActiveOperationsPartialCoinOverride.js')
]);

const coinCost=ms=>ms>0?Math.ceil(ms/300000):0;
const reduceByCoins=(remainingMs,coins)=>Math.min(remainingMs,Math.max(0,Math.floor(coins))*300000);
assert.equal(coinCost(5*60000),1,'5 Minuten müssen 1 Coin kosten');
assert.equal(coinCost(60*60000),12,'60 Minuten müssen 12 Coins kosten');
assert.equal(coinCost(61*60000),13,'61 Minuten müssen 13 Coins kosten');
assert.equal(coinCost(5*60000+1),2,'angefangene zweite 5-Minuten-Einheit muss aufgerundet werden');
assert.equal(reduceByCoins(90*60000,10),50*60000,'10 Coins müssen 50 von 90 Minuten verkürzen');
assert.equal(90*60000-reduceByCoins(90*60000,10),40*60000,'nach 10 Coins müssen von 90 Minuten noch 40 Minuten bleiben');

assert.match(operation,/COIN_TIME_UNIT_MINUTES=5/,'Client kennt die 5-Minuten-Einheit nicht');
assert.match(operation,/Math\.ceil\(value\/COIN_TIME_UNIT_MS\)/,'Client rundet Coin-Kosten nicht je angefangene 5 Minuten');
assert.match(operation,/operationTimeReductionQuoteForCoins/,'Client kann keine frei gewählte Coin-Menge kalkulieren');
assert.match(operation,/coinBudget/,'Client übergibt kein Coin-Budget');
assert.match(operation,/p_max_coins/,'Client übergibt das Coin-Limit nicht an den Server');
assert.match(operation,/shorten_company_timed_action/,'Coin-Abbuchung läuft nicht über den sicheren Server-RPC');
assert.match(operation,/inFlight\.has\(key\)/,'Doppelklick-/Parallel-Schutz fehlt im Client');
assert.match(operation,/sync\.saving=true/,'Autosave wird während der atomaren Serverbuchung nicht blockiert');
assert.doesNotMatch(operation,/company\.coins\s*=\s*n\(company\.coins\)\s*-/,'Generischer Client zieht Coins selbst ab');

assert.match(migrationBase,/ceil\(v_reduction_ms::numeric \/ 300000\)/,'Basismigration verwendet nicht 1 Coin je angefangene 5 Minuten');
assert.match(migrationPartial,/p_max_coins integer DEFAULT NULL/,'Server-RPC besitzt kein optionales Coin-Limit');
assert.match(migrationPartial,/p_max_coins::bigint \* 300000/,'Server begrenzt die Zeit nicht auf 5 Minuten je gewähltem Coin');
assert.match(migrationPartial,/least\(v_requested_ms, p_max_coins::bigint \* 300000\)/,'Server cappt die angeforderte Zeit nicht am Coin-Budget');
assert.match(migrationPartial,/ceil\(v_reduction_ms::numeric \/ 300000\)/,'Server berechnet die tatsächlichen Kosten nicht nach der 5-Minuten-Regel');
assert.match(migrationPartial,/FOR UPDATE/,'Server sperrt Wallet/Betrieb nicht gegen parallele Buchungen');
assert.match(migrationPartial,/SECURITY DEFINER[\s\S]*SET search_path TO ''/,'SECURITY-DEFINER-RPC ist nicht gehärtet');
assert.match(migrationPartial,/REVOKE ALL ON FUNCTION public\.shorten_company_timed_action\(bigint,text,text,integer,integer\) FROM PUBLIC/,'Neue RPC-Signatur ist für PUBLIC nicht gesperrt');
for(const kind of ['production','delivery','construction','land','warehouse_expansion','machine_upgrade','business_upgrade','equipment','maintenance','crew_arrival'])assert.match(migrationPartial,new RegExp(`WHEN '${kind}'`),`Serverpfad fehlt für ${kind}`);
assert.match(migrationPartial,/constructionSite[^\n]*deliveries/,'Baumaterial-Lieferungen fehlen im Serverpfad');
assert.match(migrationPartial,/maintenanceJob/,'Maschinenwartung fehlt im Serverpfad');
assert.match(migrationPartial,/crewBookings/,'Bautrupp-Anfahrt fehlt im Serverpfad');

assert.match(home,/ActiveOperationsPartialCoinOverride/,'Startbootstrap lädt die Teilverkürzung im aktiven Vorgangsüberblick nicht');
assert.match(home,/homeCoinBudgetInput/,'Startseite besitzt kein Eingabefeld für die Coin-Menge');
assert.match(home,/operationTimeReductionQuoteForCoins/,'Startseite kalkuliert Teilverkürzungen nicht');
assert.match(home,/coinBudget:selected/,'Startseite sendet die gewählte Coin-Menge nicht an den sicheren Serverpfad');
assert.match(home,/50 von 90 Minuten/,'Startseiten-Testfall 10 Coins für 50 von 90 Minuten fehlt');
assert.doesNotMatch(home,/reduceTransportTimeWithCoins/,'Startseite verwendet noch die alte lokale Transportabbuchung');

assert.match(ui,/Coin-Anzahl frei wählbar/,'Spieloberflächen erklären die freie Coin-Auswahl nicht');
assert.match(ui,/orvunoCoinBudgetInput/,'Zentrales Eingabefeld für die Coin-Menge fehlt');
assert.match(ui,/operationTimeReductionQuoteForCoins/,'Zentrale UI kalkuliert Teilverkürzungen nicht');
assert.match(ui,/coinBudget:selected/,'Zentrale UI sendet die gewählte Coin-Menge nicht serverautoritativ');
assert.match(ui,/60 Min\. = 12 Coins/,'Spieloberflächen erklären das 60-Minuten-Beispiel nicht');
assert.match(ui,/annotateQuotedDeliveryTimes/,'Lieferzeit wird vor dem Kauf nicht in Coins ausgewiesen');
assert.match(ui,/Teilverkürzung frei wählbar/,'Liefer- oder Produktionshinweise erklären Teilverkürzungen nicht');
assert.match(ui,/attachPlannedProductionPrice/,'Produktionsdauer wird vor dem Start nicht in Coins ausgewiesen');
assert.match(ui,/Maschinenmontage|Montage|equipment/,'Maschinenzeiten werden nicht integriert');
assert.match(ui,/maintenance/,'Wartungszeiten werden nicht integriert');
assert.match(ui,/crew_arrival/,'Bautrupp-Anfahrt wird nicht integriert');
assert.match(ui,/construction_material_order/,'Baumaterial-Lieferzeit wird nicht integriert');
assert.match(ui,/business_upgrade/,'Betriebsausbau wird nicht integriert');

assert.match(activeOverviewOverride,/activeOverviewCoinBudget/,'Betrieb-im-Überblick besitzt kein Eingabefeld für Coins');
assert.match(activeOverviewOverride,/operationTimeReductionQuoteForCoins/,'Betrieb-im-Überblick kalkuliert Teilverkürzungen nicht');
assert.match(activeOverviewOverride,/coinBudget:selected/,'Betrieb-im-Überblick sendet die Coin-Menge nicht serverautoritativ');
assert.match(activeOverviewOverride,/removeLegacyControl/,'Alte Stunden-Auswahl wird im Betrieb-im-Überblick nicht entfernt');
assert.match(activeOverviewOverride,/Ganz fertig/,'Betrieb-im-Überblick zeigt die vollständigen Coin-Kosten nicht zusätzlich an');
assert.doesNotMatch(activeOverviewOverride,/createElement\('select'\)/,'Neue Betrieb-im-Überblick-Steuerung verwendet noch eine Stunden-Auswahl');

assert.match(transport,/transportTimeReductionQuoteForCoins/,'Transportquote unterstützt keine freie Coin-Menge');
assert.match(transport,/coinBudget/,'Transporthelfer reicht kein Coin-Budget weiter');
assert.match(transport,/reduceOperationTimeWithCoins/,'Transportverkürzung läuft nicht über den sicheren Serverpfad');
assert.doesNotMatch(transport,/company\.coins\s*=.*-/,'Transport-Client zieht Coins noch selbst ab');
assert.match(construction,/orvunoConstructionCoinBudget/,'Bau-/Ausbaudialog besitzt kein Coin-Eingabefeld');
assert.match(construction,/operationTimeReductionQuoteForCoins/,'Bau-/Ausbaudialog kann Teilverkürzungen nicht kalkulieren');
assert.match(construction,/coinBudget:selected/,'Bau-/Ausbaudialog übergibt das gewählte Coin-Budget nicht serverautoritativ');
assert.match(policy,/minutesPerCoin:5/,'Montage-/Baupolicy ist nicht auf 5 Minuten gestellt');
assert.match(policy,/coinsPerHour:12/,'60 Minuten werden in der Policy nicht als 12 Coins abgebildet');
assert.doesNotMatch(policy,/minimumRealTimeRatio:0\.25/,'Alte 25-Prozent-Zwangswartezeit ist noch aktiv');

assert.match(upgrades,/1 Coin je angefangene 5 Minuten/,'Betriebsausbau erklärt die 5-Minuten-Regel nicht');
assert.match(upgrades,/60 Minuten kosten 12 Coins/,'Betriebsausbau erklärt das 60-Minuten-Beispiel nicht');
assert.doesNotMatch(upgrades,/Keine Sofort-Upgrades/,'Betriebsausbau enthält noch widersprüchlichen Alttext');
assert.match(maintenanceUI,/1 Coin je angefangene 5 Min/,'Wartungsoberfläche erklärt die 5-Minuten-Regel nicht');
assert.match(maintenanceUI,/persistIndustryEquipment/,'Wartungstimer in building_state werden nicht vor sicherer Coin-Verkürzung persistiert');
assert.match(machinePurchase,/Du wählst selbst die Coin-Anzahl/,'Maschinenkauf erklärt die freie Coin-Auswahl nicht');
assert.match(machinePurchase,/60 Minuten = 12 Coins/,'Maschinenkauf erklärt das 60-Minuten-Beispiel nicht');
assert.match(machinePurchase,/Teilverkürzung frei wählbar/,'Maschinenbereich erklärt Teilverkürzungen nicht');
assert.doesNotMatch(machinePurchase,/reduceOperationTimeWithCoins/,'Maschinenbereich besitzt noch einen eigenen statt des zentralen Coin-Buttons');
assert.doesNotMatch(machinePurchase,/max\. 50 Coins|letzten 25 %|mindestens 25 %/,'Maschinenbereich enthält noch die alte Coin- oder Zwangswarte-Regel');
assert.doesNotMatch(machinePurchase,/accelerateIndustryEquipmentInstallation/,'Maschinen-UI verwendet noch die alte clientseitige Beschleunigung');

assert.equal(runTimeValueUtilsTest(),true,'Timerfelder-Regressionsprüfung fehlgeschlagen');
assert.equal(runActiveOperationsOverviewTest(),true,'Vorgangsübersicht erkennt nicht alle Zeitvorgänge');
console.log('✅ ORVUNO PARTIELLE 5-MINUTEN-COIN-ZEITREGEL REGRESSIONSTEST ERFOLGREICH');
