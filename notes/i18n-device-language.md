---
title: Default to the device language, keep the user's choice
summary: First launch follows the phone or browser; an explicit pick sticks forever, even if iOS wipes WebView storage.
tags: [i18n, capacitor, angular]
date: 2026-11-24
---

# Default to the device language, keep the user's choice

## Problem
The app always opened in French. Arabic and English phones had to find the language switch by hand, and on iOS a saved choice could silently disappear.

## Why
- The startup code only read `localStorage` and fell back to a hard-coded default.
- iOS may evict a WebView's `localStorage` under storage pressure.
- Googlebot reports `en-US`: blindly following the browser would index the wrong language.

## Fix
Resolve the language in this order:

1. **Explicit choice** — `localStorage`, then native storage (Capacitor Preferences) on Android/iOS.
2. **Device language** — the first supported primary subtag in `navigator.languages` (`ar-DZ` → `ar`).
3. **Default** — also for crawlers and link-preview bots.

Save **only** explicit choices, so the app keeps following the device until the user decides.

```ts
const BOT = /bot\b|bot\/|crawl|spider|slurp|facebookexternalhit|preview/i;

export function detectDeviceLanguage(nav = navigator): AppLanguage {
  if (BOT.test(nav.userAgent ?? '')) return DEFAULT;
  for (const tag of [...(nav.languages ?? []), nav.language]) {
    const lang = tag?.trim().toLowerCase().split(/[-_]/)[0];
    if (SUPPORTED.includes(lang as AppLanguage)) return lang as AppLanguage;
  }
  return DEFAULT;
}
```

Never block boot on it: race the native read against a ~600 ms timeout, and catch a failed translation download so the fallback language still renders.

## Check
- Unit-test `detectDeviceLanguage` with plain objects (`{ languages: ['kab', 'ar-DZ'] }` → `ar`).
- Clear storage, change the browser language, reload: the UI and `<html lang dir>` follow.
- Pick a language, reload: it sticks.
