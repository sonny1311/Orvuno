import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const help=await read('js/core/ContextualHelpAndTutorialIntegration.js');
const index=await read('index.html');
const gameId=await read('js/core/GameIdAccess.js');
const gate=await read('js/core/GameAccessGate.js');
const appShell=await read('css/app-shell.css');
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
assert.match(help,/maybeAutoOpenTutorial/,'Tutorial-Automatik fehlt als kompatibler Mechanismus');
assert.match(help,/safeGet\(key\)==='1'/,'Tutorial wird nicht gegen Wiederholungs-Autostart geschützt');
assert.match(help,/data-orvuno-profile-tutorial/,'Profil-Wiedereinstieg für Tutorial fehlt');
assert.match(help,/orvuno-help-trigger/,'Kontext-Fragezeichen fehlen');
assert.match(help,/orvuno-context-help-fab/,'Globale Hilfe für Spielflächen fehlt');
assert.match(help,/window\.orvunoHelp=/,'Öffentliche Hilfe-API fehlt');
assert.match(help,/popstate/,'Zurück-Tasten-/History-Behandlung für Hilfe fehlt');
assert.match(help,/max-height:min\(850px,92dvh\)/,'Mobile scrollbare Hilfe fehlt');
assert.match(help,/orvuno-auth-game-context/,'Kontext im Zugangsbereich fehlt');
assert.match(gate,/markTutorialVoluntary\(user\)/,'Freiwilliger Tutorial-Modus fehlt im Spielzugang');
assert.match(gate,/orvuno\.tutorial\.v1\.seen\.\$\{id\}/,'Freiwilliger Tutorial-Modus setzt keinen benutzerspezifischen Marker');
assert.match(appShell,/\.orvuno-tutorial-overlay \.orvuno-help-card/,'Tutorial besitzt keinen mobilen Scroll-Fix');
assert.match(appShell,/\.orvuno-tutorial-overlay \.orvuno-tutorial-actions/,'Tutorial-Aktionen bleiben mobil nicht erreichbar');

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
assert.doesNotMatch(index,/pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle/,'AdSense-Auto-Ads dürfen nicht direkt auf dem verpflichtenden Zugangsscreen geladen werden');
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

assert.match(gameId,/normalizePlayerName/,'Benutzername wird im Spielzugang nicht normalisiert');
assert.match(gameId,/USERNAME_MIN=3/,'Benutzername hat keine Mindestlänge');
assert.match(gameId,/USERNAME_MAX=24/,'Benutzername hat keine Höchstlänge');
assert.match(gameId,/privacyBox\.required=true/,'Datenschutz-Kenntnisnahme ist nicht verpflichtend');
assert.match(gameId,/privacyBox\.dataset\.orvunoPrivacyConsentBox='1'/,'Datenschutz-Checkbox ist nicht eindeutig markiert');
assert.match(gameId,/privacyLink\.dataset\.orvunoPrivacyLink='1'/,'Datenschutzerklärung ist im Einstieg nicht eindeutig verlinkt');
assert.match(gameId,/frame\.src='\/datenschutz\.html'/,'Datenschutzerklärung ist nicht direkt im Einstieg lesbar');
assert.match(gameId,/privacyAccepted:privacyBox\.checked/,'Spielstart übergibt die Datenschutz-Kenntnisnahme nicht');
assert.match(gameId,/Bitte bestätige zuerst die Datenschutzerklärung/,'Spielstart kann Datenschutzpflicht nicht verständlich ablehnen');
assert.match(gameId,/Spiel starten/,'Direkter Spielstart fehlt');
assert.doesNotMatch(gameId,/Spiel-ID laden|ORV-XXXXX-XXXXX-XXXXX-XXXXX|oder vorhandenen Spielstand laden/,'Spiel-ID-Wiederherstellung ist im Einstieg noch sichtbar');
assert.match(gate,/openPlayerAccess\(\)/,'Access-Gate öffnet nicht den direkten Spielerzugang');
assert.match(gate,/resumeLocalPlayer\(\)/,'Unsichtbarer Alt-Spielstand-Fallback fehlt');
assert.doesNotMatch(gate,/ensureForCurrentPlayer\(\)/,'Neue Spieler bekommen weiterhin automatisch eine Wiederherstellungskennung');
assert.doesNotMatch(gate,/AccountAuthDialog|renderRecovery|recoveryPending/,'Aktiver Spielzugang hängt noch am alten Registrierungs-/Recovery-Dialog');

assert.match(privacy,/<title>Datenschutzerklärung – ORVUNO<\/title>/,'Öffentliche Datenschutzerklärung fehlt oder ist falsch benannt');
assert.match(privacy,/Benutzername und lokale Spielsitzung/,'Datenschutzerklärung beschreibt den aktuellen Zugang nicht');
assert.match(privacy,/kein sichtbarer Wiederherstellungscode/,'Datenschutzerklärung behauptet weiterhin einen sichtbaren Wiederherstellungscode');
assert.match(privacy,/technische Wiederherstellungskennungen/,'Datenschutzerklärung verschweigt vorhandene Altkennungen');
assert.match(privacy,/Hosting und Datenbank/,'Datenschutzerklärung beschreibt technische Dienstleister nicht');
assert.match(privacy,/Amazon Appstore/,'Datenschutzerklärung beschreibt Amazon-Zahlungen nicht');
assert.match(privacy,/href="\/konto-loeschen\.html"/,'Datenschutzerklärung verweist nicht auf die Kontolöschung');
assert.match(deletion,/<title>ORVUNO-Konto löschen<\/title>/,'Öffentliche Kontolöschseite fehlt');
assert.match(deletion,/Löschung per E-Mail beantragen/,'Kontolöschseite bietet keinen sichtbaren Antragsweg');

assert.match(footer,/guide:'\/spielanleitung\.html'/,'In-App-Footer verlinkt die Spielanleitung nicht');
assert.match(footer,/faq:'\/faq\.html'/,'In-App-Footer verlinkt die FAQ nicht');
assert.match(footer,/updates:'\/aktuelles\.html'/,'In-App-Footer verlinkt Aktuelles nicht');
assert.match(footer,/privacy:'\/datenschutz\.html'/,'In-App-Footer verweist nicht direkt auf die Datenschutzerklärung');
assert.match(footer,/accountDeletion:'\/konto-loeschen\.html'/,'In-App-Footer verweist nicht auf die Kontolöschung');
assert.match(footer,/mountAuthPublicLinks/,'Öffentliche Inhalte sind auf dem Zugangsscreen nicht verlinkt');

assert.equal(ads.trim(),'google.com, pub-5715415363963326, DIRECT, f08c47fec0942fa0','ads.txt enthält nicht die erwartete AdSense-Publisher-ID');
assert.match(robots,/Sitemap: https:\/\/www\.orvuno\.de\/sitemap\.xml/,'robots.txt verweist nicht auf die Sitemap');
for(const path of ['spielanleitung.html','faq.html','aktuelles.html','datenschutz.html','impressum.html','konto-loeschen.html'])assert.match(sitemap,new RegExp(path.replace('.','\\.')),`Sitemap enthält ${path} nicht`);

assert.match(play,/autoRestoreGooglePlayPurchases/,'Automatische Play-Wiederherstellung fehlt');
assert.match(play,/world:user-login/,'Play-Restore reagiert nicht auf Login');
assert.match(play,/world:access-granted/,'Play-Restore reagiert nicht auf Session-Wiederherstellung');
assert.match(play,/restoreGooglePlayPurchases\(\)/,'Play-Restore verwendet nicht den verifizierten Restore-Pfad');
assert.match(play,/edge\('verify_purchase'/,'Play-Käufe werden nicht serverseitig verifiziert');
assert.doesNotMatch(play,/coin_wallet|balance\s*\+=|premiumUntil\s*=/i,'Play-Client enthält verdächtige clientseitige Entitlement-Gutschrift');

console.log('✅ PRE-RELEASE QA CONTENT/ACCESS/PRIVACY/HELP/ADSENSE/PUBLIC-PAGES TESTS ERFOLGREICH');