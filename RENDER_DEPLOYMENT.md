# Render Backend Deployment Guide

## Backend को Render पर Deploy करें

### Step 1: GitHub Repository Setup

1. Code को GitHub में push करें:
```bash
git add .
git commit -m "Prepare for Render deployment"
git push origin main
```

### Step 2: Render Account बनाएं

1. https://render.com पर sign up करें
2. GitHub account से connect करें
3. Free tier available है

### Step 3: Backend Service Create करें

1. **Render Dashboard** → **"New +"** → **"Web Service"**
2. **Connect your repository**:
   - GitHub repo select करें
   - Branch: `main`
3. **Service Settings**:
   - **Name**: `video-automation-backend`
   - **Region**: Choose closest (e.g., `Mumbai` or `Singapore`)
   - **Branch**: `main`
   - **Root Directory**: `backend` (important!)
   - **Runtime**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Instance Type**: `Free` (512MB RAM)

### Step 4: Environment Variables Add करें

Render Dashboard → **Environment** tab में add करें:

#### Required Variables:
```env
# Server
PORT=10000
NODE_ENV=production

# MongoDB (Atlas)
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/video-automation?retryWrites=true&w=majority

# Gemini API
GEMINI_API_KEY=your-gemini-api-key

# YouTube OAuth
YOUTUBE_CLIENT_ID=your-client-id
YOUTUBE_CLIENT_SECRET=your-client-secret
YOUTUBE_REDIRECT_URI=https://your-backend.onrender.com/api/youtube/callback

# Base URL (Render URL)
BASE_URL=https://your-backend.onrender.com
```

#### Optional Variables:
```env
# Google Cloud / Veo (if using)
GOOGLE_CLOUD_PROJECT=your-project-id
GOOGLE_CLOUD_LOCATION=global
VEO_OUTPUT_BUCKET=gs://your-bucket/videos/
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}

# Cron Secret (optional)
CRON_SECRET=your-random-secret
```

### Step 5: Build Settings

Render automatically detect करेगा, लेकिन verify करें:

- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm start`
- **Root Directory**: `backend`

### Step 6: Deploy!

1. **"Create Web Service"** click करें
2. Render automatically build और deploy करेगा
3. **Logs** tab में progress देखें
4. Deploy complete होने पर URL मिलेगा: `https://your-backend.onrender.com`

### Step 7: Health Check

Deploy के बाद test करें:
```bash
curl https://your-backend.onrender.com/api/health
```

Response:
```json
{
  "status": "ok",
  "message": "Backend is running"
}
```

## Important Notes

### Free Tier Limitations:
- ⚠️ **Sleeps after 15 minutes** of inactivity
- ⚠️ **Cold start** takes 30-60 seconds
- ✅ **512MB RAM** - sufficient for most apps
- ✅ **Unlimited** build minutes

### Keep Service Awake:
1. **Render Cron Job** add करें (free):
   - **New +** → **"Cron Job"**
   - **Schedule**: `*/14 * * * *` (every 14 minutes)
   - **Command**: `curl https://your-backend.onrender.com/api/health`

2. **Or upgrade** to Starter plan ($7/month) - no sleep

### MongoDB Connection:
- Use **MongoDB Atlas** (free tier)
- Connection string Render environment variables में add करें
- IP whitelist में Render IPs add करें (or allow all: `0.0.0.0/0`)

### CORS Setup:
Backend में CORS already configured है frontend URL के लिए। Frontend deploy के बाद update करें।

## Troubleshooting

### Build Fails:
```bash
# Check logs in Render Dashboard
# Common issues:
- Missing dependencies in package.json
- TypeScript errors
- Build command incorrect
```

### Service Won't Start:
```bash
# Check:
- PORT environment variable set
- Start command correct
- Dependencies installed
```

### MongoDB Connection Error:
```bash
# Verify:
- MONGODB_URI correct
- MongoDB Atlas IP whitelist includes Render IPs
- Network access enabled
```

### Cold Start Slow:
- Normal for free tier
- First request takes 30-60 seconds
- Subsequent requests are fast

## Next Steps

1. ✅ Backend deployed on Render
2. 🔄 Frontend deploy on Vercel (see VERCEL_FRONTEND_DEPLOYMENT.md)
3. 🔄 Update frontend API URL to Render backend
4. 🔄 Test end-to-end workflow

**Backend ready!** 🎉
