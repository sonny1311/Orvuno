import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const help=await read('js/core/ContextualHelpAndTutorialIntegration.js');
const index=await read('index.html');
const auth=await read('js/core/AccountAuthDialog.js');
const gate=await read('js/core/GameAccessGate.js');
const play=await read('js/core/GooglePlayBillingIntegration.js');
const privacy=await read('datenschutz.html');
const deletion=await read('konto-loeschen.html');
const footer=await read('js/core/FooterInformationLinksIntegration.js');

const requiredTopics=[
  'overview','procurement','inbound','warehouse','staff','machines','production','bottling',
  'customerOrders','delivery','market','finance','expansion','businessSwitch','coinsToMoney','coins','premium','profile'
];
for(const topic of requiredTopics){
  assert.match(help,new RegExp(`\\b${topic}:\\{`),`Kontexthilfe fehlt für ${topic}`);
}

assert.match(help,/TUTORIAL_STEPS=Object\.freeze\(\[/,'Tutorial-Schritte fehlen');
const tutorialStepCount=(help.match(/\{topic:'[^']+',title:'\d+ ·/g)||[]).length;
assert.ok(tutorialStepCount>=13,`Tutorial ist zu kurz: ${tutorialStepCount} Schritte`);
assert.match(help,/orvuno\.tutorial\.\$\{TUTORIAL_VERSION\}\.seen\.\$\{id\}/,'Tutorial-Status ist nicht benutzerspezifisch');
assert.match(help,/maybeAutoOpenTutorial/,'Erststart-Automatik fehlt');
assert.match(help,/safeGet\(key\)==='1'/,'Tutorial wird nicht gegen Wiederholungs-Autostart geschützt');
assert.match(help,/data-orvuno-profile-tutorial/,'Profil-Wiedereinstieg für Tutorial fehlt');
assert.match(help,/orvuno-help-trigger/,'Kontext-Fragezeichen fehlen');
assert.match(help,/orvuno-context-help-fab/,'Globale Hilfe für Spielflächen fehlt');
assert.match(help,/window\.orvunoHelp=/,'Öffentliche Hilfe-API fehlt');
assert.match(help,/popstate/,'Zurück-Tasten-/History-Behandlung für Hilfe fehlt');
assert.match(help,/max-height:min\(850px,92dvh\)/,'Mobile scrollbare Hilfe fehlt');
assert.match(help,/orvuno-auth-game-context/,'Kontext im Anmeldebereich fehlt');

assert.match(index,/id="orvuno-public-context"/,'Öffentliche Spielbeschreibung fehlt');
assert.match(index,/So funktioniert der Wirtschaftskreislauf/,'Wirtschaftskreislauf wird öffentlich nicht erklärt');
assert.match(index,/Einkauf & Lager/,'Einkauf/Lager fehlt im öffentlichen Inhalt');
assert.match(index,/Personal & Maschinen/,'Personal/Maschinen fehlt im öffentlichen Inhalt');
assert.match(index,/Produktion & Abfüllung/,'Produktion/Abfüllung fehlt im öffentlichen Inhalt');
assert.match(index,/Kundenaufträge & Lieferung/,'Kundenaufträge/Lieferung fehlt im öffentlichen Inhalt');
assert.match(index,/Markt & Finanzen/,'Markt/Finanzen fehlt im öffentlichen Inhalt');
assert.match(index,/Ausbau & mehrere Betriebe/,'Ausbau/Betriebe fehlt im öffentlichen Inhalt');
assert.match(index,/Coins, Premium und fairer Spielstand/,'Coins/Premium-Kontext fehlt im öffentlichen Inhalt');
assert.match(index,/ContextualHelpAndTutorialIntegration\.js/,'Hilfe-/Tutorial-Modul wird nicht geladen');
assert.ok(index.length>12000,'Öffentliche Startseite ist für die geforderte Spielbeschreibung unerwartet dünn');

assert.match(auth,/recoveryMode\(\)/,'Recovery-Modus im Auth-Dialog fehlt');
assert.match(auth,/renderRecovery\(panel\)/,'Neues-Passwort-Dialog fehlt');
assert.match(auth,/resetPassword\(null,password\.value\)/,'Passwort wird nach Recovery nicht gesetzt');
assert.match(auth,/withBusy\(button,task\)/,'Zentraler Double-Submit-Schutz im Auth-Dialog fehlt');
assert.match(auth,/this\.render\(shell,"login"\)/,'Registrierung rendert nach Bestätigung nicht in den vollständigen Auth-Shell zurück');
assert.doesNotMatch(auth,/this\.render\(panel,"login"\)/,'Alter fehlerhafter Register→Login-Renderpfad ist noch vorhanden');
assert.match(auth,/privacyBox\.required=true/,'Datenschutz-Checkbox ist nicht verpflichtend');
assert.match(auth,/privacyBox\.dataset\.orvunoPrivacyConsent="1"/,'Datenschutz-Checkbox ist nicht eindeutig markiert');
assert.match(auth,/privacyLink\.href="\/datenschutz\.html"/,'Datenschutzerklärung ist in der Registrierung nicht verlinkt');
assert.match(auth,/if\(!termsBox\.checked\|\|!privacyBox\.checked\)/,'Registrierung kann ohne Datenschutz-Zustimmung fortfahren');
assert.match(privacy,/<title>Datenschutzerklärung – ORVUNO<\/title>/,'Öffentliche Datenschutzerklärung fehlt oder ist falsch benannt');
assert.match(privacy,/Spielerkonto und Anmeldung/,'Datenschutzerklärung beschreibt Kontodaten nicht');
assert.match(privacy,/Hosting und Datenbank/,'Datenschutzerklärung beschreibt technische Dienstleister nicht');
assert.match(privacy,/href="\/konto-loeschen\.html"/,'Datenschutzerklärung verweist nicht auf die Kontolöschung');
assert.match(deletion,/<title>ORVUNO-Konto löschen<\/title>/,'Öffentliche Kontolöschseite fehlt');
assert.match(deletion,/Löschung per E-Mail beantragen/,'Kontolöschseite bietet keinen sichtbaren Antragsweg');
assert.match(footer,/PRIVACY_URL='\/datenschutz\.html'/,'Footer verweist nicht direkt auf die Datenschutzerklärung');
assert.match(footer,/ACCOUNT_DELETION_URL='\/konto-loeschen\.html'/,'In-App-Footer verweist nicht auf die Kontolöschung');
assert.match(footer,/\['Konto löschen','accountDeletion'\]/,'Kontolöschung ist im App-Footer nicht sichtbar');

assert.match(gate,/recoveryPending\(\)/,'Access-Gate erkennt Recovery-Session nicht');
assert.match(gate,/if\(this\.recoveryPending\(\)\) return false/,'Recovery-Session kann weiterhin Spielzugang erhalten');
assert.match(gate,/this\.openRequiredLogin\(this\.recoveryPending\(\)\?"recovery":"login"\)/,'Recovery-Session öffnet nicht den Passwortdialog');

assert.match(play,/autoRestoreGooglePlayPurchases/,'Automatische Play-Wiederherstellung fehlt');
assert.match(play,/world:user-login/,'Play-Restore reagiert nicht auf Login');
assert.match(play,/world:access-granted/,'Play-Restore reagiert nicht auf Session-Wiederherstellung');
assert.match(play,/restoreGooglePlayPurchases\(\)/,'Play-Restore verwendet nicht den verifizierten Restore-Pfad');
assert.match(play,/edge\('verify_purchase'/,'Play-Käufe werden nicht serverseitig verifiziert');
assert.doesNotMatch(play,/coin_wallet|balance\s*\+=|premiumUntil\s*=/i,'Play-Client enthält verdächtige clientseitige Entitlement-Gutschrift');

console.log('✅ PRE-RELEASE QA CONTENT/AUTH/HELP/PRIVACY/DELETION TESTS ERFOLGREICH');
