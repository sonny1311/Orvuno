plugins { id("com.android.application") }

android {
    namespace = "de.nadena.orvuno"
    compileSdk = 35

    defaultConfig {
        applicationId = "de.nadena.orvuno"
        minSdk = 23
        targetSdk = 35
        versionCode = 2
        versionName = "1.0.2"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            isShrinkResources = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    implementation("com.amazon.device:amazon-appstore-sdk:3.0.9")
}
