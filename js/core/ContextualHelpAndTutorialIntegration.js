// ORVUNO - kontextbezogene Spielhilfe und Erststart-Tutorial.
// Diese Integration erweitert bestehende Spielflaechen, ohne deren Buchungslogik zu veraendern.

const HELP_TOPICS=Object.freeze({
  overview:{
    title:'ORVUNO im Überblick',
    purpose:'ORVUNO ist eine fortlaufende Wirtschaftssimulation. Du führst einen oder mehrere Betriebe und steuerst die komplette Kette vom Einkauf bis zur Auslieferung.',
    steps:[
      'Plane zuerst Liquidität und Kapazitäten. Geld, Lagerplatz, Personal und Maschinen begrenzen, was dein Betrieb gleichzeitig leisten kann.',
      'Kaufe passende Rohstoffe und Verpackungen ein. Eine Bestellung ist noch kein Lagerbestand: Sie muss ankommen und anschließend eingelagert werden.',
      'Plane Produktion und Abfüllung anhand des tatsächlichen Bedarfs. Das Spiel zeigt benötigte Materialien, Maschinen, Dauer und Kosten vor dem Start.',
      'Erfülle Kundenaufträge mit verkaufsfähiger Fertigware und liefere nur die Menge aus, die du wirklich versenden willst.',
      'Behalte Markt, laufende Kosten, Kredite und Ausbau im Blick und investiere Gewinne gezielt in den nächsten Engpass.'
    ],
    note:'Die wichtigste Grundregel: Erst prüfen, dann bestätigen. Angezeigte Kosten, Mengen, Fristen und Kapazitäten beziehen sich immer auf den aktuellen Betriebszustand.'
  },
  procurement:{
    title:'Einkauf & Lieferanten',
    purpose:'Im Einkauf beschaffst du Rohstoffe und Verpackungen, die dein Betrieb für Produktion und Abfüllung benötigt.',
    steps:[
      'Wähle Material und Bestellmenge. Vergleiche Lieferanten nach Stückpreis, Qualität, Entfernung, Lieferzeit und Gesamtkosten.',
      'Beim Kauf wird der aktuell berechnete Gesamtpreis geprüft und genau für diese Bestellung vom Betriebsgeld abgezogen.',
      'Die Ware landet nicht sofort im Lager. Zuerst entsteht eine laufende Lieferung mit eigener Ankunftszeit.',
      'Erst nach der Ankunft kannst du den Wareneingang ausführen. Dafür muss im passenden Lagerbereich genügend freie Kapazität vorhanden sein.'
    ],
    note:'Große Bestellungen können günstiger sein, binden aber Liquidität und Lagerplatz. Plane den Einkauf nach dem Produktionsbedarf statt nur nach dem günstigsten Einzelpreis.'
  },
  inbound:{
    title:'Laufende Lieferungen & Wareneingang',
    purpose:'Hier verfolgst du bereits bestellte Ware vom Lieferanten bis in dein Lager.',
    steps:[
      'Bestellte Lieferungen wechseln über unterwegs bzw. verspätet zu angekommen.',
      'Wareneingang ist erst möglich, wenn die Lieferung wirklich angekommen ist.',
      'Beim Einlagern prüft ORVUNO den richtigen Lagerbereich und dessen freie Kapazität.',
      'Nach erfolgreichem Einlagern ist die Lieferung abgeschlossen und kann nicht ein zweites Mal als derselbe Wareneingang verbucht werden.'
    ],
    note:'Wenn Einlagern nicht möglich ist, zuerst Lagerplatz schaffen oder die Kapazität erhöhen. Eine angekommene Lieferung bleibt bis dahin offen.'
  },
  warehouse:{
    title:'Lager',
    purpose:'Das Lager zeigt, welche Rohstoffe, Verpackungen und Fertigwaren tatsächlich verfügbar sind und wie viel Kapazität jeder Bereich noch hat.',
    steps:[
      'Achte auf „belegt / Kapazität“ in jedem Lagerbereich.',
      'Rohstoffe und Verpackungen werden für Produktionsaufträge benötigt; Fertigware wird für Kundenaufträge und Auslieferungen benötigt.',
      'Geplante Produktion reserviert nicht automatisch Material. Beim tatsächlichen Start wird erneut geprüft und dann der benötigte Bestand entnommen.',
      'Kann fertige Produktion wegen fehlendem Lagerplatz nicht eingelagert werden, bleibt der Vorgang blockiert, bis wieder Platz vorhanden ist.'
    ],
    note:'Ein volles Lager kann Einkauf, Produktion und Lieferung gleichzeitig bremsen. Kapazität ist daher ein eigener Produktionsfaktor.'
  },
  staff:{
    title:'Personal',
    purpose:'Personal stellt Arbeitsleistung und Qualifikation bereit und verursacht laufende Kosten.',
    steps:[
      'Prüfe, welche Stellen dein aktueller Betrieb für seine Abläufe benötigt.',
      'Aktive Beschäftigte verursachen laufende Personalkosten; zu viel Personal belastet die Liquidität.',
      'Einige Produktionsarten benötigen eine konkrete Qualifikation. Beim Brauprozess muss zum Beispiel ein aktiver Braumeister verfügbar sein.',
      'Stelle Personal passend zum geplanten Durchsatz ein und prüfe nach Ausbau oder Maschinenkauf erneut den Personalbedarf.'
    ],
    note:'Mehr Personal hilft nur, wenn gleichzeitig Material, Maschinen und Nachfrage vorhanden sind. Suche immer den tatsächlichen Engpass.'
  },
  machines:{
    title:'Maschinen & Kapazität',
    purpose:'Maschinen bestimmen, welche Produktionsschritte möglich sind und wie viel Durchsatz dein Betrieb erreichen kann.',
    steps:[
      'Jedes Rezept benötigt einen passenden Maschinentyp.',
      'Eine Maschine muss verfügbar sein; defekte, verkaufte, in Wartung befindliche oder bereits belegte Maschinen können einen Auftrag nicht starten.',
      'Die Maschinenkapazität kann die Produktionsdauer beeinflussen. Größere Mengen belegen die Anlage entsprechend länger.',
      'Während eines laufenden Auftrags bleibt die zugewiesene Maschine belegt.'
    ],
    note:'Kaufe oder erweitere Maschinen erst dann, wenn sie wirklich der Engpass sind. Ungenutzte Kapazität bindet Kapital.'
  },
  production:{
    title:'Produktion',
    purpose:'Die Produktion verwandelt Rohstoffe mit Personal- und Maschinenkapazität in Zwischen- oder Fertigprodukte.',
    steps:[
      'Gib die gewünschte Ausgabemenge ein. ORVUNO berechnet daraus den exakten Materialbedarf, die voraussichtliche Dauer und die variablen Produktionskosten.',
      '„Einplanen“ legt einen Auftrag in die Warteschlange, verbraucht aber noch keine Rohstoffe.',
      'Beim Start wird der Auftrag erneut gegen aktuellen Lagerbestand und Maschinenverfügbarkeit geprüft. Erst dann werden die benötigten Materialien entnommen und die Maschine belegt.',
      'Nach Ablauf der Produktionszeit wird das Ergebnis eingelagert. Fehlt Platz, wartet der Vorgang auf freie Lagerkapazität.'
    ],
    note:'Plane nicht mehr, als du lagern und später verkaufen kannst. Material, Maschine, Personal, Zeit und Lagerplatz müssen als Kette zusammenpassen.'
  },
  bottling:{
    title:'Abfüllung',
    purpose:'Die Abfüllung macht aus einem geeigneten Zwischenprodukt verkaufsfähige abgefüllte Ware.',
    steps:[
      'Gib die gewünschte Abfüllmenge ein. Bei flüssigen Produkten rechnet ORVUNO die Liter in die erforderliche Anzahl Flaschen um.',
      'Vor dem Start werden Zwischenprodukt, Flaschen, Verschlüsse, Etiketten und die passende Abfüllanlage geprüft, soweit das Rezept sie verlangt.',
      'Einplanen reserviert noch nichts. Erst „Jetzt abfüllen“ startet den Auftrag und verbraucht die aktuell erforderlichen Materialien.',
      'Die fertige Ware muss anschließend in das Fertigwarenlager passen, bevor sie für Kundenaufträge verfügbar ist.'
    ],
    note:'Abfüllung ist ein eigener Produktionsschritt. Genug Getränk allein reicht nicht, wenn Verpackungsmaterial oder Abfüllkapazität fehlen.'
  },
  customerOrders:{
    title:'Kundenaufträge',
    purpose:'Kundenaufträge verbinden Nachfrage mit deiner Fertigware und geben Menge, Erlös und gegebenenfalls eine Lieferfrist vor.',
    steps:[
      'Prüfe Produkt, Gesamtmenge, noch offene Menge, Preis und Lieferfrist, bevor du dich auf einen Auftrag konzentrierst.',
      'Produziere bzw. fülle die passende Fertigware in ausreichender Menge ab.',
      'Eine Teillieferung ist möglich, wenn weniger Ware verfügbar ist als der gesamte Restauftrag verlangt.',
      'Bei Fristen können verspätete Restmengen wirtschaftliche Nachteile verursachen; plane Produktion und Logistik deshalb rückwärts von der Lieferfrist.'
    ],
    note:'Ein hoher Auftragswert ist nur dann attraktiv, wenn du Material-, Produktions-, Lager- und Lieferkosten sowie die Frist beherrschst.'
  },
  delivery:{
    title:'Auslieferung & Logistik',
    purpose:'Mit der Auslieferung wird Fertigware aus dem Lager tatsächlich an den Kunden übergeben und der entsprechende Auftrag abgerechnet.',
    steps:[
      'ORVUNO zeigt offene Auftragsmenge, verfügbaren Fertigwarenbestand und die aktuell maximal lieferbare Menge.',
      'Du gibst die Liefermenge bewusst selbst an. Das Spiel verwendet niemals automatisch deinen gesamten Lagerbestand.',
      'Beim Start der Lieferung wird der Vorgang gesperrt, damit ein Doppelklick dieselbe Aktion nicht parallel mehrfach auslöst.',
      'Nach erfolgreicher Lieferung werden Auftrag und Bestände aktualisiert; eine Teilmenge lässt den Restauftrag offen.'
    ],
    note:'Prüfe vor dem Versand, ob die Ware für andere dringende Aufträge benötigt wird und ob Fristen eine andere Reihenfolge sinnvoll machen.'
  },
  market:{
    title:'Markt & Preise',
    purpose:'Der Markt bildet Angebot, Nachfrage und Preisbewegungen ab und hilft dir zu entscheiden, was du einkaufst, produzierst oder verkaufst.',
    steps:[
      'Vergleiche Marktpreis und deine eigenen Vollkosten, nicht nur den möglichen Verkaufspreis.',
      'Preisbewegungen können sich mit Nachfrage und Verfügbarkeit verändern. Eine heute gute Marge muss nicht dauerhaft gelten.',
      'Käufe und Verkäufe werden gegen aktuellen Bestand bzw. verfügbare Mittel geprüft.',
      'Nutze Marktinformationen zusammen mit Kundenaufträgen und deiner freien Kapazität.'
    ],
    note:'Wachstum ohne Marge verschlechtert die Liquidität. Entscheidend ist der Deckungsbeitrag nach Einkauf, Produktion, Personal, Logistik und Finanzierung.'
  },
  finance:{
    title:'Finanzen & Kredite',
    purpose:'Die Finanzansicht zeigt, ob dein Betrieb seine laufenden Verpflichtungen tragen und neue Investitionen finanzieren kann.',
    steps:[
      'Behalte verfügbares Betriebsgeld und wiederkehrende Kosten im Blick.',
      'Einkauf, Produktion, Personal, Maschinen, Logistik und Ausbau wirken zu unterschiedlichen Zeitpunkten auf deine Liquidität.',
      'Kredite schaffen kurzfristig Spielraum, erzeugen aber Rückzahlungs- und Zinsbelastung.',
      'Finanziere Ausbau so, dass nach der Investition noch genug Reserve für mindestens den nächsten operativen Zyklus bleibt.'
    ],
    note:'Umsatz ist nicht dasselbe wie freie Liquidität. Plane Zahlungen zeitlich, nicht nur als Gesamtsumme.'
  },
  expansion:{
    title:'Ausbau & neue Kapazität',
    purpose:'Ausbau erhöht die Möglichkeiten deines Betriebs, kostet aber Kapital und kann weitere laufende Kosten auslösen.',
    steps:[
      'Identifiziere zuerst den Engpass: Lager, Maschine, Personal, Fläche oder Finanzierung.',
      'Prüfe alle angezeigten einmaligen und laufenden Kosten vor der Bestätigung.',
      'Nach einem Ausbau muss die restliche Lieferkette mitwachsen. Eine größere Maschine ohne Rohstoff- oder Lagerkapazität bringt wenig.',
      'Plane eine Liquiditätsreserve für die Anlaufphase ein.'
    ],
    note:'Ausbau ist dann wirtschaftlich, wenn die zusätzliche Kapazität tatsächlich ausgelastet und profitabel genutzt werden kann.'
  },
  businessSwitch:{
    title:'Betriebswechsel & Betriebsportfolio',
    purpose:'Im Betriebsportfolio wechselst du zwischen bereits vorhandenen Betrieben oder verwaltest Erweiterungen deines Unternehmens.',
    steps:[
      'Ein Wechsel aktiviert nur einen bereits vorhandenen Betrieb und dessen eigenen Spielzustand.',
      'Betriebsgeld, Lager, Aufträge und operative Zustände gehören zum jeweils ausgewählten Betrieb.',
      'Der reine Wechsel zu einem bestehenden Betrieb ist kein Echtgeldkauf und darf keinen Zahlungsdialog öffnen.',
      'Bei kostenpflichtiger Expansion werden die Kosten separat und ausdrücklich ausgewiesen, bevor ein neuer Betrieb entsteht.'
    ],
    note:'Kontrolliere nach jedem Wechsel den aktiven Betriebsnamen, bevor du Einkauf, Produktion oder Finanzierung ausführst.'
  },
  coinsToMoney:{
    title:'Coins → Firmengeld',
    purpose:'Hier tauschst du einen ausdrücklich gewählten Coin-Betrag über die vorgesehene serverseitige Funktion in Firmengeld um.',
    steps:[
      'Prüfe Coin-Betrag, angezeigten Umrechnungseffekt und den Zielbetrieb vor der Bestätigung.',
      'Die Umwandlung wird serverseitig mit einer eindeutigen Anfragekennung verarbeitet, damit dieselbe Anfrage nicht doppelt gutgeschrieben werden soll.',
      'Nach Erfolg werden Coin-Wallet und Betriebsgeld neu geladen.',
      'Wiederhole die Aktion nicht nur deshalb, weil die Anzeige langsam aktualisiert wird; warte auf die eindeutige Erfolgs- oder Fehlermeldung.'
    ],
    note:'Coins und Firmengeld sind getrennte Konten. Eine Umwandlung ist eine bewusste Spielaktion und kein normaler Betriebswechsel.'
  },
  coins:{
    title:'Coins',
    purpose:'Coins sind ein kontobezogenes Guthaben für dafür vorgesehene ORVUNO-Funktionen und werden getrennt vom Geld eines einzelnen Betriebs geführt.',
    steps:[
      'Coin-Pakete werden nur über den für die jeweilige Plattform vorgesehenen Zahlungsanbieter gekauft.',
      'In der Google-Play-App läuft der Kauf ausschließlich über Google Play Billing.',
      'Eine Gutschrift erfolgt erst nach serverseitiger Prüfung des Kaufbelegs; der Browser schreibt sich keine Coins selbst gut.',
      'Nach erfolgreicher Prüfung wird der sichtbare Kontostand vom Server neu geladen.'
    ],
    note:'Bei einem abgebrochenen oder noch nicht bestätigten Kauf nicht mehrfach hintereinander klicken. Der serverseitig bestätigte Status ist maßgeblich.'
  },
  premium:{
    title:'Premium',
    purpose:'Premium ist ein zeitlich begrenzter kontobezogener Vorteil. Die konkrete Laufzeit und die angezeigten Vorteile gelten nur für das ausgewählte Angebot.',
    steps:[
      'Wähle die gewünschte Laufzeit und prüfe den im Store angezeigten Preis.',
      'In der Google-Play-App wird ausschließlich Google Play Billing verwendet; Stripe oder Braintree werden dort nicht gestartet.',
      'Premium wird erst nach serverseitiger Kaufprüfung aktiviert bzw. verlängert.',
      'Nach Ablauf gelten wieder die normalen Spielgrenzen. Bei dadurch überbelegtem Lager musst du Bestand abbauen oder die Kapazität wieder erhöhen.'
    ],
    note:'Maßgeblich sind die im jeweiligen Store angezeigte Laufzeit, der Preis und der serverseitig gespeicherte Premium-Zeitraum.'
  },
  profile:{
    title:'Profil & Konto',
    purpose:'Im Profil verwaltest du deine Kontodaten, siehst Coins und Betriebe und kannst dieses Tutorial jederzeit erneut öffnen.',
    steps:[
      'Profilangaben gehören zu deinem ORVUNO-Konto und sind nicht das Betriebsgeld oder der Lagerzustand eines einzelnen Betriebs.',
      'Unter Coin-Wallet siehst du dein kontobezogenes Coin-Guthaben.',
      'Über „Betriebe verwalten“ gelangst du zu deinen vorhandenen Unternehmen.',
      'Mit „Tutorial öffnen“ kannst du die komplette Spieleinführung jederzeit wiederholen.'
    ],
    note:'Beim Abmelden bleibt der serverseitig gespeicherte Spielstand erhalten. Melde dich später wieder mit demselben Konto an.'
  }
});

const TUTORIAL_STEPS=Object.freeze([
  {topic:'overview',title:'1 · Dein Unternehmen und der Wirtschaftskreislauf',text:'Du startest mit einem Betrieb und entwickelst daraus Schritt für Schritt eine belastbare Lieferkette. Der Kernablauf lautet: einkaufen → Lieferung abwarten → einlagern → produzieren → gegebenenfalls abfüllen → Kundenauftrag erfüllen → ausliefern → Erlös reinvestieren. Nicht die größte Produktion gewinnt, sondern der Betrieb, der Liquidität, Kapazität und Nachfrage im Gleichgewicht hält.'},
  {topic:'procurement',title:'2 · Rohstoffe und Verpackung beschaffen',text:'Beginne jede Produktionsplanung mit dem Materialbedarf. Im Einkauf vergleichst du Lieferanten nach Preis, Qualität, Entfernung und Lieferzeit. Beim Kauf wird die Bestellung bezahlt, aber die Ware ist noch unterwegs. Plane deshalb nicht mit Material, das noch nicht im Lager angekommen ist.'},
  {topic:'inbound',title:'3 · Lieferungen annehmen',text:'Unter laufenden Lieferungen siehst du, wann bestellte Ware ankommt. Erst nach der Ankunft wird „Wareneingang / Einlagern“ möglich. Beim Einlagern prüft ORVUNO den passenden Lagerbereich und freien Platz. Derselbe Wareneingang kann nach erfolgreicher Einlagerung nicht einfach ein zweites Mal verbucht werden.'},
  {topic:'warehouse',title:'4 · Lager als Engpass verstehen',text:'Rohstoffe, Verpackungen und Fertigwaren liegen in getrennten Bereichen. Produktion kann nur Material verwenden, das tatsächlich vorhanden ist. Gleichzeitig braucht das Ergebnis später Platz im Fertigwarenlager. Ein voller Lagerbereich kann deshalb einen ansonsten fertigen Prozess stoppen.'},
  {topic:'staff',title:'5 · Personal passend zur Produktion einsetzen',text:'Beschäftigte ermöglichen Abläufe, verursachen aber laufende Kosten. Bestimmte Prozesse benötigen eine Qualifikation; beim Brauen ist beispielsweise ein aktiver Braumeister erforderlich. Stelle nicht einfach möglichst viele Leute ein, sondern so viele, wie dein geplanter Durchsatz wirtschaftlich rechtfertigt.'},
  {topic:'machines',title:'6 · Maschinen und Kapazität planen',text:'Rezepte benötigen bestimmte Maschinentypen. Eine Maschine kann nur eingesetzt werden, wenn sie verfügbar ist und nicht bereits produziert, defekt ist oder gewartet wird. Ihre Kapazität beeinflusst, wie schnell du Mengen verarbeiten kannst. Investiere dort, wo wirklich ein Engpass besteht.'},
  {topic:'production',title:'7 · Produktion richtig starten',text:'Gib die gewünschte Menge ein und lies zuerst Bedarf, Lagerbestand, Dauer und Kosten. „Einplanen“ setzt den Auftrag nur in die Warteschlange; Rohstoffe bleiben zunächst im Lager. Erst beim tatsächlichen Start prüft ORVUNO Material und Maschine erneut und verbraucht dann die erforderlichen Bestände.'},
  {topic:'bottling',title:'8 · Abfüllung zur verkaufsfähigen Ware',text:'Bei Produkten mit separater Abfüllung folgt nach der Herstellung noch ein eigener Schritt. ORVUNO rechnet die gewünschte Menge in Flaschen und Verpackungsmaterial um. Erst nach erfolgreicher Abfüllung und Einlagerung steht die passende Fertigware für Kundenaufträge bereit.'},
  {topic:'customerOrders',title:'9 · Kundenaufträge wirtschaftlich bedienen',text:'Prüfe bei jedem Auftrag Produkt, Menge, offenen Rest, Preis und Lieferfrist. Produziere nicht blind für Umsatz: Material-, Personal-, Maschinen-, Lager- und Lieferkosten müssen zur Marge passen. Bei knapper Ware kannst du Teilmengen liefern und den Restauftrag später abschließen.'},
  {topic:'delivery',title:'10 · Ausliefern und abrechnen',text:'Die Auslieferung zeigt dir, was der Kunde noch braucht und wie viel passende Fertigware aktuell vorhanden ist. Du wählst die zu liefernde Menge bewusst selbst. Nach erfolgreicher Auslieferung werden Bestand und Auftrag aktualisiert. Ein laufender Klick wird gesperrt, damit dieselbe Aktion nicht parallel mehrfach ausgelöst wird.'},
  {topic:'finance',title:'11 · Liquidität, Markt und Kredite',text:'Beobachte nicht nur Umsatz, sondern den Zeitpunkt von Ein- und Auszahlungen. Einkauf wird vor dem späteren Verkauf bezahlt; Personal, Maschinen und Finanzierung können laufende Kosten erzeugen. Marktpreise und Nachfrage ändern die Attraktivität einzelner Produkte. Kredite helfen nur, wenn die zusätzliche Kapazität ihre Zins- und Rückzahlungsbelastung tragen kann.'},
  {topic:'expansion',title:'12 · Ausbau und mehrere Betriebe',text:'Erweitere erst den tatsächlichen Engpass. Nach einem Ausbau müssen Lager, Personal, Maschinen, Rohstoffversorgung und Absatz weiterhin zusammenpassen. Beim Wechsel zwischen vorhandenen Betrieben wechselst du nur den aktiven Spielzustand; ein normaler Betriebswechsel ist kein Echtgeldkauf.'},
  {topic:'coins',title:'13 · Coins, Premium und dein Profil',text:'Coins und Premium sind kontobezogene Systeme und vom normalen Betriebsgeld getrennt. In der Google-Play-App werden Käufe ausschließlich über Google Play Billing verarbeitet und erst nach serverseitiger Prüfung gutgeschrieben. Das Tutorial startet automatisch nur beim ersten Mal für dein Konto. Danach findest du im Spielerprofil dauerhaft „Tutorial öffnen“.'}
]);

const TOPIC_RULES=[
  ['coinsToMoney',/(coin|coins|münz|muen).{0,30}(firmengeld|betriebs?geld|geld)|(firmengeld|betriebs?geld).{0,30}(coin|coins|münz|muen)/i],
  ['bottling',/abfüll|abfuell|flaschen|filling/i],
  ['customerOrders',/kundenauftrag|kundenaufträge|kundenauftraege|customer order|auftragserfüll|auftragserfuell/i],
  ['delivery',/ausliefer|liefermenge|lieferung starten|logistik|fracht|versand|delivery/i],
  ['inbound',/laufende liefer|wareneingang|einlagern|ankunft|inbound/i],
  ['procurement',/einkauf|einkaufen|lieferant|bestell|rohstoffe.*verpack|procurement|supplier/i],
  ['warehouse',/lager|bestand|storage|warehouse/i],
  ['staff',/personal|mitarbeiter|beschäft|beschaeft|braumeister|workforce|staff|employee/i],
  ['machines',/maschine|anlage|maschinenkapaz|machine|equipment/i],
  ['production',/produktion|produktions|brauen|rezept|herstell|production|brewing/i],
  ['market',/markt|handel|marktpreis|market|trade/i],
  ['finance',/finanz|kredit|darlehen|liquid|buchhaltung|zins|finance|loan/i],
  ['expansion',/ausbau|erweiter|grundstück|grundstueck|gebäude|gebaeude|expansion/i],
  ['businessSwitch',/betriebswechsel|betrieb wechseln|betriebe verwalten|betriebsportfolio|unternehmen wechseln|portfolio/i],
  ['premium',/premium/i],
  ['coins',/coin|coins|münz|muen/i],
  ['profile',/spielerprofil|profil|konto|account/i]
];

const STYLE_ID='orvuno-context-help-style';
const TUTORIAL_VERSION='v1';
let activeOverlay=null;
let activeHistoryToken=null;
let autoOpenedForKey='';
let scanQueued=false;

function locale(){return window.orvunoI18n?.getLocale?.()||document.documentElement.lang||'de';}
function isGerman(){return String(locale()).toLowerCase().startsWith('de');}
function normalized(value=''){return String(value).replace(/\s+/g,' ').trim();}
function isAuthenticated(){return document.documentElement.classList.contains('orvuno-authenticated')||!!window.worldCurrentUser;}
function userIdentity(){const u=window.worldCurrentUser||window.worldAccount||{};return String(u.id||u.authId||u.auth_user_id||u.public_id||'').trim();}
function tutorialKey(){const id=userIdentity();return id?`orvuno.tutorial.${TUTORIAL_VERSION}.seen.${id}`:'';}
function safeGet(key){try{return localStorage.getItem(key);}catch{return null;}}
function safeSet(key,value){try{localStorage.setItem(key,value);}catch{}}

function ensureStyle(){
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement('style');style.id=STYLE_ID;style.textContent=`
    .orvuno-help-trigger{display:inline-flex;align-items:center;justify-content:center;width:25px;height:25px;margin-left:8px;padding:0;border:1px solid #d3a52b;border-radius:50%;background:#172235;color:#ffd66b;font:900 15px/1 Arial,sans-serif;cursor:pointer;vertical-align:middle;box-shadow:0 2px 8px rgba(0,0,0,.2)}
    .orvuno-help-trigger:hover,.orvuno-help-trigger:focus-visible{background:#273a58;outline:2px solid #ffd66b;outline-offset:2px}
    #orvuno-context-help-fab{position:fixed;right:max(14px,env(safe-area-inset-right));bottom:max(76px,calc(env(safe-area-inset-bottom) + 76px));z-index:18000;width:46px;height:46px;border:1px solid #d3a52b;border-radius:50%;background:#172235;color:#ffd66b;font:900 24px/1 Arial,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.35);cursor:pointer}
    #orvuno-context-help-fab:focus-visible{outline:3px solid #ffd66b;outline-offset:2px}
    .orvuno-help-overlay{position:fixed;inset:0;z-index:50000;display:flex;align-items:center;justify-content:center;padding:max(14px,env(safe-area-inset-top)) max(14px,env(safe-area-inset-right)) max(14px,env(safe-area-inset-bottom)) max(14px,env(safe-area-inset-left));box-sizing:border-box;background:rgba(2,7,15,.82);font-family:Arial,sans-serif;color:#f8fafc}
    .orvuno-help-card{width:min(720px,96vw);max-height:min(850px,92dvh);overflow:auto;box-sizing:border-box;padding:22px;border:1px solid #41516a;border-radius:16px;background:#101a2b;box-shadow:0 24px 80px rgba(0,0,0,.58)}
    .orvuno-help-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;position:sticky;top:-22px;margin:-22px -22px 16px;padding:20px 22px 12px;background:#101a2b;border-bottom:1px solid #2e3d54;z-index:2}
    .orvuno-help-head h2{margin:0;font-size:clamp(22px,5vw,30px);line-height:1.15}.orvuno-help-close{flex:0 0 auto;width:40px;height:40px;border:1px solid #53627a;border-radius:9px;background:#172235;color:#fff;font-size:20px;cursor:pointer}
    .orvuno-help-purpose{font-size:16px;line-height:1.58;color:#e3e8ef}.orvuno-help-list{padding-left:22px;line-height:1.55}.orvuno-help-list li{margin:9px 0}.orvuno-help-note{margin-top:16px;padding:12px 14px;border-left:4px solid #d3a52b;border-radius:8px;background:rgba(211,165,43,.10);line-height:1.5}
    .orvuno-tutorial-progress{font-size:13px;color:#9fb0c8;font-weight:700;margin-bottom:8px}.orvuno-tutorial-text{font-size:17px;line-height:1.62;color:#eef2f7}.orvuno-tutorial-topic{margin-top:16px;padding:13px;border-radius:9px;background:#0b1320;border:1px solid #2b3a50;line-height:1.5;color:#d7dfeb}
    .orvuno-tutorial-actions{display:flex;gap:10px;justify-content:space-between;flex-wrap:wrap;margin-top:20px}.orvuno-tutorial-actions button,.orvuno-profile-tutorial{padding:11px 15px;border:1px solid #4a5d79;border-radius:9px;background:#18253a;color:#fff;font-weight:800;cursor:pointer}.orvuno-tutorial-actions .primary,.orvuno-profile-tutorial{background:#315fd7;border-color:#5f83ed}
    .orvuno-auth-game-context{margin:0 0 22px;padding:14px 16px;border:1px solid #33445d;border-radius:11px;background:#0d1727;color:#dce3ed;font:14px/1.55 Arial,sans-serif}.orvuno-auth-game-context strong{display:block;margin-bottom:6px;color:#f4bd43;font-size:15px}.orvuno-auth-game-context ul{margin:8px 0 0;padding-left:20px}.orvuno-auth-game-context li{margin:3px 0}
    @media(max-width:700px){#orvuno-context-help-fab{width:42px;height:42px;font-size:22px;bottom:max(70px,calc(env(safe-area-inset-bottom) + 70px))}.orvuno-help-card{width:100%;max-height:94dvh;padding:18px}.orvuno-help-head{top:-18px;margin:-18px -18px 14px;padding:17px 18px 11px}.orvuno-tutorial-actions button{flex:1 1 120px;min-height:44px}}
  `;document.head.append(style);
}

function topicFromText(text=''){
  const value=normalized(text);
  for(const [topic,pattern] of TOPIC_RULES)if(pattern.test(value))return topic;
  return 'overview';
}

function topicForHeading(heading){
  const own=normalized(heading?.textContent||'');
  const ownTopic=topicFromText(own);if(ownTopic!=='overview')return ownTopic;
  const container=heading?.closest?.('section,[role="dialog"],.panel,.card,.modal,div')||heading?.parentElement;
  return topicFromText(normalized(container?.textContent||'').slice(0,1100));
}

function visible(el){if(!el?.isConnected)return false;const style=getComputedStyle(el);if(style.display==='none'||style.visibility==='hidden')return false;const r=el.getBoundingClientRect();return r.width>0&&r.height>0;}

function currentContextTopic(){
  if(!isAuthenticated())return 'overview';
  const candidates=[...document.querySelectorAll('#worldApp h1,#worldApp h2,#worldApp h3,body>div h1,body>div h2,body>div h3')].filter(h=>visible(h)&&!h.closest('.orvuno-help-overlay,#orvuno-public-context'));
  const centered=candidates.sort((a,b)=>Math.abs(a.getBoundingClientRect().top-100)-Math.abs(b.getBoundingClientRect().top-100))[0];
  return centered?topicForHeading(centered):'overview';
}

function removeActiveOverlay(){activeOverlay?.remove();activeOverlay=null;activeHistoryToken=null;}
function requestOverlayClose(){
  if(!activeOverlay)return;
  const token=activeHistoryToken;
  if(token&&history.state?.orvunoHelpToken===token){history.back();setTimeout(()=>{if(activeOverlay&&activeHistoryToken===token)removeActiveOverlay();},250);return;}
  removeActiveOverlay();
}
function mountOverlay(overlay){
  if(activeOverlay)removeActiveOverlay();
  activeOverlay=overlay;document.body.append(overlay);
  const token=`help-${Date.now()}-${Math.random().toString(36).slice(2)}`;activeHistoryToken=token;
  try{history.pushState({...history.state,orvunoHelpToken:token},'',location.href);}catch{activeHistoryToken=null;}
}

function helpOverlay(topic='overview'){
  const item=HELP_TOPICS[topic]||HELP_TOPICS.overview;
  const overlay=document.createElement('div');overlay.className='orvuno-help-overlay';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');
  const card=document.createElement('article');card.className='orvuno-help-card';
  const head=document.createElement('div');head.className='orvuno-help-head';const title=document.createElement('h2');title.textContent=`? ${item.title}`;const close=document.createElement('button');close.className='orvuno-help-close';close.type='button';close.textContent='✕';close.setAttribute('aria-label',isGerman()?'Hilfe schließen':'Close help');close.onclick=requestOverlayClose;head.append(title,close);
  const purpose=document.createElement('p');purpose.className='orvuno-help-purpose';purpose.textContent=item.purpose;
  const list=document.createElement('ol');list.className='orvuno-help-list';for(const step of item.steps){const li=document.createElement('li');li.textContent=step;list.append(li);}
  const note=document.createElement('div');note.className='orvuno-help-note';const label=document.createElement('strong');label.textContent=isGerman()?'Wichtig: ':'Important: ';note.append(label,document.createTextNode(item.note));
  card.append(head,purpose,list,note);overlay.append(card);overlay.addEventListener('mousedown',e=>{if(e.target===overlay)requestOverlayClose();});return overlay;
}

function openHelp(topic='overview'){ensureStyle();mountOverlay(helpOverlay(HELP_TOPICS[topic]?topic:'overview'));}

function tutorialOverlay(index=0){
  const safeIndex=Math.max(0,Math.min(TUTORIAL_STEPS.length-1,Number(index)||0));const step=TUTORIAL_STEPS[safeIndex],topic=HELP_TOPICS[step.topic]||HELP_TOPICS.overview;
  const overlay=document.createElement('div');overlay.className='orvuno-help-overlay orvuno-tutorial-overlay';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');
  const card=document.createElement('article');card.className='orvuno-help-card';
  const head=document.createElement('div');head.className='orvuno-help-head';const group=document.createElement('div');const progress=document.createElement('div');progress.className='orvuno-tutorial-progress';progress.textContent=`Tutorial · ${safeIndex+1} / ${TUTORIAL_STEPS.length}`;const title=document.createElement('h2');title.textContent=step.title;group.append(progress,title);const close=document.createElement('button');close.className='orvuno-help-close';close.type='button';close.textContent='✕';close.setAttribute('aria-label','Tutorial schließen');close.onclick=requestOverlayClose;head.append(group,close);
  const text=document.createElement('p');text.className='orvuno-tutorial-text';text.textContent=step.text;
  const detail=document.createElement('div');detail.className='orvuno-tutorial-topic';detail.innerHTML=`<strong>${topic.title}</strong><br>${topic.note}`;
  const actions=document.createElement('div');actions.className='orvuno-tutorial-actions';
  const previous=document.createElement('button');previous.type='button';previous.textContent='← Zurück';previous.disabled=safeIndex===0;previous.style.opacity=previous.disabled?'.45':'1';previous.onclick=()=>openTutorial(safeIndex-1);
  const help=document.createElement('button');help.type='button';help.textContent='? Details';help.onclick=()=>openHelp(step.topic);
  const next=document.createElement('button');next.type='button';next.className='primary';next.textContent=safeIndex===TUTORIAL_STEPS.length-1?'Tutorial abschließen':'Weiter →';next.onclick=()=>{if(safeIndex===TUTORIAL_STEPS.length-1){requestOverlayClose();return;}openTutorial(safeIndex+1);};
  actions.append(previous,help,next);card.append(head,text,detail,actions);overlay.append(card);overlay.addEventListener('mousedown',e=>{if(e.target===overlay)requestOverlayClose();});return overlay;
}

function openTutorial(index=0){ensureStyle();const key=tutorialKey();if(key)safeSet(key,'1');mountOverlay(tutorialOverlay(index));}

function decorateHeading(heading){
  if(!heading||heading.dataset.orvunoHelpAttached==='1'||heading.closest('.orvuno-help-overlay,#orvuno-public-context,.orvuno-auth-game-context'))return;
  if(!isAuthenticated())return;
  const topic=topicForHeading(heading);const button=document.createElement('button');button.type='button';button.className='orvuno-help-trigger';button.textContent='?';button.title=`Hilfe: ${(HELP_TOPICS[topic]||HELP_TOPICS.overview).title}`;button.setAttribute('aria-label',button.title);button.dataset.orvunoHelpTopic=topic;button.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();openHelp(topicForHeading(heading));});heading.append(button);heading.dataset.orvunoHelpAttached='1';
}

function ensureFloatingHelp(){
  if(!isAuthenticated()){document.getElementById('orvuno-context-help-fab')?.remove();return;}
  if(document.getElementById('orvuno-context-help-fab'))return;
  const button=document.createElement('button');button.id='orvuno-context-help-fab';button.type='button';button.textContent='?';button.title='Hilfe zu dieser Spielfläche';button.setAttribute('aria-label',button.title);button.onclick=()=>openHelp(currentContextTopic());document.body.append(button);
}

function ensureProfileTutorial(){
  if(!isAuthenticated())return;
  const headings=[...document.querySelectorAll('h1,h2,h3')].filter(h=>/spielerprofil|profil|account/i.test(normalized(h.textContent||''))&&!h.closest('.orvuno-help-overlay,#orvuno-public-context'));
  for(const heading of headings){
    const panel=heading.closest('section,[role="dialog"],div');if(!panel||panel.querySelector('[data-orvuno-profile-tutorial="1"]'))continue;
    const text=normalized(panel.textContent||'');if(!/(benutzername|e-mail|coin-wallet|betriebe|account)/i.test(text))continue;
    const button=document.createElement('button');button.type='button';button.className='orvuno-profile-tutorial';button.dataset.orvunoProfileTutorial='1';button.textContent='🎓 Tutorial öffnen';button.onclick=()=>openTutorial(0);
    const header=heading.parentElement;if(header&&/flex/i.test(getComputedStyle(header).display)){header.insertAdjacentElement('afterend',button);}else heading.insertAdjacentElement('afterend',button);
  }
}

function ensureAuthContext(){
  if(isAuthenticated())return;
  const heading=[...document.querySelectorAll('h1')].find(h=>/anmelden|registrieren|sign in|register/i.test(normalized(h.textContent||'')));
  if(!heading)return;const panel=heading.closest('section')||heading.parentElement;if(!panel||panel.querySelector('[data-orvuno-auth-context="1"]'))return;
  const box=document.createElement('div');box.className='orvuno-auth-game-context';box.dataset.orvunoAuthContext='1';
  if(isGerman())box.innerHTML='<strong>Was ist ORVUNO?</strong>ORVUNO ist eine fortlaufende Wirtschaftssimulation. Du baust Betriebe auf und steuerst die komplette Lieferkette.<ul><li>Rohstoffe einkaufen, Lieferungen annehmen und Lager verwalten</li><li>Personal und Maschinen planen, produzieren und Ware abfüllen</li><li>Kundenaufträge erfüllen, ausliefern und auf Marktpreise reagieren</li><li>Finanzen, Kredite, Ausbau und mehrere Betriebe wirtschaftlich steuern</li></ul>Dein Spielstand ist deinem Konto zugeordnet und wird nach der Anmeldung wiederhergestellt.';
  else box.innerHTML='<strong>What is ORVUNO?</strong>ORVUNO is a persistent business simulation in which you build companies and manage the full supply chain.<ul><li>Buy materials, receive deliveries and manage storage</li><li>Plan staff and machines, produce and bottle goods</li><li>Fulfil customer orders, deliver products and react to markets</li><li>Manage finance, loans, expansion and multiple businesses</li></ul>Your saved game is linked to your account and restored after sign-in.';
  const sub=heading.nextElementSibling;const anchor=sub?.nextElementSibling||sub;if(anchor)panel.insertBefore(box,anchor);else heading.insertAdjacentElement('afterend',box);
}

function maybeAutoOpenTutorial(){
  if(!isAuthenticated()||activeOverlay)return;const key=tutorialKey();if(!key||autoOpenedForKey===key)return;autoOpenedForKey=key;if(safeGet(key)==='1')return;safeSet(key,'1');setTimeout(()=>{if(isAuthenticated()&&!activeOverlay)openTutorial(0);},650);
}

function scan(){
  scanQueued=false;ensureStyle();ensureAuthContext();ensureFloatingHelp();
  if(isAuthenticated()){
    const headings=document.querySelectorAll('#worldApp h1,#worldApp h2,#worldApp h3,body>div h1,body>div h2,body>div h3');
    for(const heading of headings)decorateHeading(heading);
    ensureProfileTutorial();maybeAutoOpenTutorial();
  }
}
function queueScan(){if(scanQueued)return;scanQueued=true;requestAnimationFrame(scan);}

ensureStyle();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',scan,{once:true});else scan();
const observer=new MutationObserver(queueScan);observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
window.addEventListener('world:user-login',queueScan);window.addEventListener('world:profile-updated',queueScan);window.addEventListener('world:business-switched',queueScan);
window.addEventListener('popstate',()=>{if(activeOverlay)removeActiveOverlay();});
window.addEventListener('keydown',event=>{if(event.key==='Escape'&&activeOverlay){event.preventDefault();requestOverlayClose();}});
window.addEventListener('beforeunload',()=>observer.disconnect(),{once:true});

window.orvunoHelp={
  topics:HELP_TOPICS,
  tutorial:TUTORIAL_STEPS,
  open:openHelp,
  openTutorial,
  currentTopic:currentContextTopic,
  rescan:queueScan
};
