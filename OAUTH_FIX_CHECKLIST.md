# OAuth Redirect URI Mismatch - Fix Checklist

## Current Error
```
Error 400: redirect_uri_mismatch
redirect_uri=https://video-automation-ten.vercel.app/api/youtube/callback
```

## ✅ Step-by-Step Fix

### Step 1: Verify Google Cloud Console Configuration

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select your project
3. **APIs & Services** → **Credentials**
4. Click on your OAuth 2.0 Client ID

### Step 2: Check Authorized Redirect URIs

**Must have EXACTLY this URL (no trailing slash):**
```
https://video-automation-ten.vercel.app/api/youtube/callback
```

**Also add these for development:**
```
http://localhost:3001/api/youtube/callback
https://*.vercel.app/api/youtube/callback
```

### Step 3: Important Checks

✅ **No trailing slash** - `https://video-automation-ten.vercel.app/api/youtube/callback` (NOT `/callback/`)
✅ **Exact match** - Case sensitive, must match character by character
✅ **HTTPS** - Production URL must use `https://`
✅ **Save button clicked** - Changes must be saved in Google Cloud Console

### Step 4: Vercel Environment Variables

Go to Vercel Dashboard → Project → Settings → Environment Variables

**Add/Update these:**
```
YOUTUBE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
YOUTUBE_CLIENT_SECRET=your-client-secret-here
YOUTUBE_REDIRECT_URI=https://video-automation-ten.vercel.app/api/youtube/callback
```

**Note**: Replace `your-client-id-here` and `your-client-secret-here` with your actual values from Google Cloud Console.

**Important**: 
- `YOUTUBE_REDIRECT_URI` must match EXACTLY what's in Google Cloud Console
- No trailing slash
- Use `https://` not `http://`

### Step 5: Wait for Propagation

After saving in Google Cloud Console:
- ⏰ Wait **5-10 minutes** (sometimes up to a few hours)
- Google's changes need time to propagate

### Step 6: Redeploy Vercel

After setting environment variables:
1. Go to Vercel Dashboard → Deployments
2. Click **Redeploy** on latest deployment
3. Or push a new commit to trigger redeploy

### Step 7: Test Again

1. Clear browser cache
2. Try YouTube authentication again
3. Should work now!

## Common Mistakes to Avoid

❌ **Trailing slash**: `/callback/` instead of `/callback`
❌ **HTTP instead of HTTPS**: `http://video-automation-ten.vercel.app/...`
❌ **Wrong path**: `/api/youtube/callbacks` instead of `/api/youtube/callback`
❌ **Not saving**: Forgetting to click "Save" in Google Cloud Console
❌ **Case mismatch**: `Video-Automation` instead of `video-automation`

## Verification

To verify your redirect URI is correct:

1. Check Google Cloud Console → Credentials → OAuth Client
2. Look at "Authorized redirect URIs" section
3. Should see: `https://video-automation-ten.vercel.app/api/youtube/callback`
4. Check Vercel Environment Variables
5. `YOUTUBE_REDIRECT_URI` should match exactly

## Still Not Working?

1. **Double-check exact URL** - Copy from Google Cloud Console and paste in Vercel env var
2. **Wait longer** - Sometimes takes 30+ minutes
3. **Check Vercel logs** - See what redirect URI is being used
4. **Try incognito mode** - Clear browser cache issues
5. **Verify environment variables** - Make sure they're set for Production environment

---

**The redirect URI MUST be exactly:**
```
https://video-automation-ten.vercel.app/api/youtube/callback
```

No variations, no trailing slash, exact match!
