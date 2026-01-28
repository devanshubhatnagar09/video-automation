import type { VercelRequest, VercelResponse } from '@vercel/node'

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.json({
    status: 'ok',
    message: 'VideoAI API is running',
    timestamp: new Date().toISOString(),
    endpoints: [
      'POST /api/gemini/verify',
      'POST /api/gemini/generate-idea',
      'GET /api/youtube/auth-url',
      'POST /api/workflow/start',
      'GET /api/workflow/status/:jobId',
      'POST /api/cron/generate-video'
    ]
  })
}
