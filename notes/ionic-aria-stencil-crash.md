---
title: "reading 'onAriaChanged'" — don't bind aria-* on ion-button
summary: A bound aria attribute that changes before the Stencil component lazy-loads crashes it.
tags: [ionic, stencil, accessibility, sentry]
date: 2026-11-24
---

# "reading 'onAriaChanged'" — don't bind aria-* on ion-button

## Problem
Production error tracking shows, on a few devices only:

```text
TypeError: Cannot read properties of undefined (reading 'onAriaChanged')
```

## Why
Ionic components are Stencil web components that **lazy-load**. Angular sets `[attr.aria-label]` immediately; if the value changes (e.g. the translation arrives) before `ion-button` has hydrated, Stencil's attribute watcher runs on a component that doesn't exist yet. Slow devices hit the race; your laptop never does.

## Fix
For icon-only buttons with a translated label, use a native button styled like the toolbar:

```html
<!-- risky -->
<ion-button [attr.aria-label]="'common.back' | translate"><ion-icon name="arrow-back" /></ion-button>

<!-- safe -->
<button type="button" class="toolbar-icon-btn" [attr.aria-label]="'common.back' | translate">
  <ion-icon name="arrow-back" aria-hidden="true"></ion-icon>
</button>
```

## Check
```bash
grep -rnE "<ion-button[^>]*\[attr\.aria-" src/
```
Should return nothing. Add it to code review or CI.
