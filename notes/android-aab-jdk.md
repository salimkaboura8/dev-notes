# Capacitor 8 release AAB: "Cannot find a Java installation matching languageVersion=21"

Capacitor 8 plugins compile with a Java 21 toolchain. If `JAVA_HOME` points to JDK 17 or 25, Gradle fails before building.
Android Studio ships a JDK 21 (JBR) — use it, no extra install:

```bash
export JAVA_HOME="/c/Program Files/Android/Android Studio/jbr"
npx ng build --configuration production && npx cap sync android
cd android && ./gradlew bundleRelease
jarsigner -verify -verbose:summary -certs app/build/outputs/bundle/release/app-release.aab  # check the upload key, not debug
```
Bump `versionCode` before every Play upload — a reused one is rejected.
