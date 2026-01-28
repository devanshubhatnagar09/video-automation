# VideoAI - Automated Video Generation

AI-powered video automation that generates video ideas, creates Veo prompts, and uploads to YouTube. Can be deployed on Vercel for anyone to use!

## Features

- **AI Video Ideas**: Gemini AI generates creative, viral-worthy video concepts
- **Veo Prompts**: Auto-generates detailed prompts for Google Veo video generation
- **YouTube Upload**: Automatic upload with optimized metadata
- **Daily Cron**: Scheduled video generation (configurable)
- **Beautiful UI**: Interactive dashboard with real-time logs
- **Vercel Ready**: Deploy and let anyone use it!

## Quick Start (Local Development)

```bash
# Clone and install
cd video-automation
npm run install:all

# Configure environment
cp .env.example backend/.env
# Edit backend/.env with your API keys

# Start development
npm run dev
```

- Frontend: http://localhost:3000
- Backend: http://localhost:3001

## Deploy to Vercel

### Step 1: Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin YOUR_GITHUB_REPO_URL
git push -u origin main
```

### Step 2: Import to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click "Add New Project"
3. Import your GitHub repository

### Step 3: Configure Environment Variables

In Vercel Dashboard → Settings → Environment Variables, add:

| Variable | Description | Required |
|----------|-------------|----------|
| `GEMINI_API_KEY` | Google AI Studio API key | ✅ Yes |
| `YOUTUBE_CLIENT_ID` | YouTube OAuth Client ID | For YouTube |
| `YOUTUBE_CLIENT_SECRET` | YouTube OAuth Secret | For YouTube |
| `YOUTUBE_REDIRECT_URI` | `https://your-app.vercel.app/api/youtube/callback` | For YouTube |
| `GOOGLE_CLOUD_PROJECT` | GCP Project ID | For Veo |
| `VEO_OUTPUT_BUCKET` | GCS bucket (gs://bucket/videos/) | For Veo |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Service account JSON (single line) | For Veo |
| `CRON_SECRET` | Secret for cron endpoint | Optional |

### Step 4: Deploy!

Vercel will automatically deploy. Your app will be live at `https://your-app.vercel.app`

---

## Setting Up APIs

### Gemini API (Required)

1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Create an API key
3. Add to Vercel as `GEMINI_API_KEY`

### YouTube API (For Video Upload)

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create/select a project
3. Enable **YouTube Data API v3**
4. Go to **APIs & Services** → **Credentials**
5. Click **+ Create Credentials** → **OAuth client ID**
6. Select **Web application**
7. Add redirect URI: `https://your-app.vercel.app/api/youtube/callback`
8. Copy Client ID and Secret to Vercel env vars
9. Go to **OAuth consent screen** → Add test users

### Veo API (For Real Video Generation)

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Enable **Vertex AI API**
3. Create a **Cloud Storage bucket** for video output
4. Create a **Service Account**:
   - Go to **IAM & Admin** → **Service Accounts**
   - Click **+ Create Service Account**
   - Name: `videoai-veo`
   - Grant roles: `Vertex AI User`, `Storage Object Admin`
   - Click **Create Key** → **JSON**
   - Download the JSON file
5. Add to Vercel:
   - `GOOGLE_CLOUD_PROJECT`: Your project ID
   - `VEO_OUTPUT_BUCKET`: `gs://your-bucket/videos/`
   - `GOOGLE_SERVICE_ACCOUNT_JSON`: Paste entire JSON (minified to single line)

---

## Project Structure

```
video-automation/
├── frontend/              # React + Vite + Tailwind
│   ├── src/
│   │   ├── pages/         # Dashboard, Settings, Workflow, History
│   │   ├── store/         # Zustand state management
│   │   └── services/      # API client
├── backend/               # Express server (for local dev)
│   ├── src/
│   │   ├── routes/        # API routes
│   │   ├── services/      # Veo service
│   │   └── cron/          # Scheduler
├── api/                   # Vercel serverless functions
│   ├── gemini/
│   ├── youtube/
│   ├── workflow/
│   └── cron/
└── vercel.json           # Vercel config with cron
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/gemini/verify` | POST | Verify Gemini API key |
| `/api/youtube/auth-url` | GET | Get YouTube OAuth URL |
| `/api/workflow/start` | POST | Start video generation |
| `/api/workflow/status/:id` | GET | Get workflow status |
| `/api/cron/generate-video` | GET | Cron trigger (daily) |

## Tech Stack

- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS, Framer Motion
- **Backend**: Express.js, TypeScript
- **AI**: Google Gemini API, Google Veo (Vertex AI)
- **Upload**: YouTube Data API v3
- **Hosting**: Vercel (serverless)
- **Cron**: Vercel Cron Jobs

## License

MIT

---

## Troubleshooting

**Gemini 404 Error**: Model names change. Try `gemini-2.5-flash` or `gemini-2.0-flash`

**YouTube OAuth Error**: Make sure to add test users in OAuth consent screen

**Veo Not Working**: Requires Google Cloud project with billing enabled and Vertex AI API

**Cron Not Running**: Vercel cron is only available on Pro plan for custom schedules
