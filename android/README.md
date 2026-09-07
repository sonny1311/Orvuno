# ORVUNO Android / Google Play

Feste Daten für die Android-Version:

- App-Name: ORVUNO
- Paketname / Application ID: `de.nadena.orvuno`
- Web-Basis: `https://orvuno-worldproject.vercel.app/`
- Manifest: `https://orvuno-worldproject.vercel.app/manifest.webmanifest`
- Nächstes Update: `1.0.1`
- Nächster Version Code: `2`
- Release-Kanal: Google Play – geschlossener Test
- Wrapper: Trusted Web Activity (TWA) mit Bubblewrap

## Google-Play-Start-URL

Der Google-Play-Wrapper soll die Store-Zuordnung explizit in der Start-URL tragen:

`https://orvuno-worldproject.vercel.app/?source=app&orvuno_app=android&orvuno_store=google`

Damit kann die Web-App den Google-Play-Kontext eindeutig von der normalen Website unterscheiden. Zusätzlich erkennt die App ältere TWA-Builds über Android-Referrer bzw. `source=app` im Standalone-Modus. Ein normaler Browserbesuch bleibt immer Web-Kontext und darf nicht durch einen zuvor gespeicherten Store-Marker umgeschaltet werden.

## Bubblewrap / Google Play Billing

ORVUNO verwendet in der Google-Play-TWA die Digital Goods API und Payment Request API. Der Wrapper muss deshalb Google Play Billing unterstützen. Bei der Bubblewrap-Konfiguration muss Play Billing aktiviert sein (`features.playBilling.enabled=true`).

Initialisierung bzw. Aktualisierung erfolgt mit Bubblewrap gegen das ORVUNO-Manifest. Für den Release mindestens:

- Application name: `ORVUNO`
- Package ID: `de.nadena.orvuno`
- Version name: `1.0.1`
- Version code: `2`
- Host: `orvuno-worldproject.vercel.app`
- Start URL: `/?source=app&orvuno_app=android&orvuno_store=google`
- Play Billing: aktiviert

Die für Google Play bestimmte Datei ist anschließend `app-release-bundle.aab`.

## Zahlungsarchitektur

In der Google-Play-App dürfen Coins und Premium ausschließlich über Google Play Billing gekauft werden. Stripe und PayPal/Braintree werden im Google-App-Kontext nicht geladen.

Erforderliche serverseitige Konfiguration für `world-google-play`:

- `GOOGLE_PLAY_PACKAGE_NAME=de.nadena.orvuno`
- `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` = Service-Account-JSON mit Zugriff auf die Google Play Developer API
- `GOOGLE_PLAY_SKU_MAP_JSON` = JSON-Mapping interner ORVUNO-SKUs auf die tatsächlich in Play Console angelegten Produkt-IDs

Beispielstruktur für das Mapping (nur Struktur, keine erfundenen Play-IDs verwenden):

```json
{
  "coins_100": "PLAY_PRODUCT_ID_HERE",
  "premium_4w": "PLAY_PRODUCT_ID_HERE"
}
```

Ohne gültiges Mapping bleibt der Google-Play-Kaufpfad absichtlich gesperrt. Preise werden in der App aus dem Google-Play-Katalog geladen und nicht aus den Webpreisen als kaufbare Play-Preise übernommen.

Der Backend-Pfad verifiziert jeden `purchaseToken` über die Google Play Developer API, vergibt die Gutschrift idempotent und konsumiert die aktuellen Einmalkauf-Produkte anschließend. Ein Retry darf dadurch keine zweite Gutschrift erzeugen.

## Digital Asset Links

Die TWA-Verifikation erfolgt über:

`https://orvuno-worldproject.vercel.app/.well-known/assetlinks.json`

Der Arbeitsstand erzeugt diese Antwort aus `GOOGLE_PLAY_APP_SIGNING_SHA256`. Es muss der **SHA-256-Fingerprint des App-Signing-Zertifikats aus Google Play Console → App-Integrität** verwendet werden, nicht ein erfundener Wert und nicht versehentlich nur der lokale Upload-Key.

Solange kein syntaktisch gültiger Fingerprint konfiguriert ist, antwortet der Endpoint absichtlich mit HTTP 503 und leerer Liste. So kann kein falscher Digital-Asset-Link als erfolgreich gelten.

## Upload-Key

Für das Update muss derselbe Upload-Key/Keystore verwendet werden wie beim ersten Google-Play-Build. Keystore und Passwörter niemals in GitHub committen.

## Release-Gate

Vor einem Merge/Release müssen mindestens folgende Tests grün sein:

1. Branch-CI inklusive Reparaturtests.
2. Nicht-produktive Supabase-Migration und `world-google-play` auf einer Development-Branch-DB testen.
3. Preview mit gültigem `GOOGLE_PLAY_APP_SIGNING_SHA256` prüfen.
4. Signiertes AAB in den geschlossenen Google-Play-Testtrack laden.
5. TWA ohne Browserleiste verifizieren.
6. Je einen Coin- und Premium-Testkauf durchführen, anschließend App-Neustart/Restore testen.
7. Denselben Kaufbeleg erneut verifizieren und sicherstellen, dass keine Doppelgutschrift entsteht.
8. Normale Webversion weiterhin über den Web-Zahlungsprovider testen.

Keine dieser Konfigurationen darf direkt aus einem Reparaturbranch in Production geschaltet werden.
