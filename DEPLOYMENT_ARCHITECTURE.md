# Deployment Architecture

## Frontend (Vercel) + Backend (Render)

```
┌─────────────────────┐
│   Frontend (Vercel) │
│   - React App       │
│   - Static Files    │
│   - CDN             │
└──────────┬──────────┘
           │
           │ API Calls
           │
           ▼
┌─────────────────────┐
│  Backend (Render)   │
│  - Express Server   │
│  - MongoDB Atlas    │
│  - FFmpeg           │
│  - Video Generation │
└─────────────────────┘
```

## Architecture Benefits

### ✅ Vercel Frontend:
- **Fast CDN** - Global edge network
- **Always On** - No sleep, instant response
- **Free Tier** - Unlimited deployments
- **Automatic HTTPS** - SSL certificates
- **Easy Deploy** - Git push = deploy

### ✅ Render Backend:
- **Full Control** - Express server, FFmpeg, etc.
- **No Time Limits** - Unlike Vercel serverless
- **MongoDB Support** - Direct connection
- **File System** - Can write temporary files
- **Background Jobs** - Long-running processes

## Setup Steps

### 1. Backend Deploy (Render)
See: `RENDER_DEPLOYMENT.md`

### 2. Frontend Deploy (Vercel)
See: `VERCEL_FRONTEND_DEPLOYMENT.md`

### 3. Connect Them
- Frontend API URL → Render backend
- Backend CORS → Frontend URL

## Environment Variables

### Render Backend:
```env
PORT=10000
NODE_ENV=production
MONGODB_URI=mongodb+srv://...
GEMINI_API_KEY=...
YOUTUBE_CLIENT_ID=...
YOUTUBE_CLIENT_SECRET=...
YOUTUBE_REDIRECT_URI=https://your-backend.onrender.com/api/youtube/callback
BASE_URL=https://your-backend.onrender.com
FRONTEND_URL=https://your-app.vercel.app
```

### Vercel Frontend:
```env
VITE_API_URL=https://your-backend.onrender.com
```

## API Endpoints

All API calls go to Render backend:
- `POST /api/workflow/start`
- `GET /api/workflow/status?jobId=xxx`
- `GET /api/workflow/logs?jobId=xxx`
- `POST /api/workflow/settings`
- `POST /api/gemini/verify`
- `GET /api/youtube/auth-url`
- `POST /api/youtube/callback`

## Cost

### Free Tier:
- **Vercel**: Free forever (frontend)
- **Render**: Free (backend sleeps after 15 min)
- **MongoDB Atlas**: Free (512MB)

### Paid (Optional):
- **Render Starter**: $7/month (no sleep)
- **MongoDB Atlas**: Free tier sufficient

## Monitoring

### Vercel:
- Dashboard → Logs
- Real-time deployment status
- Analytics available

### Render:
- Dashboard → Logs
- Metrics and uptime
- Auto-restart on crash

## Troubleshooting

### Frontend Can't Reach Backend:
1. Check `VITE_API_URL` in Vercel
2. Check backend is running (not sleeping)
3. Check CORS configuration
4. Check network/firewall

### Backend Sleeps:
1. Add Render cron job (ping every 14 min)
2. Or upgrade to Starter plan
3. Or use external ping service

### CORS Errors:
1. Set `FRONTEND_URL` in Render
2. Verify CORS middleware allows frontend URL
3. Check preflight requests

## Next Steps

1. ✅ Deploy backend on Render
2. ✅ Deploy frontend on Vercel
3. ✅ Connect them
4. ✅ Test workflow
5. ✅ Monitor and optimize

**Ready to deploy!** 🚀
