# Default to the device language, keep the user's choice

**Goal:** first launch opens in the phone/browser language; once the user picks one, it sticks.

1. Read an *explicit* choice first (localStorage; on native also Capacitor Preferences, because iOS can evict WebView storage).
2. Otherwise walk `navigator.languages` in order and take the first supported primary subtag (`ar-DZ` → `ar`).
3. Fall back to your default language — also for crawlers (Googlebot reports `en-US`, which would index the wrong language).
4. Save **only** explicit choices, so the app keeps following the device until the user decides.
5. Never block boot: time-box native reads (~600 ms) and survive a failed translation load.

```ts
export function detectDeviceLanguage(nav = navigator): AppLanguage {
  if (/bot|crawl|spider/i.test(nav.userAgent)) return 'fr';
  for (const tag of [...(nav.languages ?? []), nav.language]) {
    const lang = tag?.toLowerCase().split(/[-_]/)[0];
    if (SUPPORTED.includes(lang)) return lang as AppLanguage;
  }
  return 'fr';
}
```
