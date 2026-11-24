---
title: Phone photos — compress on device, thumbnail on upload
summary: 12 MB camera photos become 200 KB uploads plus a 480 px WebP thumb, and lists load only the thumbs.
tags: [images, performance, capacitor, supabase]
date: 2026-11-24
---

# Phone photos — compress on device, thumbnail on upload

## Problem
Modern phones produce 4000 px, 5–12 MB photos. Uploading them on mobile data is slow, and a feed of full-size images melts low-end devices.

## Why
The feed only needs ~480 px, the detail page ~1600 px. Everything above is wasted bandwidth, storage and memory.

## Fix
**On device** — resize and re-encode before upload:

```ts
async function compress(src: string, maxSide = 1600, quality = 0.85): Promise<Blob> {
  const img = await createImageBitmap(await (await fetch(src)).blob());
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const canvas = new OffscreenCanvas(Math.round(img.width * scale), Math.round(img.height * scale));
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.convertToBlob({ type: 'image/jpeg', quality });
}
```

**On upload** — the API stores the photo and a `<name>_thumb.webp` (480 px).

**In lists** — load the thumb, fall back gracefully:

```html
<img [src]="thumb(url)" loading="lazy" (error)="onThumbError($event, url)" alt="" />
```
`thumb → full → placeholder`, so old photos without a thumb still show.

Private photos (chat) live in a private bucket and are served through short-lived signed links; reuse a link while it is still valid instead of re-signing on every poll.

## Check
- Upload a 12 MB photo on 3G throttling: under a few seconds.
- Network tab on the feed: only `_thumb.webp` requests.
