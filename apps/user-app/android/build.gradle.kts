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
// API but does not expose it transitively, so its own compileRelease/DebugJava
// fails with "class file for ...CallbackToFutureAdapter not found". Inject the
// dependency directly into that plugin subproject (an app-module dep does not
// reach a separate plugin subproject's javac classpath).
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
