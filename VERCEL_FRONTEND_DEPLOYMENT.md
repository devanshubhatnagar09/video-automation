# Vercel Frontend Deployment Guide

## Frontend को Vercel पर Deploy करें (Backend Render पर)

### Step 1: GitHub Repository Setup

Code already GitHub में होना चाहिए:
```bash
git add .
git commit -m "Prepare frontend for Vercel"
git push origin main
```

### Step 2: Vercel Project Create करें

1. https://vercel.com पर login करें
2. **"Add New Project"** → GitHub repo select करें
3. **Configure Project**:
   - **Framework Preset**: Vite
   - **Root Directory**: `frontend` (important!)
   - **Build Command**: `npm install && npm run build` (auto-detected)
   - **Output Directory**: `dist` (auto-detected)
   - **Install Command**: `npm install` (auto-detected)

### Step 3: Environment Variables

Vercel Dashboard → **Settings** → **Environment Variables**:

#### Required:
```env
# Backend API URL (Render backend)
VITE_API_URL=https://your-backend.onrender.com

# Or use default (will be set in code)
```

**Note**: Frontend में API URL hardcode नहीं है, environment variable use करें।

### Step 4: Update Frontend API Configuration

Frontend automatically Render backend use करेगा अगर `VITE_API_URL` set है।

### Step 5: Deploy!

1. **"Deploy"** click करें
2. Vercel automatically build करेगा
3. Deploy complete होने पर URL मिलेगा: `https://your-app.vercel.app`

### Step 6: Update Backend CORS

Render backend में CORS update करें frontend URL के लिए:

1. Render Dashboard → **Environment Variables**
2. Add:
   ```env
   FRONTEND_URL=https://your-app.vercel.app
   ```

3. Backend code में CORS update (already done if using environment variable)

## Vercel Configuration

### vercel.json (Frontend Only):

Create `frontend/vercel.json`:
```json
{
  "version": 2,
  "buildCommand": "npm install && npm run build",
  "outputDirectory": "dist",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

**Note**: Root `vercel.json` delete करें या ignore करें (backend के लिए था)

## Frontend API Configuration

Frontend automatically detect करेगा:
- **Development**: `http://localhost:3001` (local backend)
- **Production**: `VITE_API_URL` environment variable या Render backend URL

## Testing

1. **Frontend**: https://your-app.vercel.app
2. **Backend Health**: https://your-backend.onrender.com/api/health
3. **Workflow**: Frontend से workflow start करें

## Important Notes

### Vercel Free Tier:
- ✅ **Unlimited** deployments
- ✅ **Fast** CDN
- ✅ **Automatic** HTTPS
- ✅ **No** sleep (always on)

### API Routes:
- Frontend में कोई API routes नहीं हैं
- सभी API calls Render backend को जाएंगी
- Vercel serverless functions की जरूरत नहीं

### Environment Variables:
- `VITE_` prefix वाले variables frontend में accessible हैं
- Build time में inject होते हैं
- Runtime में change नहीं हो सकते

## Troubleshooting

### Build Fails:
```bash
# Check:
- Root directory correct (frontend)
- Build command correct
- Dependencies in package.json
```

### API Calls Fail:
```bash
# Check:
- VITE_API_URL set correctly
- Backend CORS allows frontend URL
- Backend is running (not sleeping)
```

### CORS Errors:
- Backend में `FRONTEND_URL` environment variable add करें
- CORS middleware में frontend URL allow करें

## Next Steps

1. ✅ Frontend deployed on Vercel
2. ✅ Backend deployed on Render
3. 🔄 Test complete workflow
4. 🔄 Monitor logs और performance

**Frontend ready!** 🎉
