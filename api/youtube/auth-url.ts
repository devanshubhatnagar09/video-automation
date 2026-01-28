import type { VercelRequest, VercelResponse } from '@vercel/node'
import { google } from 'googleapis'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const clientId = process.env.YOUTUBE_CLIENT_ID
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET
  const redirectUri = process.env.YOUTUBE_REDIRECT_URI || `${process.env.VERCEL_URL}/api/youtube/callback`

  if (!clientId || !clientSecret) {
    return res.status(400).json({ error: 'YouTube OAuth not configured' })
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri)

  const scopes = [
    'https://www.googleapis.com/auth/youtube.upload',
    'https://www.googleapis.com/auth/youtube',
    'https://www.googleapis.com/auth/youtube.readonly'
  ]

  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent'
  })

  res.json({ url })
}
