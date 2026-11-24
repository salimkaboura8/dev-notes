# GitHub SSH on Windows: "Permission denied (publickey)" with a valid key

**Symptom:** `ssh -vT git@github.com` shows `Server accepts key: id_rsa`, then fails anyway.
**Cause:** the key has a passphrase, nothing can prompt for it (IDE, script, agent tool), and no ssh-agent holds it. Git for Windows' bundled `ssh.exe` can't talk to the Windows agent either.

**Fix (once):**
```powershell
# Administrator PowerShell
Get-Service ssh-agent | Set-Service -StartupType Automatic
Start-Service ssh-agent
# Normal PowerShell
ssh-add $env:USERPROFILE\.ssh\id_rsa
git config --global core.sshCommand "C:/Windows/System32/OpenSSH/ssh.exe"
C:\Windows\System32\OpenSSH\ssh.exe -T git@github.com
```
Tip: `ssh-keygen -y -P "" -f ~/.ssh/id_rsa` fails → the key is passphrase-protected.
