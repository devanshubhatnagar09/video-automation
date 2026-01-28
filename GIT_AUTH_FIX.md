# Git Authentication Fix - GitHub Push

## Problem
```
fatal: Authentication failed for 'https://github.com/devanshubhatnagar09/video-automation.git/'
```

## Solution 1: Personal Access Token (Recommended)

### Step 1: GitHub पर Token बनाएं
1. GitHub.com पर login करें
2. Settings → Developer settings → Personal access tokens → Tokens (classic)
3. "Generate new token (classic)" click करें
4. Note: `video-automation` (कुछ भी)
5. Expiration: 90 days या No expiration
6. Scopes: ✅ `repo` (full control) check करें
7. "Generate token" click करें
8. **Token copy करें** (एक बार ही दिखेगा!)

### Step 2: Token से Push करें
```bash
# Terminal में:
cd /Users/devanshu.bhatnagar/Documents/video-automation

# Push करते समय username और password के जगह:
# Username: devanshubhatnagar09
# Password: <paste-your-token-here>

git push -u origin main
```

### Step 3: Token को Store करें (Optional)
```bash
# Git credential helper use करें
git config --global credential.helper osxkeychain

# फिर push करें - token enter करें
git push -u origin main
```

---

## Solution 2: SSH Key Setup (Alternative)

### Step 1: SSH Key Generate करें
```bash
# Check करें अगर SSH key already है
ls -la ~/.ssh

# नया SSH key generate करें (अगर नहीं है)
ssh-keygen -t ed25519 -C "your_email@example.com"
# Enter press करें (default location)
# Passphrase (optional) - Enter press करें
```

### Step 2: SSH Key को GitHub में Add करें
```bash
# Public key copy करें
cat ~/.ssh/id_ed25519.pub
# या
pbcopy < ~/.ssh/id_ed25519.pub
```

1. GitHub.com → Settings → SSH and GPG keys
2. "New SSH key" click करें
3. Title: `MacBook` (कुछ भी)
4. Key: Paste करें (जो copy किया था)
5. "Add SSH key" click करें

### Step 3: Remote URL को SSH में Change करें
```bash
cd /Users/devanshu.bhatnagar/Documents/video-automation

# HTTPS से SSH में change करें
git remote set-url origin git@github.com:devanshubhatnagar09/video-automation.git

# Verify करें
git remote -v

# Push करें
git push -u origin main
```

---

## Quick Fix (Temporary)

अगर तुरंत push करना है:

```bash
cd /Users/devanshu.bhatnagar/Documents/video-automation

# URL में username add करें
git remote set-url origin https://devanshubhatnagar09@github.com/devanshubhatnagar09/video-automation.git

# Push करें - password prompt आएगा
git push -u origin main
# Password में: Personal Access Token paste करें
```

---

## Verify Authentication

```bash
# Test करें
git ls-remote origin

# अगर success हो तो push करें
git push -u origin main
```

---

## Troubleshooting

### अगर "Permission denied" आए:
- SSH key properly add किया है?
- Personal Access Token correct है?
- Token में `repo` scope है?

### अगर "Repository not found" आए:
- Repository name correct है?
- Repository public है या access permission है?

---

**Recommended**: Personal Access Token use करें - सबसे simple और secure!
