---
title: GitHub SSH on Windows — key accepted, push still denied
summary: "Permission denied (publickey)" while GitHub says it accepts your key means nobody can unlock the passphrase.
tags: [git, windows, ssh]
date: 2026-11-24
---

# GitHub SSH on Windows — key accepted, push still denied

## Problem
`git push` fails with `Permission denied (publickey)` from IDEs, scripts and automation, but sometimes works from a terminal.

## Why
`ssh -vT git@github.com` tells the story:

```text
Offering public key: ~/.ssh/id_rsa RSA SHA256:...
Server accepts key: ~/.ssh/id_rsa RSA SHA256:...
Authentications that can continue: publickey   <- could not sign
```

GitHub knows the key, but it is **passphrase-protected**, nothing can prompt for the passphrase, and no `ssh-agent` holds it. Git for Windows also ships its own `ssh.exe`, which cannot reach the Windows agent.

Quick test — this fails when the key has a passphrase:

```bash
ssh-keygen -y -P "" -f ~/.ssh/id_rsa > /dev/null
```

## Fix
```powershell
# 1. Administrator PowerShell: run the Windows agent at boot
Get-Service ssh-agent | Set-Service -StartupType Automatic
Start-Service ssh-agent

# 2. Normal PowerShell: unlock the key once (remembered across reboots)
ssh-add $env:USERPROFILE\.ssh\id_rsa

# 3. Make Git use Windows OpenSSH so it talks to that agent
git config --global core.sshCommand "C:/Windows/System32/OpenSSH/ssh.exe"
```

## Check
```powershell
C:\Windows\System32\OpenSSH\ssh.exe -T git@github.com
# Hi <you>! You've successfully authenticated...
```
`Access denied` on step 1 means the window was not elevated.
