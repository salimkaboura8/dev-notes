---
title: Capacitor 8 release AAB needs a JDK 21 toolchain
summary: bundleRelease fails with JDK 17 or 25 — Android Studio already ships the JDK 21 you need.
tags: [android, capacitor, gradle]
date: 2026-11-24
---

# Capacitor 8 release AAB needs a JDK 21 toolchain

## Problem
```text
Cannot find a Java installation on your machine matching:
{languageVersion=21, vendor=any vendor, implementation=vendor-specific}
Toolchain download repositories have not been configured.
```

## Why
Capacitor 8 plugins compile with a Java 21 toolchain. If `JAVA_HOME` points to JDK 17 or 25, Gradle refuses before building anything.

## Fix
Use the JDK bundled with Android Studio (JBR) — no extra install:

```bash
export JAVA_HOME="/c/Program Files/Android/Android Studio/jbr"   # Git Bash on Windows
npx ng build --configuration production
npx cap sync android
cd android && ./gradlew bundleRelease
```

Derive the version from `package.json` so it can never drift:

```groovy
// versionCode = major*10000 + minor*100 + patch — must grow for every Play upload
versionCode versionMajor * 10000 + versionMinor * 100 + versionPatch
```

## Check
```bash
# Signed with the upload key, not the debug key?
jarsigner -verify -verbose:summary -certs app/build/outputs/bundle/release/app-release.aab
```
A reused `versionCode` is rejected by Play — bump first, then build.
