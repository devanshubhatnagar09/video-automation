# Vercel Deployment Guide - Video Automation App

## 📋 Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **GitHub/GitLab/Bitbucket**: Code को repository में push करें
3. **Environment Variables**: तैयार रखें (नीचे देखें)

## 🚀 Step-by-Step Deployment

### Step 1: Code को Git में Push करें

```bash
# Git repository initialize करें (अगर नहीं है)
git init
git add .
git commit -m "Initial commit - Video Automation App"

# GitHub/GitLab पर repository बनाएं और push करें
git remote add origin <your-repo-url>
git push -u origin main
```

### Step 2: Vercel Project Create करें

1. [Vercel Dashboard](https://vercel.com/dashboard) पर जाएं
2. **"Add New..."** → **"Project"** click करें
3. अपनी Git repository select करें
4. **"Import"** click करें

### Step 3: Project Settings Configure करें

Vercel में project settings में ये configure करें:

#### Build Settings:
- **Framework Preset**: `Other` या `Vite`
- **Root Directory**: `.` (root)
- **Build Command**: `cd frontend && npm install && npm run build`
- **Output Directory**: `frontend/dist`
- **Install Command**: `cd backend && npm install && cd ../frontend && npm install`

#### Environment Variables:
Vercel Dashboard → Project → Settings → Environment Variables में ये add करें:

```
NODE_ENV=production
```

**Note**: Gemini API key और YouTube credentials frontend से pass हो रहे हैं, इसलिए server-side env vars की जरूरत नहीं है।

### Step 4: Vercel.json Configuration

`vercel.json` file already configured है, लेकिन verify करें:

```json
{
  "version": 2,
  "buildCommand": "cd frontend && npm install && npm run build",
  "outputDirectory": "frontend/dist",
  "installCommand": "cd backend && npm install && cd ../frontend && npm install",
  "functions": {
    "api/**/*.ts": {
      "runtime": "@vercel/node@3.0.0",
      "maxDuration": 300
    }
  },
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "/api/$1"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ],
  "crons": [
    {
      "path": "/api/cron/generate-video",
      "schedule": "0 9 * * *"
    }
  ]
}
```

**Important**: `maxDuration: 300` (5 minutes) के लिए Vercel Pro plan चाहिए। Hobby plan में max 10 seconds है।

### Step 5: API Routes Setup

`api/` directory में serverless functions होनी चाहिए। Current structure:

```
api/
├── index.ts                    # Health check
├── gemini/
│   └── verify.ts               # Gemini API verification
├── workflow/
│   ├── start.ts                # Start video workflow
│   └── status/
│       └── [jobId].ts          # Get workflow status
├── youtube/
│   └── auth-url.ts             # YouTube OAuth URL
└── cron/
    └── generate-video.ts       # Daily cron job
```

### Step 6: Deploy करें

1. Vercel Dashboard में **"Deploy"** button click करें
2. या terminal में:
```bash
npm i -g vercel
vercel
```

### Step 7: Post-Deployment Setup

#### A. Cron Job Enable करें:
1. Vercel Dashboard → Project → Settings → Cron Jobs
2. Verify करें कि cron job configured है:
   - **Path**: `/api/cron/generate-video`
   - **Schedule**: `0 9 * * *` (daily at 9 AM UTC)

#### B. Frontend API URL Update:
Frontend में API base URL automatically Vercel deployment URL use करेगी। अगर custom domain है, तो update करें।

## ⚠️ Important Limitations & Solutions

### 1. Execution Time Limits

**Problem**: 
- Vercel Hobby: Max 10 seconds
- Vercel Pro: Max 60 seconds (default), 300 seconds (with config)
- Video generation 30-60+ seconds ले सकता है

**Solutions**:

#### Option A: Vercel Pro Plan (Recommended)
- Upgrade to Pro plan ($20/month)
- `maxDuration: 300` set करें (5 minutes)
- सबसे simple solution

#### Option B: Background Jobs (Free Alternative)
- Video generation को background में run करें
- Job status check करने के लिए polling use करें
- Current code में यही approach है

#### Option C: External Queue Service
- Upstash Redis या Vercel Queue use करें
- Jobs को queue में add करें
- Worker process handle करे

### 2. File Storage

**Problem**: Vercel serverless functions में local file storage temporary है।

**Current Solution**: 
- Temp files `/tmp` directory में create हो रहे हैं
- Video generation के बाद files cleanup हो जाती हैं

**Better Solution** (Production):
- Videos को Cloud Storage (AWS S3, Google Cloud Storage) में upload करें
- YouTube upload के बाद temp files delete करें

### 3. FFmpeg on Vercel

**Problem**: FFmpeg binary Vercel serverless functions में available नहीं है।

**Solutions**:

#### Option A: Use FFmpeg WASM
```bash
npm install @ffmpeg/ffmpeg @ffmpeg/util
```
- Browser में run होगा (client-side)
- Large file size issue हो सकता है

#### Option B: External Video Processing Service
- Cloudinary, AWS MediaConvert, या custom server use करें
- API call से video process करें

#### Option C: Keep Backend Separate (Recommended)
- Video generation के लिए separate server (Railway, Render, Fly.io) use करें
- Vercel frontend + API routes के लिए
- Video processing backend के लिए

### 4. Python Edge TTS

**Problem**: Python `edge-tts` command Vercel serverless functions में available नहीं है।

**Solution**: 
- Node.js `edge-tts-node` use करें (अगर available)
- या external TTS API use करें (ElevenLabs, Google TTS)
- या client-side TTS use करें

## 🔧 Recommended Architecture for Production

```
┌─────────────────┐
│  Vercel (Frontend) │
│  - React App      │
│  - API Routes     │
└────────┬──────────┘
         │
         ├─── API Calls ───┐
         │                  │
         ▼                  ▼
┌─────────────────┐  ┌─────────────────┐
│  Railway/Render  │  │  External APIs   │
│  (Backend)       │  │  - Gemini API    │
│  - Express Server│  │  - YouTube API   │
│  - FFmpeg        │  │  - TTS Services  │
│  - Video Gen     │  └─────────────────┘
└─────────────────┘
```

## 📝 Deployment Checklist

- [ ] Code Git में push किया
- [ ] Vercel project create किया
- [ ] Environment variables set किए
- [ ] Build settings configured
- [ ] API routes tested locally
- [ ] Frontend build successful
- [ ] Deployed to Vercel
- [ ] Cron jobs enabled
- [ ] Test workflow end-to-end
- [ ] Monitor logs और errors

## 🐛 Troubleshooting

### Build Fails:
```bash
# Local में test करें
cd frontend && npm install && npm run build
cd ../backend && npm install && npm run build
```

### API Routes Not Working:
- Check `api/` directory structure
- Verify `vercel.json` rewrites
- Check Vercel function logs

### Video Generation Timeout:
- Vercel Pro plan upgrade करें
- या background job approach use करें

### FFmpeg Not Found:
- External video processing service use करें
- या separate backend server deploy करें

## 📞 Support

Issues आने पर:
1. Vercel Dashboard → Project → Logs check करें
2. Function logs देखें
3. GitHub Issues में report करें

---

**Note**: Current setup में video generation Vercel serverless functions में limitations के कारण properly work नहीं कर सकता। Production के लिए separate backend server recommended है।
