plugins {
    id("com.android.application")
    id("kotlin-android")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

android {
    namespace = "uz.gov.hokimiyat.worker_app"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
        // flutter_local_notifications (Bildirishnomalar) uses java.time APIs
        // that need core library desugaring on minSdk 24.
        isCoreLibraryDesugaringEnabled = true
    }

    kotlinOptions {
        jvmTarget = JavaVersion.VERSION_17.toString()
    }

    defaultConfig {
        // TODO: Specify your own unique Application ID (https://developer.android.com/studio/build/application-id.html).
        applicationId = "uz.gov.hokimiyat.worker_app"
        // You can update the following values to match your application needs.
        // For more information, see: https://flutter.dev/to/review-gradle-config.
        // 24 = floor required by google_mlkit_face_detection / camera plugins.
        minSdk = 24
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName

        ndk {
            // Faqat haqiqiy qurilma ABI'lari. x86/x86_64 (emulyator) ATAYLAB
            // chiqarilmaydi: (a) telefonlarга kerak emas, (b) `jni` paketining
            // x86_64 C++ (CMake/ninja) qurishi past-RAM mashinada yiqilardi
            // (`flutter build apk` ni `--target-platform`siz ishlatganda). Shu
            // bilan oddiy `flutter build apk` ham ishonchli o'tadi + APK kichik.
            abiFilters += listOf("armeabi-v7a", "arm64-v8a")
        }
    }

    buildTypes {
        release {
            // TODO: Add your own signing config for the release build.
            // Signing with the debug keys for now, so `flutter run --release` works.
            signingConfig = signingConfigs.getByName("debug")

            // R8/minification disabled for the v1 build. tflite_flutter's optional
            // GPU delegate references org.tensorflow.lite.gpu.GpuDelegateFactory
            // classes that aren't bundled, so full R8 fails with "Missing class".
            // Disabling code shrinking sidesteps that (and cuts build memory on
            // low-RAM machines). For production, re-enable minify and add proper
            // -keep/-dontwarn rules for org.tensorflow.lite.** in proguard-rules.pro.
            isMinifyEnabled = false
            isShrinkResources = false
        }
    }
}

flutter {
    source = "../.."
}

dependencies {
    // Required by isCoreLibraryDesugaringEnabled above (flutter_local_notifications).
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.4")

    // camera_android_camerax (camera-core 1.5.x) references
    // androidx.concurrent.futures.CallbackToFutureAdapter in its annotated
    // public API (SurfaceRequest). Without this on the compile classpath,
    // javac fails the release/debug build with:
    //   "class file for androidx.concurrent.futures.CallbackToFutureAdapter
    //    not found". Providing it explicitly resolves the annotation-attach.
    implementation("androidx.concurrent:concurrent-futures:1.2.0")
}
