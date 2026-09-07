#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-android-build/orvuno-1.0.3}"
rm -rf "$ROOT"
mkdir -p "$ROOT"

mkdir -p "$ROOT/app"
cat > "$ROOT/app/build.gradle" <<'__ORVUNO_FILE_0__'
plugins {
    id 'com.android.application'
}

android {
    namespace 'de.nadena.orvuno'
    compileSdk 36

    defaultConfig {
        applicationId 'de.nadena.orvuno'
        minSdk 23
        targetSdk 36
        versionCode 6
        versionName '1.0.3'
    }

    buildTypes {
        release {
            minifyEnabled false
            shrinkResources false
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }

    compileOptions {
        sourceCompatibility JavaVersion.VERSION_1_8
        targetCompatibility JavaVersion.VERSION_1_8
    }
}

dependencies {
    implementation 'com.google.androidbrowserhelper:androidbrowserhelper:2.7.2'
    implementation 'com.google.androidbrowserhelper:billing:1.2.0'
}
__ORVUNO_FILE_0__

mkdir -p "$ROOT/app"
cat > "$ROOT/app/proguard-rules.pro" <<'__ORVUNO_FILE_1__'
# Release minification is disabled deliberately for this wrapper build.
__ORVUNO_FILE_1__

mkdir -p "$ROOT/app/src/main"
cat > "$ROOT/app/src/main/AndroidManifest.xml" <<'__ORVUNO_FILE_2__'
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
    <uses-permission android:name="com.android.vending.BILLING" />

    <application
        android:name=".Application"
        android:allowBackup="true"
        android:icon="@drawable/ic_launcher"
        android:label="@string/appName"
        android:supportsRtl="true"
        android:theme="@android:style/Theme.Translucent.NoTitleBar">

        <meta-data android:name="asset_statements" android:resource="@string/assetStatements" />
        <meta-data android:name="web_manifest_url" android:value="https://orvuno-worldproject.vercel.app/manifest.webmanifest" />
        <meta-data android:name="twa_generator" android:value="bubblewrap-cli-1.25-compatible" />

        <activity
            android:name=".LauncherActivity"
            android:alwaysRetainTaskState="true"
            android:exported="true"
            android:label="@string/launcherName">
            <meta-data android:name="android.support.customtabs.trusted.DEFAULT_URL" android:value="@string/launchUrl" />
            <meta-data android:name="android.support.customtabs.trusted.STATUS_BAR_COLOR" android:resource="@color/colorPrimary" />
            <meta-data android:name="android.support.customtabs.trusted.STATUS_BAR_COLOR_DARK" android:resource="@color/colorPrimaryDark" />
            <meta-data android:name="android.support.customtabs.trusted.NAVIGATION_BAR_COLOR" android:resource="@color/navigationColor" />
            <meta-data android:name="android.support.customtabs.trusted.NAVIGATION_BAR_COLOR_DARK" android:resource="@color/navigationColorDark" />
            <meta-data android:name="android.support.customtabs.trusted.SPLASH_IMAGE_DRAWABLE" android:resource="@drawable/splash" />
            <meta-data android:name="android.support.customtabs.trusted.SPLASH_SCREEN_BACKGROUND_COLOR" android:resource="@color/backgroundColor" />
            <meta-data android:name="android.support.customtabs.trusted.SPLASH_SCREEN_FADE_OUT_DURATION" android:value="300" />
            <meta-data android:name="android.support.customtabs.trusted.FILE_PROVIDER_AUTHORITY" android:value="@string/providerAuthority" />
            <meta-data android:name="android.support.customtabs.trusted.FALLBACK_STRATEGY" android:value="customtabs" />
            <meta-data android:name="android.support.customtabs.trusted.SCREEN_ORIENTATION" android:value="landscape" />
            <meta-data android:name="android.support.customtabs.trusted.LAUNCHING_BROWSER" android:value="com.android.chrome" />
            <meta-data android:name="android.support.customtabs.trusted.LAUNCHING_BROWSER_NAME" android:value="Google Chrome" />

            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
            <intent-filter android:autoVerify="true">
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="https" android:host="@string/hostName" />
            </intent-filter>
        </activity>

        <activity android:name="com.google.androidbrowserhelper.trusted.FocusActivity" />
        <activity android:name="com.google.androidbrowserhelper.trusted.NotificationPermissionRequestActivity" />

        <provider
            android:name="androidx.core.content.FileProvider"
            android:authorities="@string/providerAuthority"
            android:exported="false"
            android:grantUriPermissions="true">
            <meta-data android:name="android.support.FILE_PROVIDER_PATHS" android:resource="@xml/filepaths" />
        </provider>

        <service
            android:name=".DelegationService"
            android:enabled="true"
            android:exported="true">
            <meta-data android:name="android.support.customtabs.trusted.SMALL_ICON" android:resource="@drawable/ic_notification_icon" />
            <intent-filter>
                <action android:name="android.support.customtabs.trusted.TRUSTED_WEB_ACTIVITY_SERVICE" />
                <category android:name="android.intent.category.DEFAULT" />
            </intent-filter>
        </service>

        <activity
            android:name="com.google.androidbrowserhelper.playbilling.provider.PaymentActivity"
            android:theme="@android:style/Theme.Translucent.NoTitleBar"
            android:configChanges="keyboardHidden|keyboard|orientation|screenLayout|screenSize"
            android:exported="true">
            <intent-filter>
                <action android:name="org.chromium.intent.action.PAY" />
            </intent-filter>
            <meta-data
                android:name="org.chromium.default_payment_method_name"
                android:value="https://play.google.com/billing" />
        </activity>

        <service
            android:name="com.google.androidbrowserhelper.playbilling.provider.PaymentService"
            android:exported="true">
            <intent-filter>
                <action android:name="org.chromium.intent.action.IS_READY_TO_PAY" />
            </intent-filter>
        </service>
    </application>
</manifest>
__ORVUNO_FILE_2__

mkdir -p "$ROOT/app/src/main/java/de/nadena/orvuno"
cat > "$ROOT/app/src/main/java/de/nadena/orvuno/Application.java" <<'__ORVUNO_FILE_3__'
package de.nadena.orvuno;

public class Application extends android.app.Application {
    @Override
    public void onCreate() {
        super.onCreate();
    }
}
__ORVUNO_FILE_3__

mkdir -p "$ROOT/app/src/main/java/de/nadena/orvuno"
cat > "$ROOT/app/src/main/java/de/nadena/orvuno/DelegationService.java" <<'__ORVUNO_FILE_4__'
package de.nadena.orvuno;

import com.google.androidbrowserhelper.playbilling.digitalgoods.DigitalGoodsRequestHandler;

public class DelegationService extends com.google.androidbrowserhelper.trusted.DelegationService {
    @Override
    public void onCreate() {
        super.onCreate();
        registerExtraCommandHandler(new DigitalGoodsRequestHandler(getApplicationContext()));
    }
}
__ORVUNO_FILE_4__

mkdir -p "$ROOT/app/src/main/java/de/nadena/orvuno"
cat > "$ROOT/app/src/main/java/de/nadena/orvuno/LauncherActivity.java" <<'__ORVUNO_FILE_5__'
package de.nadena.orvuno;

import android.content.pm.ActivityInfo;
import android.os.Build;
import android.os.Bundle;

public class LauncherActivity extends com.google.androidbrowserhelper.trusted.LauncherActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (Build.VERSION.SDK_INT > Build.VERSION_CODES.O) {
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE);
        } else {
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED);
        }
    }
}
__ORVUNO_FILE_5__

mkdir -p "$ROOT/app/src/main/res/drawable"
cat > "$ROOT/app/src/main/res/drawable/ic_launcher.xml" <<'__ORVUNO_FILE_6__'
<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp" android:height="108dp" android:viewportWidth="108" android:viewportHeight="108">
    <path android:fillColor="#07101D" android:pathData="M0,0h108v108h-108z"/>
    <path android:fillColor="#F4BD43" android:pathData="M54,17A37,37 0,1 0,54 91A37,37 0,1 0,54 17M54,30A24,24 0,1 1,54 78A24,24 0,1 1,54 30"/>
    <path android:fillColor="#FFFFFF" android:pathData="M49,42h10v24h-10z"/>
</vector>
__ORVUNO_FILE_6__

mkdir -p "$ROOT/app/src/main/res/drawable"
cat > "$ROOT/app/src/main/res/drawable/ic_notification_icon.xml" <<'__ORVUNO_FILE_7__'
<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="24dp" android:height="24dp" android:viewportWidth="24" android:viewportHeight="24">
    <path android:fillColor="#FFFFFFFF" android:pathData="M12,3A9,9 0,1 0,12 21A9,9 0,1 0,12 3M12,7A5,5 0,1 1,12 17A5,5 0,1 1,12 7"/>
</vector>
__ORVUNO_FILE_7__

mkdir -p "$ROOT/app/src/main/res/drawable"
cat > "$ROOT/app/src/main/res/drawable/splash.xml" <<'__ORVUNO_FILE_8__'
<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="192dp" android:height="192dp" android:viewportWidth="192" android:viewportHeight="192">
    <path android:fillColor="#07101D" android:pathData="M0,0h192v192h-192z"/>
    <path android:fillColor="#F4BD43" android:pathData="M96,30A66,66 0,1 0,96 162A66,66 0,1 0,96 30M96,54A42,42 0,1 1,96 138A42,42 0,1 1,96 54"/>
</vector>
__ORVUNO_FILE_8__

mkdir -p "$ROOT/app/src/main/res/values"
cat > "$ROOT/app/src/main/res/values/colors.xml" <<'__ORVUNO_FILE_9__'
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="colorPrimary">#07101D</color>
    <color name="colorPrimaryDark">#000000</color>
    <color name="navigationColor">#000000</color>
    <color name="navigationColorDark">#000000</color>
    <color name="backgroundColor">#07101D</color>
</resources>
__ORVUNO_FILE_9__

mkdir -p "$ROOT/app/src/main/res/values"
cat > "$ROOT/app/src/main/res/values/strings.xml" <<'__ORVUNO_FILE_10__'
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="appName">ORVUNO</string>
    <string name="launcherName">ORVUNO</string>
    <string name="hostName">orvuno-worldproject.vercel.app</string>
    <string name="launchUrl">https://orvuno-worldproject.vercel.app/?source=app</string>
    <string name="providerAuthority">de.nadena.orvuno.fileprovider</string>
    <string name="assetStatements">[{"relation":["delegate_permission/common.handle_all_urls"],"target":{"namespace":"web","site":"https://orvuno-worldproject.vercel.app"}}]</string>
</resources>
__ORVUNO_FILE_10__

mkdir -p "$ROOT/app/src/main/res/xml"
cat > "$ROOT/app/src/main/res/xml/filepaths.xml" <<'__ORVUNO_FILE_11__'
<?xml version="1.0" encoding="utf-8"?>
<paths xmlns:android="http://schemas.android.com/apk/res/android">
    <files-path name="twa_splash" path="twa_splash/" />
</paths>
__ORVUNO_FILE_11__

:
cat > "$ROOT/build.gradle" <<'__ORVUNO_FILE_12__'
plugins {
    id 'com.android.application' version '8.9.1' apply false
}
__ORVUNO_FILE_12__

:
cat > "$ROOT/gradle.properties" <<'__ORVUNO_FILE_13__'
org.gradle.jvmargs=-Xmx2048m -Dfile.encoding=UTF-8
android.useAndroidX=true
android.nonTransitiveRClass=true
__ORVUNO_FILE_13__

:
cat > "$ROOT/settings.gradle" <<'__ORVUNO_FILE_14__'
pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}
rootProject.name = 'ORVUNO-Android'
include ':app'
__ORVUNO_FILE_14__

:
cat > "$ROOT/twa-manifest.json" <<'__ORVUNO_FILE_15__'
{
  "packageId": "de.nadena.orvuno",
  "host": "orvuno-worldproject.vercel.app",
  "name": "ORVUNO",
  "launcherName": "ORVUNO",
  "display": "standalone",
  "themeColor": "#07101D",
  "themeColorDark": "#000000",
  "navigationColor": "#000000",
  "navigationColorDark": "#000000",
  "backgroundColor": "#07101D",
  "enableNotifications": true,
  "startUrl": "/?source=app",
  "iconUrl": "https://orvuno-worldproject.vercel.app/app-icon.svg",
  "maskableIconUrl": "https://orvuno-worldproject.vercel.app/app-icon-maskable.svg",
  "splashScreenFadeOutDuration": 300,
  "signingKey": {"path": "android.keystore", "alias": "android"},
  "appVersionName": "1.0.3",
  "appVersionCode": 6,
  "shortcuts": [],
  "generatorApp": "bubblewrap-cli",
  "webManifestUrl": "https://orvuno-worldproject.vercel.app/manifest.webmanifest",
  "fallbackType": "customtabs",
  "features": {"playBilling": {"enabled": true}},
  "alphaDependencies": {"enabled": false},
  "enableSiteSettingsShortcut": false,
  "isChromeOSOnly": false,
  "isMetaQuest": false,
  "fullScopeUrl": "https://orvuno-worldproject.vercel.app/",
  "minSdkVersion": 23,
  "orientation": "landscape",
  "fingerprints": [],
  "additionalTrustedOrigins": [],
  "retainedBundles": [],
  "protocolHandlers": [],
  "fileHandlers": [],
  "launchHandlerClientMode": "",
  "displayOverride": [],
  "appVersion": "1.0.3"
}
__ORVUNO_FILE_15__

echo "ORVUNO Android project generated at $ROOT"
grep -n "versionCode\|versionName\|minSdk\|targetSdk" "$ROOT/app/build.gradle"
grep -n "billing:1.2.0\|androidbrowserhelper:2.7.2" "$ROOT/app/build.gradle"
grep -n "BILLING\|PaymentActivity\|PaymentService\|LAUNCHING_BROWSER" "$ROOT/app/src/main/AndroidManifest.xml"
