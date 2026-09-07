#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-android-test/orvuno-code7-test}"
rm -rf "$ROOT"
mkdir -p "$ROOT/app/src/main/java/de/nadena/orvuno"
mkdir -p "$ROOT/app/src/main/res/drawable"
mkdir -p "$ROOT/app/src/main/res/mipmap-anydpi-v26"
mkdir -p "$ROOT/app/src/main/res/values"
mkdir -p "$ROOT/app/src/main/res/xml"

cat > "$ROOT/settings.gradle" <<'GRADLE'
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
GRADLE

cat > "$ROOT/build.gradle" <<'GRADLE'
plugins {
    id 'com.android.application' version '8.9.1' apply false
}
GRADLE

cat > "$ROOT/gradle.properties" <<'PROPS'
org.gradle.jvmargs=-Xmx2048m -Dfile.encoding=UTF-8
android.useAndroidX=true
android.nonTransitiveRClass=true
PROPS

cat > "$ROOT/app/proguard-rules.pro" <<'PRO'
# Keep TWA/Billing bridge classes explicit for the release-style test build.
-keep class com.google.androidbrowserhelper.playbilling.** { *; }
-keep class com.google.androidbrowserhelper.trusted.** { *; }
-keep class de.nadena.orvuno.** { *; }
PRO

cat > "$ROOT/app/build.gradle" <<'GRADLE'
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
        versionCode 7
        versionName '1.0.4'

        resValue 'string', 'appName', 'ORVUNO'
        resValue 'string', 'launcherName', 'ORVUNO'
        resValue 'string', 'launchUrl', 'https://orvuno-worldproject.vercel.app/?source=app'
        resValue 'string', 'webManifestUrl', 'https://orvuno-worldproject.vercel.app/manifest.webmanifest'
        resValue 'string', 'fullScopeUrl', 'https://orvuno-worldproject.vercel.app/'
        resValue 'string', 'hostName', 'orvuno-worldproject.vercel.app'
        resValue 'color', 'colorPrimary', '#07101D'
        resValue 'color', 'colorPrimaryDark', '#000000'
        resValue 'color', 'navigationColor', '#000000'
        resValue 'color', 'navigationColorDark', '#000000'
        resValue 'color', 'navigationDividerColor', '#000000'
        resValue 'color', 'navigationDividerColorDark', '#000000'
        resValue 'color', 'backgroundColor', '#07101D'
        resValue 'string', 'providerAuthority', 'de.nadena.orvuno.fileprovider'
        resValue 'bool', 'enableNotification', 'true'
        resValue 'integer', 'splashScreenFadeOutDuration', '300'
        resValue 'string', 'generatorApp', 'bubblewrap-cli-compatible-original-wrapper'
        resValue 'string', 'fallbackType', 'customtabs'
        resValue 'bool', 'enableSiteSettingsShortcut', 'true'
        resValue 'string', 'orientation', 'landscape'
    }

    buildTypes {
        release {
            // Original ORVUNO used release minification. Keep release-like behavior,
            // but preserve bridge classes explicitly above for diagnosability.
            minifyEnabled true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }

    compileOptions {
        sourceCompatibility JavaVersion.VERSION_1_8
        targetCompatibility JavaVersion.VERSION_1_8
    }

    lint {
        checkReleaseBuilds = false
    }
}

dependencies {
    // Keep the original ORVUNO core Android Browser Helper version.
    implementation 'com.google.androidbrowserhelper:androidbrowserhelper:2.6.2'
    // Only the current Play Billing bridge is added/updated.
    implementation 'com.google.androidbrowserhelper:billing:1.2.0'
}
GRADLE

cat > "$ROOT/app/src/main/java/de/nadena/orvuno/Application.java" <<'JAVA'
package de.nadena.orvuno;

public class Application extends android.app.Application {
    @Override
    public void onCreate() {
        super.onCreate();
    }
}
JAVA

cat > "$ROOT/app/src/main/java/de/nadena/orvuno/DelegationService.java" <<'JAVA'
package de.nadena.orvuno;

import com.google.androidbrowserhelper.playbilling.digitalgoods.DigitalGoodsRequestHandler;

public class DelegationService extends com.google.androidbrowserhelper.trusted.DelegationService {
    @Override
    public void onCreate() {
        super.onCreate();
        registerExtraCommandHandler(new DigitalGoodsRequestHandler(getApplicationContext()));
    }
}
JAVA

cat > "$ROOT/app/src/main/java/de/nadena/orvuno/LauncherActivity.java" <<'JAVA'
package de.nadena.orvuno;

import android.content.pm.ActivityInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;

public class LauncherActivity extends com.google.androidbrowserhelper.trusted.LauncherActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Same Oreo guard as the original Bubblewrap-generated ORVUNO project.
        if (Build.VERSION.SDK_INT > Build.VERSION_CODES.O) {
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE);
        } else {
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED);
        }
    }

    @Override
    protected Uri getLaunchingUrl() {
        return super.getLaunchingUrl();
    }
}
JAVA

cat > "$ROOT/app/src/main/AndroidManifest.xml" <<'XML'
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
    <uses-permission android:name="com.android.vending.BILLING" />

    <application
        android:name="de.nadena.orvuno.Application"
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/appName"
        android:manageSpaceActivity="com.google.androidbrowserhelper.trusted.ManageDataLauncherActivity"
        android:supportsRtl="true"
        android:theme="@android:style/Theme.Translucent.NoTitleBar">

        <meta-data android:name="asset_statements" android:resource="@string/assetStatements" />
        <meta-data android:name="web_manifest_url" android:value="@string/webManifestUrl" />
        <meta-data android:name="twa_generator" android:value="@string/generatorApp" />

        <activity
            android:name="com.google.androidbrowserhelper.trusted.ManageDataLauncherActivity"
            android:exported="false"
            android:enabled="true"
            android:excludeFromRecents="true">
            <meta-data
                android:name="android.support.customtabs.trusted.MANAGE_SPACE_URL"
                android:value="@string/launchUrl" />
            <intent-filter>
                <action android:name="android.intent.action.APPLICATION_PREFERENCES" />
                <category android:name="android.intent.category.DEFAULT" />
            </intent-filter>
        </activity>

        <activity
            android:name="de.nadena.orvuno.LauncherActivity"
            android:alwaysRetainTaskState="true"
            android:label="@string/launcherName"
            android:exported="true">
            <meta-data android:name="android.support.customtabs.trusted.DEFAULT_URL" android:value="@string/launchUrl" />
            <meta-data android:name="android.support.customtabs.trusted.STATUS_BAR_COLOR" android:resource="@color/colorPrimary" />
            <meta-data android:name="android.support.customtabs.trusted.STATUS_BAR_COLOR_DARK" android:resource="@color/colorPrimaryDark" />
            <meta-data android:name="android.support.customtabs.trusted.NAVIGATION_BAR_COLOR" android:resource="@color/navigationColor" />
            <meta-data android:name="android.support.customtabs.trusted.NAVIGATION_BAR_COLOR_DARK" android:resource="@color/navigationColorDark" />
            <meta-data android:name="androix.browser.trusted.NAVIGATION_BAR_DIVIDER_COLOR" android:resource="@color/navigationDividerColor" />
            <meta-data android:name="androix.browser.trusted.NAVIGATION_BAR_DIVIDER_COLOR_DARK" android:resource="@color/navigationDividerColorDark" />
            <meta-data android:name="android.support.customtabs.trusted.SPLASH_IMAGE_DRAWABLE" android:resource="@drawable/splash" />
            <meta-data android:name="android.support.customtabs.trusted.SPLASH_SCREEN_BACKGROUND_COLOR" android:resource="@color/backgroundColor" />
            <meta-data android:name="android.support.customtabs.trusted.SPLASH_SCREEN_FADE_OUT_DURATION" android:value="@integer/splashScreenFadeOutDuration" />
            <meta-data android:name="android.support.customtabs.trusted.FILE_PROVIDER_AUTHORITY" android:value="@string/providerAuthority" />
            <meta-data android:name="android.app.shortcuts" android:resource="@xml/shortcuts" />
            <meta-data android:name="android.support.customtabs.trusted.FALLBACK_STRATEGY" android:value="@string/fallbackType" />
            <meta-data android:name="android.support.customtabs.trusted.SCREEN_ORIENTATION" android:value="@string/orientation" />

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
        <activity
            android:name="com.google.androidbrowserhelper.trusted.WebViewFallbackActivity"
            android:configChanges="orientation|screenSize" />

        <provider
            android:name="androidx.core.content.FileProvider"
            android:authorities="@string/providerAuthority"
            android:grantUriPermissions="true"
            android:exported="false">
            <meta-data android:name="android.support.FILE_PROVIDER_PATHS" android:resource="@xml/filepaths" />
        </provider>

        <service
            android:name="de.nadena.orvuno.DelegationService"
            android:enabled="@bool/enableNotification"
            android:exported="@bool/enableNotification">
            <meta-data android:name="android.support.customtabs.trusted.SMALL_ICON" android:resource="@drawable/ic_notification_icon" />
            <intent-filter>
                <action android:name="android.support.customtabs.trusted.TRUSTED_WEB_ACTIVITY_SERVICE" />
                <category android:name="android.intent.category.DEFAULT" />
            </intent-filter>
        </service>

        <activity android:name="com.google.androidbrowserhelper.trusted.NotificationPermissionRequestActivity" />

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
XML

cat > "$ROOT/app/src/main/res/values/strings.xml" <<'XML'
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="assetStatements">[{"relation":["delegate_permission/common.handle_all_urls"],"target":{"namespace":"web","site":"https://orvuno-worldproject.vercel.app"}}]</string>
</resources>
XML

cat > "$ROOT/app/src/main/res/values/colors.xml" <<'XML'
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="shortcut_background">#F5F5F5</color>
</resources>
XML

cat > "$ROOT/app/src/main/res/xml/filepaths.xml" <<'XML'
<?xml version="1.0" encoding="utf-8"?>
<paths xmlns:android="http://schemas.android.com/apk/res/android">
    <files-path name="twa_splash" path="twa_splash/" />
</paths>
XML

cat > "$ROOT/app/src/main/res/xml/shortcuts.xml" <<'XML'
<?xml version="1.0" encoding="utf-8"?>
<shortcuts xmlns:android="http://schemas.android.com/apk/res/android" />
XML

cat > "$ROOT/app/src/main/res/drawable/ic_launcher_foreground.xml" <<'XML'
<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp" android:height="108dp" android:viewportWidth="108" android:viewportHeight="108">
    <path android:fillColor="#07101D" android:pathData="M0,0h108v108h-108z" />
    <path android:fillColor="#F4BD43" android:pathData="M54,17A37,37 0,1 0,54 91A37,37 0,1 0,54 17M54,30A24,24 0,1 1,54 78A24,24 0,1 1,54 30" />
    <path android:fillColor="#FFFFFF" android:pathData="M49,42h10v24h-10z" />
</vector>
XML

cat > "$ROOT/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml" <<'XML'
<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@android:color/white" />
    <foreground android:drawable="@drawable/ic_launcher_foreground" />
</adaptive-icon>
XML

cat > "$ROOT/app/src/main/res/drawable/ic_launcher.xml" <<'XML'
<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp" android:height="108dp" android:viewportWidth="108" android:viewportHeight="108">
    <path android:fillColor="#07101D" android:pathData="M0,0h108v108h-108z" />
    <path android:fillColor="#F4BD43" android:pathData="M54,17A37,37 0,1 0,54 91A37,37 0,1 0,54 17M54,30A24,24 0,1 1,54 78A24,24 0,1 1,54 30" />
    <path android:fillColor="#FFFFFF" android:pathData="M49,42h10v24h-10z" />
</vector>
XML

# Legacy launcher reference for pre-26 devices.
mkdir -p "$ROOT/app/src/main/res/mipmap"
cp "$ROOT/app/src/main/res/drawable/ic_launcher.xml" "$ROOT/app/src/main/res/mipmap/ic_launcher.xml"

cat > "$ROOT/app/src/main/res/drawable/ic_notification_icon.xml" <<'XML'
<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="24dp" android:height="24dp" android:viewportWidth="24" android:viewportHeight="24">
    <path android:fillColor="#FFFFFFFF" android:pathData="M12,3A9,9 0,1 0,12 21A9,9 0,1 0,12 3M12,7A5,5 0,1 1,12 17A5,5 0,1 1,12 7" />
</vector>
XML

cat > "$ROOT/app/src/main/res/drawable/splash.xml" <<'XML'
<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="192dp" android:height="192dp" android:viewportWidth="192" android:viewportHeight="192">
    <path android:fillColor="#07101D" android:pathData="M0,0h192v192h-192z" />
    <path android:fillColor="#F4BD43" android:pathData="M96,30A66,66 0,1 0,96 162A66,66 0,1 0,96 30M96,54A42,42 0,1 1,96 138A42,42 0,1 1,96 54" />
</vector>
XML

printf 'Generated ORVUNO code7 Play project at %s\n' "$ROOT"
