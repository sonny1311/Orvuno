# ORVUNO – Amazon Appstore wrapper

This wrapper mirrors the working Hofhain Amazon architecture: native Android WebView + Amazon Appstore SDK 3.0.9 + JavaScript bridge + server-side RVS verification.

- Application ID: `de.nadena.orvuno`
- Start URL: `https://orvuno-worldproject.vercel.app/?source=app&orvuno_app=android&orvuno_store=amazon`
- Amazon SDK: `com.amazon.device:amazon-appstore-sdk:3.0.9`
- Amazon purchases only; web payment providers remain excluded by the web app's Amazon store bootstrap.
- Receipts are passed to the existing `world-amazon-iap` Supabase function and are fulfilled only after server verification.

## Required Amazon authentication key

Download the **ORVUNO** `AppstoreAuthenticationKey.pem` from the Amazon Developer Console and place it at:

`app/src/main/assets/AppstoreAuthenticationKey.pem`

Do **not** copy Hofhain's key. Amazon binds this file to the Amazon app.

## Product IDs

`orvuno_coins_100`, `orvuno_coins_550`, `orvuno_coins_1200`, `orvuno_coins_2600`, `orvuno_coins_6000`, `orvuno_coins_13000`, `orvuno_coins_26000`, `orvuno_coins_50000`, `orvuno_premium_4w`, `orvuno_premium_3m`, `orvuno_premium_6m`, `orvuno_premium_12m`.

The four-week product is deliberately `orvuno_premium_4w`; there is no Amazon `orvuno_premium_1m` request.

## Build

Use JDK 17+ and Android SDK 35.

Debug / Amazon App Tester:

`gradle assembleDebug`

Release:

`gradle assembleRelease`

Optional release signing variables:

- `ORVUNO_AMAZON_KEYSTORE`
- `ORVUNO_AMAZON_STORE_PASSWORD`
- `ORVUNO_AMAZON_KEY_ALIAS`
- `ORVUNO_AMAZON_KEY_PASSWORD`

Before uploading to Amazon, set `versionCode` / `versionName` to the next accepted Amazon version and build with the same signing identity as the existing ORVUNO Amazon listing.
