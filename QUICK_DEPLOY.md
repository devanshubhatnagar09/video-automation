# Quick Deployment Guide

## Frontend (Vercel) + Backend (Render)

### Step 1: Backend Deploy on Render

1. **Render Dashboard** → **"New +"** → **"Web Service"**
2. **Connect GitHub** repo
3. **Settings**:
   - **Name**: `video-automation-backend`
   - **Root Directory**: `backend`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Instance**: Free

4. **Environment Variables** (Render Dashboard):
```env
PORT=10000
NODE_ENV=production
MONGODB_URI=mongodb+srv://...
GEMINI_API_KEY=...
YOUTUBE_CLIENT_ID=...
YOUTUBE_CLIENT_SECRET=...
YOUTUBE_REDIRECT_URI=https://your-backend.onrender.com/api/youtube/callback
BASE_URL=https://your-backend.onrender.com
FRONTEND_URL=https://your-app.vercel.app  # Set after frontend deploy
```

5. **Deploy** → Wait for URL: `https://your-backend.onrender.com`

### Step 2: Frontend Deploy on Vercel

1. **Vercel Dashboard** → **"Add New Project"**
2. **Connect GitHub** repo
3. **Settings**:
   - **Root Directory**: `frontend`
   - **Framework**: Vite (auto-detect)
   - **Build Command**: `npm install && npm run build` (auto)
   - **Output Directory**: `dist` (auto)

4. **Environment Variables** (Vercel Dashboard):
```env
VITE_API_URL=https://your-backend.onrender.com
```

5. **Deploy** → Wait for URL: `https://your-app.vercel.app`

### Step 3: Connect Them

1. **Render**: Add `FRONTEND_URL=https://your-app.vercel.app`
2. **Google OAuth**: Update redirect URI to Render backend
3. **Test**: Frontend से workflow start करें

## Files Created

- ✅ `RENDER_DEPLOYMENT.md` - Detailed Render guide
- ✅ `VERCEL_FRONTEND_DEPLOYMENT.md` - Detailed Vercel guide
- ✅ `DEPLOYMENT_ARCHITECTURE.md` - Architecture overview
- ✅ `render.yaml` - Render config
- ✅ `frontend/vercel.json` - Vercel config
- ✅ `frontend/src/services/api.ts` - Updated API URL
- ✅ `backend/src/index.ts` - Updated CORS

## Quick Test

```bash
# Backend health
curl https://your-backend.onrender.com/api/health

# Frontend
open https://your-app.vercel.app
```

**Ready to deploy!** 🚀
