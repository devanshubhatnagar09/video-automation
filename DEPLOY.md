# 🚀 Deployment Guide - Frontend (Vercel) + Backend (Render)

## Architecture

```
Frontend (Vercel)          Backend (Render)
     │                           │
     │  API Calls                │
     ├──────────────────────────>│
     │                           │
     │  ┌─────────────────┐     │  ┌──────────────┐
     │  │  React App      │     │  │ Express API │
     │  │  Static Files   │     │  │ MongoDB     │
     │  │  CDN            │     │  │ FFmpeg      │
     │  └─────────────────┘     │  │ Video Gen   │
     │                           │  └──────────────┘
```

---

## Step 1: Backend Deploy on Render (5 minutes)

### 1.1 Render Account Setup
1. https://render.com पर sign up करें
2. GitHub account से connect करें

### 1.2 Create Web Service
1. **Render Dashboard** → **"New +"** → **"Web Service"**
2. **Connect repository**: GitHub repo select करें
3. **Service Settings**:
   - **Name**: `video-automation-backend`
   - **Root Directory**: `backend` ⚠️ Important!
   - **Runtime**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Instance Type**: `Free`

### 1.3 Environment Variables
Render Dashboard → **Environment** tab में add करें:

```env
# Server
PORT=10000
NODE_ENV=production

# MongoDB Atlas (Required)
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/video-automation?retryWrites=true&w=majority

# Gemini API (Required)
GEMINI_API_KEY=your-gemini-api-key

# YouTube OAuth
YOUTUBE_CLIENT_ID=your-client-id
YOUTUBE_CLIENT_SECRET=your-client-secret
YOUTUBE_REDIRECT_URI=https://your-backend.onrender.com/api/youtube/callback

# URLs
BASE_URL=https://your-backend.onrender.com
FRONTEND_URL=https://your-app.vercel.app  # Set after frontend deploy
```

### 1.4 Deploy
1. **"Create Web Service"** click करें
2. Wait for deployment (2-3 minutes)
3. Get URL: `https://your-backend.onrender.com`

### 1.5 Test Backend
```bash
curl https://your-backend.onrender.com/api/health
```

Expected response:
```json
{"status":"ok","timestamp":"..."}
```

---

## Step 2: Frontend Deploy on Vercel (3 minutes)

### 2.1 Vercel Project Setup
1. https://vercel.com पर login करें
2. **"Add New Project"** → GitHub repo select करें
3. **Configure Project**:
   - **Root Directory**: `frontend` ⚠️ Important!
   - **Framework Preset**: Vite (auto-detect)
   - **Build Command**: Auto-detect
   - **Output Directory**: `dist` (auto-detect)

### 2.2 Environment Variables
Vercel Dashboard → **Settings** → **Environment Variables**:

```env
VITE_API_URL=https://your-backend.onrender.com
```

### 2.3 Deploy
1. **"Deploy"** click करें
2. Wait for deployment (1-2 minutes)
3. Get URL: `https://your-app.vercel.app`

---

## Step 3: Connect Frontend & Backend

### 3.1 Update Backend CORS
Render Dashboard → **Environment Variables** → Add:
```env
FRONTEND_URL=https://your-app.vercel.app
```

### 3.2 Update Google OAuth
1. Google Cloud Console → APIs & Services → Credentials
2. OAuth 2.0 Client → Edit
3. **Authorized redirect URIs** में add करें:
   ```
   https://your-backend.onrender.com/api/youtube/callback
   ```

### 3.3 Redeploy Backend
Render Dashboard → **Manual Deploy** → **Deploy latest commit**

---

## Step 4: Test Everything

1. **Frontend**: https://your-app.vercel.app
2. **Backend Health**: https://your-backend.onrender.com/api/health
3. **Workflow Test**: Frontend से workflow start करें

---

## Environment Variables Checklist

### ✅ Render Backend:
- [ ] `PORT=10000`
- [ ] `MONGODB_URI=mongodb+srv://...`
- [ ] `GEMINI_API_KEY=...`
- [ ] `YOUTUBE_CLIENT_ID=...`
- [ ] `YOUTUBE_CLIENT_SECRET=...`
- [ ] `YOUTUBE_REDIRECT_URI=https://your-backend.onrender.com/api/youtube/callback`
- [ ] `BASE_URL=https://your-backend.onrender.com`
- [ ] `FRONTEND_URL=https://your-app.vercel.app`

### ✅ Vercel Frontend:
- [ ] `VITE_API_URL=https://your-backend.onrender.com`

---

## Important Notes

### Render Free Tier:
- ⚠️ **Sleeps after 15 minutes** of inactivity
- ⚠️ **Cold start** takes 30-60 seconds
- ✅ **512MB RAM** - sufficient for most apps

### Keep Backend Awake (Optional):
Render Dashboard → **New +** → **"Cron Job"**:
- **Schedule**: `*/14 * * * *` (every 14 minutes)
- **Command**: `curl https://your-backend.onrender.com/api/health`

### MongoDB Atlas Setup:
1. https://www.mongodb.com/cloud/atlas
2. Create free cluster (M0)
3. Create database user
4. Network Access → Allow `0.0.0.0/0`
5. Get connection string

---

## Troubleshooting

### Build Fails:
- Check Root Directory (`backend` for Render, `frontend` for Vercel)
- Check build commands
- Check TypeScript errors in logs

### Backend Not Starting:
- Check `PORT` environment variable
- Check `npm start` command
- Check logs in Render Dashboard

### Frontend Can't Reach Backend:
- Check `VITE_API_URL` in Vercel
- Check `FRONTEND_URL` in Render
- Check CORS configuration
- Check backend is running (not sleeping)

### CORS Errors:
- Verify `FRONTEND_URL` set in Render
- Check backend CORS middleware
- Verify frontend URL matches exactly

---

## Cost

- **Vercel**: Free (frontend)
- **Render**: Free (backend sleeps after 15 min)
- **MongoDB Atlas**: Free (512MB)

**Total: $0/month** (free tier)

---

## Files Structure

```
video-automation/
├── frontend/          # Vercel deployment
│   ├── src/
│   ├── vercel.json
│   └── package.json
├── backend/           # Render deployment
│   ├── src/
│   ├── .env.example
│   └── package.json
├── vercel.json        # Frontend config (root)
└── render.yaml        # Render config
```

---

## Quick Commands

```bash
# Test backend locally
cd backend
npm install
npm run dev

# Test frontend locally
cd frontend
npm install
npm run dev

# Deploy (automatic via Git push)
git add .
git commit -m "Deploy"
git push origin main
```

---

**Ready to deploy!** 🎉

Follow steps 1 → 2 → 3 → 4 और आपका app live हो जाएगा!
