import { Router, Request, Response } from 'express'
import { google } from 'googleapis'
import dotenv from 'dotenv'

// Load env vars
dotenv.config()

export const youtubeRouter = Router()

import { Credentials } from 'google-auth-library'

// Store tokens in memory (in production, use a database)
let youtubeTokens: Credentials | null = null

// Lazy initialization of OAuth client
let _oauth2Client: InstanceType<typeof google.auth.OAuth2> | null = null

function getOAuth2Client() {
  if (!_oauth2Client) {
    const clientId = process.env.YOUTUBE_CLIENT_ID
    const clientSecret = process.env.YOUTUBE_CLIENT_SECRET
    const redirectUri = process.env.YOUTUBE_REDIRECT_URI || 'http://localhost:3001/api/youtube/callback'
    
    console.log('YouTube OAuth Config:', { 
      clientId: clientId ? clientId.substring(0, 20) + '...' : 'NOT SET',
      redirectUri 
    })
    
    _oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri)
  }
  return _oauth2Client
}

// Get YouTube auth URL
youtubeRouter.get('/auth-url', (_req: Request, res: Response) => {
  const scopes = [
    'https://www.googleapis.com/auth/youtube.upload',
    'https://www.googleapis.com/auth/youtube',
    'https://www.googleapis.com/auth/youtube.readonly'
  ]

  const oauth2Client = getOAuth2Client()
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent'
  })

  res.json({ url })
})

// OAuth callback
youtubeRouter.get('/callback', async (req: Request, res: Response) => {
  try {
    const { code } = req.query

    if (!code || typeof code !== 'string') {
      return res.status(400).send('Missing authorization code')
    }

    const oauth2Client = getOAuth2Client()
    const { tokens } = await oauth2Client.getToken(code)
    oauth2Client.setCredentials(tokens)
    youtubeTokens = tokens

    // Get channel info
    const youtube = google.youtube({ version: 'v3', auth: oauth2Client })
    const channelResponse = await youtube.channels.list({
      part: ['snippet'],
      mine: true
    })

    const channel = channelResponse.data.items?.[0]
    const channelName = channel?.snippet?.title || 'YouTube Channel'

    // Send success message to opener window
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>YouTube Connected</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%);
              color: white;
            }
            .container {
              text-align: center;
              padding: 40px;
              background: rgba(255,255,255,0.05);
              border-radius: 20px;
              border: 1px solid rgba(255,255,255,0.1);
            }
            h1 { color: #10b981; margin-bottom: 10px; }
            p { color: #9ca3af; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>✓ Connected!</h1>
            <p>YouTube account "${channelName}" connected successfully.</p>
            <p>You can close this window.</p>
          </div>
          <script>
            if (window.opener) {
              window.opener.postMessage({
                type: 'youtube-auth-success',
                channel: '${channelName}'
              }, '*');
              setTimeout(() => window.close(), 2000);
            }
          </script>
        </body>
      </html>
    `)
  } catch (error: unknown) {
    const err = error as { message?: string }
    console.error('YouTube callback error:', err)
    res.send(`
      <!DOCTYPE html>
      <html>
        <head><title>Error</title></head>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({
                type: 'youtube-auth-error',
                error: '${err.message || 'Authentication failed'}'
              }, '*');
            }
          </script>
          <p>Authentication failed. You can close this window.</p>
        </body>
      </html>
    `)
  }
})

// POST callback for code exchange
youtubeRouter.post('/callback', async (req: Request, res: Response) => {
  try {
    const { code } = req.body

    if (!code) {
      return res.status(400).json({ success: false, error: 'Missing authorization code' })
    }

    const oauth2Client = getOAuth2Client()
    const { tokens } = await oauth2Client.getToken(code)
    oauth2Client.setCredentials(tokens)
    youtubeTokens = tokens

    // Get channel info
    const youtube = google.youtube({ version: 'v3', auth: oauth2Client })
    const channelResponse = await youtube.channels.list({
      part: ['snippet'],
      mine: true
    })

    const channel = channelResponse.data.items?.[0]
    const channelName = channel?.snippet?.title || 'YouTube Channel'

    res.json({ success: true, channel: channelName })
  } catch (error: unknown) {
    const err = error as { message?: string }
    console.error('YouTube callback error:', err)
    res.status(500).json({ success: false, error: err.message })
  }
})

// Disconnect YouTube
youtubeRouter.post('/disconnect', (_req: Request, res: Response) => {
  youtubeTokens = null
  res.json({ success: true })
})

// Check connection status
youtubeRouter.get('/status', async (_req: Request, res: Response) => {
  if (!youtubeTokens) {
    return res.json({ connected: false })
  }

  try {
    const oauth2Client = getOAuth2Client()
    oauth2Client.setCredentials(youtubeTokens)
    const youtube = google.youtube({ version: 'v3', auth: oauth2Client })
    
    const channelResponse = await youtube.channels.list({
      part: ['snippet'],
      mine: true
    })

    const channel = channelResponse.data.items?.[0]
    
    res.json({
      connected: true,
      channel: channel?.snippet?.title || 'YouTube Channel'
    })
  } catch {
    youtubeTokens = null
    res.json({ connected: false })
  }
})

// Upload video to YouTube
export async function uploadToYouTube(
  videoPath: string,
  title: string,
  description: string,
  tags: string[]
): Promise<{ videoId: string; url: string }> {
  if (!youtubeTokens) {
    throw new Error('YouTube not connected')
  }

  const oauth2Client = getOAuth2Client()
  oauth2Client.setCredentials(youtubeTokens)
  const youtube = google.youtube({ version: 'v3', auth: oauth2Client })

  const fs = await import('fs')
  
  const response = await youtube.videos.insert({
    part: ['snippet', 'status'],
    requestBody: {
      snippet: {
        title,
        description,
        tags,
        categoryId: '22' // People & Blogs
      },
      status: {
        privacyStatus: 'public',
        selfDeclaredMadeForKids: false
      }
    },
    media: {
      body: fs.createReadStream(videoPath)
    }
  })

  const videoId = response.data.id!
  return {
    videoId,
    url: `https://www.youtube.com/watch?v=${videoId}`
  }
}
