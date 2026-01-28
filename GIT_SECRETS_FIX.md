# Fix GitHub Push Protection - Secrets in Git History

## Problem
GitHub detected secrets (Google OAuth Client ID & Secret) in commit history and blocked the push.

## Solution Options

### Option 1: Use GitHub Allow URL (Easiest - Recommended)

1. Go to this URL to allow the secret:
   ```
   https://github.com/devanshubhatnagar09/video-automation/security/secret-scanning/unblock-secret/38sgYQZSCa0OV9P6T7pBYLq4rcm
   ```
   (For Client ID)

2. Go to this URL for Client Secret:
   ```
   https://github.com/devanshubhatnagar09/video-automation/security/secret-scanning/unblock-secret/38sgYPwxGx93hX5UAqAHi2bPMKQ
   ```

3. Click "Allow secret" on both pages

4. Then push again:
   ```bash
   git push -u origin main
   ```

### Option 2: Remove Secrets from Git History (Advanced)

**Warning**: This rewrites git history. Only do this if you haven't shared the repo with others.

```bash
# Remove the file from that specific commit
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch OAUTH_FIX_CHECKLIST.md" \
  --prune-empty --tag-name-filter cat -- --all

# Force push (DANGEROUS - only if you're sure)
git push origin --force --all
```

### Option 3: Remove File from Last Commit (If it's the latest commit)

```bash
# Remove file from last commit but keep changes
git reset --soft HEAD~1
git reset HEAD OAUTH_FIX_CHECKLIST.md
git commit -m "api issue fix 5"
git push -u origin main
```

### Option 4: Create New File Without Secrets

1. Delete the old file:
   ```bash
   git rm OAUTH_FIX_CHECKLIST.md
   ```

2. Create new version (already done - secrets removed)

3. Commit:
   ```bash
   git add OAUTH_FIX_CHECKLIST.md
   git commit -m "Remove secrets from OAUTH_FIX_CHECKLIST.md"
   git push -u origin main
   ```

## Recommended: Option 1

**Easiest and safest**: Use GitHub's allow URL to permit these secrets (they're already exposed in the commit, so allowing them won't make it worse).

Then push again:
```bash
git push -u origin main
```

## Prevention

To avoid this in future:
- ✅ Never commit real secrets to git
- ✅ Use `.env` files (already in `.gitignore`)
- ✅ Use placeholders in documentation files
- ✅ Use GitHub Secrets for CI/CD

---

**Current Status**: Secrets removed from `OAUTH_FIX_CHECKLIST.md` file. Use Option 1 to allow push.
