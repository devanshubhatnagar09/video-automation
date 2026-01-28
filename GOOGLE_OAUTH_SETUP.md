# Google OAuth 2.0 Setup Guide - Vercel Deployment

## Error Fix: "invalid_request" Error 400

यह error आता है जब Vercel URL Google Cloud Console में configured नहीं है।

## Step-by-Step Fix

### Step 1: Google Cloud Console में जाएं

1. [Google Cloud Console](https://console.cloud.google.com) पर जाएं
2. अपना project select करें
3. **APIs & Services** → **Credentials** पर जाएं

### Step 2: OAuth 2.0 Client ID Edit करें

1. अपने **OAuth 2.0 Client ID** को click करें (जो YouTube के लिए बना है)
2. **Edit** button click करें

### Step 3: Authorized JavaScript Origins Add करें

**Authorized JavaScript origins** section में ये URLs add करें:

```
https://video-automation-ten.vercel.app
https://*.vercel.app
```

**Note**: `*.vercel.app` wildcard use करें ताकि सभी Vercel preview URLs work करें।

### Step 4: Authorized Redirect URIs Add करें

**Authorized redirect URIs** section में ये URLs add करें:

```
https://video-automation-ten.vercel.app/api/youtube/callback
https://*.vercel.app/api/youtube/callback
http://localhost:3001/api/youtube/callback
```

**Important**: 
- Production URL: `https://video-automation-ten.vercel.app/api/youtube/callback`
- Wildcard for previews: `https://*.vercel.app/api/youtube/callback`
- Local development: `http://localhost:3001/api/youtube/callback`

### Step 5: Vercel Environment Variables Set करें

Vercel Dashboard में:

1. **Project** → **Settings** → **Environment Variables**
2. Add करें:

```
YOUTUBE_CLIENT_ID=your-client-id-here
YOUTUBE_CLIENT_SECRET=your-client-secret-here
YOUTUBE_REDIRECT_URI=https://video-automation-ten.vercel.app/api/youtube/callback
VERCEL_URL=https://video-automation-ten.vercel.app
```

### Step 6: OAuth Consent Screen Verify करें

1. **APIs & Services** → **OAuth consent screen**
2. Verify करें:
   - ✅ App name set है
   - ✅ User support email set है
   - ✅ Developer contact information set है
   - ✅ Scopes added हैं:
     - `https://www.googleapis.com/auth/youtube.upload`
     - `https://www.googleapis.com/auth/youtube`
     - `https://www.googleapis.com/auth/youtube.readonly`

### Step 7: Test Users Add करें (अगर App Testing में है)

अगर OAuth consent screen **Testing** mode में है:

1. **OAuth consent screen** → **Test users** section
2. **+ ADD USERS** click करें
3. अपना email add करें (जिससे YouTube authenticate करना है)
4. **SAVE** करें

### Step 8: Redeploy करें

1. Vercel Dashboard में **Redeploy** करें
2. या Git में push करें (auto-deploy होगा)

## Quick Checklist

- [ ] Google Cloud Console में OAuth Client ID edit किया
- [ ] Authorized JavaScript origins में Vercel URL add किया
- [ ] Authorized redirect URIs में callback URL add किया
- [ ] Vercel Environment Variables set किए
- [ ] OAuth consent screen configured है
- [ ] Test users add किए (अगर testing mode में है)
- [ ] Redeploy किया

## Common Issues

### Issue 1: "redirect_uri_mismatch"
**Fix**: Redirect URI exactly match होना चाहिए (trailing slash भी check करें)

### Issue 2: "invalid_client"
**Fix**: Client ID और Secret verify करें

### Issue 3: "access_denied"
**Fix**: OAuth consent screen में scopes verify करें

### Issue 4: "invalid_grant"
**Fix**: Test users में अपना email add करें

## URLs to Add in Google Cloud Console

### Authorized JavaScript Origins:
```
https://video-automation-ten.vercel.app
https://*.vercel.app
```

### Authorized Redirect URIs:
```
https://video-automation-ten.vercel.app/api/youtube/callback
https://*.vercel.app/api/youtube/callback
http://localhost:3001/api/youtube/callback
```

## After Setup

1. Vercel पर redeploy करें
2. App में YouTube connect करें
3. Google OAuth page open होगा
4. Allow करें
5. Success message दिखेगा

---

**Note**: Changes save करने के बाद 5-10 minutes लग सकते हैं propagate होने में।
