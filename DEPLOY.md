# 🚀 Vercel Deployment Guide (Hindi)

## Quick Start (5 Steps)

### 1. Git में Code Push करें
```bash
git init
git add .
git commit -m "Ready for Vercel deployment"
git remote add origin <your-github-repo-url>
git push -u origin main
```

### 2. Vercel में Project Create करें
1. [vercel.com](https://vercel.com) पर login करें
2. **"Add New Project"** click करें
3. GitHub repository select करें
4. **"Import"** click करें

### 3. Build Settings (Auto-detect होगा)
Vercel automatically detect करेगा:
- **Framework**: Vite
- **Build Command**: `cd frontend && npm run build`
- **Output Directory**: `frontend/dist`

### 4. Environment Variables (Optional)
अगर cron job में Gemini API key use करना है:
- Vercel Dashboard → Settings → Environment Variables
- Add: `GEMINI_API_KEY=your-key-here`

**Note**: Frontend में API key user input से आ रहा है, इसलिए server-side env var optional है।

### 5. Deploy!
**"Deploy"** button click करें - बस! 🎉

---

## ⚠️ Important Notes

### Video Generation Limitations

**Problem**: Vercel serverless functions में execution time limit है:
- **Hobby Plan**: 10 seconds max
- **Pro Plan**: 60 seconds (default), 300 seconds (configured)

**Current Setup**: 
- `vercel.json` में `maxDuration: 300` set है
- **Vercel Pro Plan ($20/month) चाहिए** proper video generation के लिए

### Solutions:

#### Option 1: Vercel Pro Plan (Recommended)
- Upgrade to Pro plan
- 5 minutes execution time
- सबसे simple solution

#### Option 2: Separate Backend Server
Video generation के लिए separate server use करें:
- **Railway.app** (free tier available)
- **Render.com** (free tier available)
- **Fly.io** (free tier available)

Backend को separate deploy करें और frontend से API calls करें।

#### Option 3: Background Jobs
- Video generation को background में run करें
- Job status polling करें
- Current code में यही approach है

### FFmpeg Issue

**Problem**: FFmpeg binary Vercel serverless functions में available नहीं है।

**Solutions**:
1. **External Video Processing**: Cloudinary, AWS MediaConvert
2. **Separate Backend**: Railway/Render पर backend deploy करें
3. **FFmpeg WASM**: Client-side processing (large bundle size)

---

## 📁 Project Structure

```
video-automation/
├── frontend/          # React + Vite app
│   ├── src/
│   └── dist/         # Build output (Vercel serves this)
├── backend/          # Express server (local dev के लिए)
├── api/              # Vercel serverless functions
│   ├── workflow/
│   ├── gemini/
│   ├── youtube/
│   └── cron/
├── vercel.json       # Vercel configuration
└── package.json      # Root package.json
```

---

## 🔧 Vercel Configuration

`vercel.json` file already configured है:

```json
{
  "version": 2,
  "buildCommand": "cd frontend && npm install && npm run build",
  "outputDirectory": "frontend/dist",
  "installCommand": "cd backend && npm install && cd ../frontend && npm install",
  "functions": {
    "api/**/*.ts": {
      "runtime": "@vercel/node@3.0.0",
      "maxDuration": 300  // 5 minutes (Pro plan required)
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
      "schedule": "0 9 * * *"  // Daily at 9 AM UTC
    }
  ]
}
```

---

## ✅ Post-Deployment Checklist

- [ ] Deploy successful
- [ ] Frontend load हो रहा है
- [ ] API routes working (`/api/health` check करें)
- [ ] Gemini API key verify करें
- [ ] YouTube OAuth test करें
- [ ] Video generation test करें (Pro plan के साथ)
- [ ] Cron job verify करें (Vercel Dashboard → Cron Jobs)

---

## 🐛 Troubleshooting

### Build Fails
```bash
# Local में test करें
cd frontend && npm install && npm run build
```

### API Routes 404
- Check `api/` directory structure
- Verify `vercel.json` rewrites
- Check Vercel function logs

### Video Generation Timeout
- Vercel Pro plan upgrade करें
- या separate backend server use करें

### FFmpeg Error
- External video processing service use करें
- या separate backend deploy करें

---

## 📞 Support

- Vercel Logs: Dashboard → Project → Logs
- Function Logs: Dashboard → Project → Functions → [Function Name]
- GitHub Issues: Report करें

---

## 💡 Recommended Architecture

Production के लिए:

```
Frontend (Vercel)
    ↓ API Calls
Backend (Railway/Render) ← Video Generation + FFmpeg
    ↓ External APIs
Gemini API, YouTube API, TTS Services
```

इससे:
- ✅ Vercel free plan use कर सकते हैं
- ✅ FFmpeg properly work करेगा
- ✅ Longer execution times possible
- ✅ Better scalability

---

**Happy Deploying! 🚀**
