---
title: Arabic RTL — flip the text, not every layout
summary: Logical CSS properties everywhere, then pin the few areas that must stay left-to-right.
tags: [i18n, rtl, css, ionic]
date: 2026-11-24
---

# Arabic RTL — flip the text, not every layout

## Problem
Setting `<html dir="rtl">` mirrors everything. Some screens read naturally; others feel broken: the chat puts *my* bubbles on the left, the send button jumps to the left, the tab bar order reverses.

## Why
Users of bilingual apps keep strong habits from the apps they already use. Mirroring is a per-area decision, not a global switch.

## Fix
1. **Default: logical properties**, never physical left/right:

```scss
.card   { margin-inline-end: var(--space-2); text-align: start; }
.badge  { inset-inline-start: 8px; }
```

2. **Pin** the areas that must not mirror, and let user text pick its own direction:

```html
<div class="chat" dir="ltr">
  <p class="bubble mine" dir="auto">{{ message.text }}</p>
</div>
```

Good candidates to pin: tab bar, chat (bubbles, composer), conversation rows, search bar.

3. Ionic flips chevrons by itself in RTL — inside pinned areas, turn that off:

```html
<ion-icon name="chevron-forward" [flipRtl]="false"></ion-icon>
```

## Check
- Grep for `margin-left|padding-right|left:|right:` in styles: each hit needs a reason.
- Walk every screen in Arabic with a long Arabic text and a long Latin text.
