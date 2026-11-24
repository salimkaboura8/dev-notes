---
title: The dependency that only existed on my laptop
summary: pyproject.toml and requirements.txt drifted; production crashed on import. A 10-line CI check prevents it.
tags: [python, fastapi, ci, vercel]
date: 2026-11-24
---

# The dependency that only existed on my laptop

## Problem
Tests pass locally, deploy succeeds, then every request fails:

```text
ModuleNotFoundError: No module named 'PIL'
```

## Why
The package was installed in the local virtualenv by hand, so imports worked everywhere you looked. The host installs from `pyproject.toml`; another tool reads `requirements.txt`; neither declared it.

## Fix
One source of truth, and CI that fails when the two files disagree:

```python
# scripts/check_deps.py
import re, sys, tomllib

def names(lines):
    return {re.split(r"[<>=!~\[; ]", l.strip(), 1)[0].lower().replace("_", "-")
            for l in lines if l.strip() and not l.startswith("#")}

project = names(tomllib.load(open("pyproject.toml", "rb"))["project"]["dependencies"])
reqs = names(open("requirements.txt").read().splitlines())
if project != reqs:
    sys.exit(f"Dependency drift: only pyproject={project - reqs}, only requirements={reqs - project}")
```

And test in a **clean** environment in CI (`pip install .` in a fresh runner), never the dev venv.

## Check
- After each push: `curl /health` — a crash on import never reaches a healthy response.
- New `import` in a PR → the diff must also touch `pyproject.toml`.
