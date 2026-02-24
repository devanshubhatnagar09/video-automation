# 🚀 Deployment Summary - Frontend (Vercel) + Backend (Render)

## Architecture

```
Frontend (Vercel)          Backend (Render)
     │                           │
     │  API Calls                │
     ├──────────────────────────>│
     │                           │
     │  ┌─────────────────┐     │
     │  │  React App      │     │  ┌──────────────┐
     │  │  Static Files    │     │  │ Express API │
     │  │  CDN            │     │  │ MongoDB     │
     │  └─────────────────┘     │  │ FFmpeg      │
     │                           │  │ Video Gen   │
     │                           │  └──────────────┘
```

## Quick Deploy Steps

### 1️⃣ Backend on Render (5 minutes)

1. **Render Dashboard** → **"New +"** → **"Web Service"**
2. **Connect GitHub** repo
3. **Settings**:
   - Root Directory: `backend`
   - Build: `npm install && npm run build`
   - Start: `npm start`
   - Instance: Free
4. **Environment Variables**:
   ```env
   PORT=10000
   MONGODB_URI=mongodb+srv://...
   GEMINI_API_KEY=...
   YOUTUBE_CLIENT_ID=...
   YOUTUBE_CLIENT_SECRET=...
   YOUTUBE_REDIRECT_URI=https://your-backend.onrender.com/api/youtube/callback
   BASE_URL=https://your-backend.onrender.com
   FRONTEND_URL=https://your-app.vercel.app  # Set after frontend deploy
   ```
5. **Deploy** → Get URL: `https://your-backend.onrender.com`

### 2️⃣ Frontend on Vercel (3 minutes)

1. **Vercel Dashboard** → **"Add New Project"**
2. **Connect GitHub** repo
3. **Settings**:
   - Root Directory: `frontend`
   - Framework: Vite (auto)
   - Build: Auto-detect
4. **Environment Variables**:
   ```env
   VITE_API_URL=https://your-backend.onrender.com
   ```
5. **Deploy** → Get URL: `https://your-app.vercel.app`

### 3️⃣ Connect Them

1. **Render**: Add `FRONTEND_URL=https://your-app.vercel.app`
2. **Google OAuth**: Update redirect URI to Render backend
3. **Test**: Workflow start करें

## Files Updated

✅ **Frontend**:
- `frontend/src/services/api.ts` - Render backend URL support
- `frontend/vercel.json` - Vercel config

✅ **Backend**:
- `backend/src/index.ts` - CORS updated for frontend
- `backend/src/routes/workflow.ts` - Query params support
- `backend/.env.example` - Environment variables

✅ **Config Files**:
- `vercel.json` - Frontend only (no API routes)
- `render.yaml` - Render deployment config
- `QUICK_DEPLOY.md` - Quick guide
- `RENDER_DEPLOYMENT.md` - Detailed Render guide
- `VERCEL_FRONTEND_DEPLOYMENT.md` - Detailed Vercel guide

## Environment Variables Checklist

### Render Backend:
- [ ] `PORT=10000`
- [ ] `MONGODB_URI=...`
- [ ] `GEMINI_API_KEY=...`
- [ ] `YOUTUBE_CLIENT_ID=...`
- [ ] `YOUTUBE_CLIENT_SECRET=...`
- [ ] `YOUTUBE_REDIRECT_URI=https://your-backend.onrender.com/api/youtube/callback`
- [ ] `BASE_URL=https://your-backend.onrender.com`
- [ ] `FRONTEND_URL=https://your-app.vercel.app` (after frontend deploy)

### Vercel Frontend:
- [ ] `VITE_API_URL=https://your-backend.onrender.com`

## Testing

```bash
# Backend health
curl https://your-backend.onrender.com/api/health

# Frontend
open https://your-app.vercel.app

# Test workflow
# Frontend से workflow start करें
```

## Cost

- **Vercel**: Free (frontend)
- **Render**: Free (backend sleeps after 15 min)
- **MongoDB Atlas**: Free (512MB)

**Total: $0/month** (free tier)

## Next Steps

1. ✅ Deploy backend on Render
2. ✅ Deploy frontend on Vercel  
3. ✅ Connect them
4. ✅ Test workflow
5. ✅ Monitor logs

**Ready to deploy!** 🎉
