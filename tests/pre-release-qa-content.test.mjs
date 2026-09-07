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
const guide=await read('spielanleitung.html');
const faq=await read('faq.html');
const updates=await read('aktuelles.html');
const publicCss=await read('css/public-content.css');
const ads=await read('ads.txt');
const robots=await read('robots.txt');
const sitemap=await read('sitemap.xml');

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
assert.match(index,/href="\/spielanleitung\.html"/,'Startseite verlinkt die Spielanleitung nicht statisch');
assert.match(index,/href="\/faq\.html"/,'Startseite verlinkt die FAQ nicht statisch');
assert.match(index,/href="\/aktuelles\.html"/,'Startseite verlinkt Aktuelles nicht statisch');
assert.match(index,/google-adsense-account/,'AdSense-Kontoverknüpfung fehlt auf der Startseite');
assert.doesNotMatch(index,/pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle/,'AdSense-Auto-Ads dürfen nicht direkt auf dem verpflichtenden Login-Screen geladen werden');
assert.match(index,/ContextualHelpAndTutorialIntegration\.js/,'Hilfe-/Tutorial-Modul wird nicht geladen');
assert.ok(index.length>13000,'Öffentliche Startseite ist für die geforderte Spielbeschreibung unerwartet dünn');

assert.ok(guide.length>9000,'Spielanleitung ist unerwartet kurz');
for(const heading of ['Einkauf und Lieferanten','Lager und Kapazität','Personal richtig einsetzen','Maschinen, Wartung und Durchsatz','Produktion planen und starten','Abfüllung und verkaufsfähige Ware','Kundenaufträge auswählen','Auslieferung und Logistik','Markt, Preise und Deckungsbeitrag','Finanzen, Liquidität und Kredite','Mehrere Betriebe und Betriebswechsel','Coins, Premium und Firmengeld'])assert.match(guide,new RegExp(heading),`Spielanleitung fehlt: ${heading}`);
assert.match(guide,/google-adsense-account/,'Spielanleitung ist nicht mit dem AdSense-Konto verknüpft');
assert.match(guide,/adsbygoogle\.js\?client=ca-pub-5715415363963326/,'Spielanleitung lädt den AdSense-Code nicht');

const faqQuestions=(faq.match(/<summary>/g)||[]).length;
assert.ok(faqQuestions>=30,`FAQ ist nicht ausführlich genug: ${faqQuestions} Fragen`);
assert.ok(faq.length>11000,'FAQ ist unerwartet kurz');
for(const topic of ['Was ist ORVUNO überhaupt?','Warum ist gekaufte Ware nicht sofort im Lager?','Was ist der Unterschied zwischen „Einplanen“ und „Starten“?','Wie erkenne ich einen guten Kundenauftrag?','Wann ist ein Kredit sinnvoll?','Wie kann ich mein Konto und meine Daten löschen lassen?','Wie werden Käufe in der Google-Play-App verarbeitet?'])assert.match(faq,new RegExp(topic.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')),`FAQ-Thema fehlt: ${topic}`);
assert.match(faq,/google-adsense-account/,'FAQ ist nicht mit dem AdSense-Konto verknüpft');

assert.ok(updates.length>4500,'Aktuelles-Seite ist zu dünn');
assert.match(updates,/Diese Seite wird nur mit tatsächlichen Änderungen gefüllt/,'Aktuelles trennt echte Änderungen nicht von Planung');
assert.match(updates,/Google-Play-Billing vorbereitet/,'Google-Play-Releasehinweis fehlt');
assert.match(updates,/Ausführliche Spielhilfe und Tutorial/,'Hilfe-/Tutorial-Update fehlt');
assert.match(updates,/Öffentliche Spielanleitung und FAQ/,'Öffentliche Content-Erweiterung fehlt');
assert.match(publicCss,/@media\(max-width:760px\)/,'Öffentliche Inhaltsseiten besitzen kein Mobile-Layout');

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

assert.match(footer,/guide:'\/spielanleitung\.html'/,'In-App-Footer verlinkt die Spielanleitung nicht');
assert.match(footer,/faq:'\/faq\.html'/,'In-App-Footer verlinkt die FAQ nicht');
assert.match(footer,/updates:'\/aktuelles\.html'/,'In-App-Footer verlinkt Aktuelles nicht');
assert.match(footer,/privacy:'\/datenschutz\.html'/,'In-App-Footer verweist nicht direkt auf die Datenschutzerklärung');
assert.match(footer,/accountDeletion:'\/konto-loeschen\.html'/,'In-App-Footer verweist nicht auf die Kontolöschung');
assert.match(footer,/mountAuthPublicLinks/,'Öffentliche Inhalte sind auf der Login-/Registrierungsansicht nicht verlinkt');
assert.match(footer,/Noch unsicher\? Spielanleitung und FAQ/,'Loginseite erklärt die öffentlichen Hilfsangebote nicht');

assert.equal(ads.trim(),'google.com, pub-5715415363963326, DIRECT, f08c47fec0942fa0','ads.txt enthält nicht die erwartete AdSense-Publisher-ID');
assert.match(robots,/Sitemap: https:\/\/www\.orvuno\.de\/sitemap\.xml/,'robots.txt verweist nicht auf die Sitemap');
for(const path of ['spielanleitung.html','faq.html','aktuelles.html','datenschutz.html','impressum.html','konto-loeschen.html'])assert.match(sitemap,new RegExp(path.replace('.','\\.')),`Sitemap enthält ${path} nicht`);

assert.match(gate,/recoveryPending\(\)/,'Access-Gate erkennt Recovery-Session nicht');
assert.match(gate,/if\(this\.recoveryPending\(\)\) return false/,'Recovery-Session kann weiterhin Spielzugang erhalten');
assert.match(gate,/this\.openRequiredLogin\(this\.recoveryPending\(\)\?"recovery":"login"\)/,'Recovery-Session öffnet nicht den Passwortdialog');

assert.match(play,/autoRestoreGooglePlayPurchases/,'Automatische Play-Wiederherstellung fehlt');
assert.match(play,/world:user-login/,'Play-Restore reagiert nicht auf Login');
assert.match(play,/world:access-granted/,'Play-Restore reagiert nicht auf Session-Wiederherstellung');
assert.match(play,/restoreGooglePlayPurchases\(\)/,'Play-Restore verwendet nicht den verifizierten Restore-Pfad');
assert.match(play,/edge\('verify_purchase'/,'Play-Käufe werden nicht serverseitig verifiziert');
assert.doesNotMatch(play,/coin_wallet|balance\s*\+=|premiumUntil\s*=/i,'Play-Client enthält verdächtige clientseitige Entitlement-Gutschrift');

console.log('✅ PRE-RELEASE QA CONTENT/AUTH/HELP/ADSENSE/PUBLIC-PAGES TESTS ERFOLGREICH');
