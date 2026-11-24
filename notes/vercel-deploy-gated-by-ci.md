---
title: Push to main = production, safely
summary: Vercel Deployment Checks hold the release until CI is green, and a /health version proves what is live.
tags: [vercel, github-actions, ci, deploy]
date: 2026-11-24
---

# Push to main = production, safely

## Problem
A one-branch workflow (push to `main` deploys) is fast — until a broken build or a missing dependency reaches users.

## Why
By default Vercel deploys as soon as it receives the commit, in parallel with your tests. "Tests failed" arrives after "deployed".

## Fix
1. **CI jobs with stable names** (Vercel matches them by name):

```yaml
jobs:
  api-tests:
    name: API tests
    runs-on: ubuntu-latest
    steps: [ ... pytest ... ]
  app-build:
    name: App build
    runs-on: ubuntu-latest
    steps: [ ... production build ... ]
```

2. **Vercel → Settings → Deployment Checks**: require `API tests` and `App build`. The production deploy is built but **held** until both pass.

3. **Expose the commit** so you can prove what is live:

```python
@app.get("/health")
def health():
    return {"status": "ok", "version": os.getenv("VERCEL_GIT_COMMIT_SHA", "dev")[:7]}
```

4. A post-deploy workflow waits until `/health` reports the pushed SHA, then runs the end-to-end smoke test.

## Check
```bash
curl -s https://api.example.com/health   # {"status":"ok","version":"<sha7>"}
git rev-parse --short=7 HEAD
```
Same value = the commit you pushed is the one serving traffic.
