allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

val newBuildDir: Directory =
    rootProject.layout.buildDirectory
        .dir("../../build")
        .get()
rootProject.layout.buildDirectory.value(newBuildDir)

subprojects {
    val newSubprojectBuildDir: Directory = newBuildDir.dir(project.name)
    project.layout.buildDirectory.value(newSubprojectBuildDir)
}
subprojects {
    project.evaluationDependsOn(":app")
}

// camera_android_camerax (camera-core 1.5.x) references
// androidx.concurrent.futures.CallbackToFutureAdapter in its annotated public
// API but does not expose the dependency transitively, so its own
// `compileReleaseJavaWithJavac` fails with "class file for
// androidx.concurrent.futures.CallbackToFutureAdapter not found". Injecting the
// dependency directly into that plugin subproject puts it on the module's
// compile classpath. Must be done here (root) — an app-module dependency does
// not reach a separate plugin subproject's javac classpath.
subprojects {
    if (name == "camera_android_camerax") {
        afterEvaluate {
            dependencies {
                add("implementation", "androidx.concurrent:concurrent-futures:1.2.0")
            }
        }
    }
}

tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}
