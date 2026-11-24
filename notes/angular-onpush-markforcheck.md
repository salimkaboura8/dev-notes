---
title: OnPush everywhere, and the one line you must not forget
summary: With ChangeDetectionStrategy.OnPush, async state changes don't render until you call markForCheck().
tags: [angular, ionic, performance]
date: 2026-11-24
---

# OnPush everywhere, and the one line you must not forget

## Problem
A page loads data, the network tab shows the response, but the spinner never stops — until you tap anywhere.

## Why
`OnPush` only re-renders on new `@Input()` references, template events and `async` pipe emissions. A field assigned after an `await` is none of those.

## Fix
Call `markForCheck()` after **every** async state change:

```ts
@Component({ changeDetection: ChangeDetectionStrategy.OnPush, /* ... */ })
export class FeedPage {
  private readonly cdr = inject(ChangeDetectorRef);
  loading = true;
  items: Item[] = [];

  async load() {
    try {
      this.items = await this.api.list();
    } finally {
      this.loading = false;
      this.cdr.markForCheck();   // <- without this, nothing updates
    }
  }
}
```

With Ionic, pages are cached: put resets in `ionViewWillEnter()`, not `ngOnInit()` — `ngOnInit` runs once per cached page.

## Check
- Review rule: any `await` / `subscribe` that assigns template state ends with `markForCheck()`.
- Or migrate that state to signals, which notify the view by themselves.
