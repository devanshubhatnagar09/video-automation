import { Router, Request, Response } from 'express'
import { google } from 'googleapis'
import { Credentials } from 'google-auth-library'
import { authenticateToken, AuthRequest } from '../middleware/auth.js'
import connectDB from '../db/mongodb.js'
import { UserSettings } from '../models/UserSettings.js'
import { decrypt, encrypt } from '../utils/encryption.js'

export const youtubeRouter = Router()

// Get OAuth client from MongoDB (per user)
async function getOAuth2Client(userId: string) {
  await connectDB()
  const settings = await UserSettings.findOne({ userId })
  
  if (!settings || !settings.youtubeClientId || !settings.youtubeClientSecret || !settings.youtubeRedirectUri) {
    throw new Error('YouTube OAuth credentials not configured')
  }

  const clientId = decrypt(settings.youtubeClientId)
  const clientSecret = decrypt(settings.youtubeClientSecret)
  const redirectUri = decrypt(settings.youtubeRedirectUri)
  
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri)
}

// Get YouTube tokens from MongoDB
async function getYouTubeTokens(userId: string): Promise<Credentials | null> {
  await connectDB()
  const settings = await UserSettings.findOne({ userId })
  
  if (!settings || !settings.youtubeTokens) {
    return null
  }

  const tokens = settings.youtubeTokens
  return {
    access_token: tokens.access_token ? decrypt(tokens.access_token) : undefined,
    refresh_token: tokens.refresh_token ? decrypt(tokens.refresh_token) : undefined,
    expiry_date: tokens.expiry_date,
  }
}

// Save YouTube tokens to MongoDB (encrypted)
async function saveYouTubeTokens(userId: string, tokens: Credentials) {
  await connectDB()
  await UserSettings.findOneAndUpdate(
    { userId },
    {
      youtubeTokens: {
        access_token: tokens.access_token ? encrypt(tokens.access_token) : undefined,
        refresh_token: tokens.refresh_token ? encrypt(tokens.refresh_token) : undefined,
        expiry_date: tokens.expiry_date,
      },
    },
    { upsert: true, new: true }
  )
}

// Save YouTube OAuth credentials (encrypted)
youtubeRouter.post('/credentials', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    await connectDB()
    
    const { encryptedClientId, encryptedClientSecret, encryptedRedirectUri } = req.body

    if (!encryptedClientId || !encryptedClientSecret || !encryptedRedirectUri) {
      return res.status(400).json({ error: 'All YouTube credentials are required' })
    }

    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    // Validate decryption works
    try {
      decrypt(encryptedClientId)
      decrypt(encryptedClientSecret)
      decrypt(encryptedRedirectUri)
    } catch (error) {
      return res.status(400).json({ error: 'Invalid encrypted credentials format' })
    }

    // Save encrypted credentials
    await UserSettings.findOneAndUpdate(
      { userId: req.userId },
      {
        youtubeClientId: encryptedClientId,
        youtubeClientSecret: encryptedClientSecret,
        youtubeRedirectUri: encryptedRedirectUri,
      },
      { upsert: true, new: true }
    )

    res.json({ success: true, message: 'YouTube credentials saved' })
  } catch (error: unknown) {
    const err = error as { message?: string }
    console.error('Save credentials error:', err)
    res.status(500).json({ error: err.message || 'Failed to save credentials' })
  }
})

// Get YouTube auth URL
youtubeRouter.get('/auth-url', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const scopes = [
      'https://www.googleapis.com/auth/youtube.upload',
      'https://www.googleapis.com/auth/youtube',
      'https://www.googleapis.com/auth/youtube.readonly'
    ]

    const oauth2Client = await getOAuth2Client(req.userId)
    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent'
    })

    res.json({ url })
  } catch (error: unknown) {
    const err = error as { message?: string }
    console.error('Auth URL error:', err)
    res.status(400).json({ error: err.message || 'YouTube OAuth not configured' })
  }
})

// OAuth callback (GET - for browser redirect)
youtubeRouter.get('/callback', async (req: Request, res: Response) => {
  try {
    const { code, state } = req.query

    if (!code || typeof code !== 'string') {
      return res.status(400).send('Missing authorization code')
    }

    // State contains userId (should be encrypted in production)
    if (!state || typeof state !== 'string') {
      return res.status(400).send('Missing state parameter')
    }

    const userId = state // In production, decrypt this

    const oauth2Client = await getOAuth2Client(userId)
    const { tokens } = await oauth2Client.getToken(code)
    await saveYouTubeTokens(userId, tokens)

    // Get channel info
    oauth2Client.setCredentials(tokens)
    const youtube = google.youtube({ version: 'v3', auth: oauth2Client })
    const channelResponse = await youtube.channels.list({
      part: ['snippet'],
      mine: true
    })

    const channel = channelResponse.data.items?.[0]
    const channelName = channel?.snippet?.title || 'YouTube Channel'

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
youtubeRouter.post('/callback', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { code } = req.body

    if (!code) {
      return res.status(400).json({ success: false, error: 'Missing authorization code' })
    }

    if (!req.userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' })
    }

    const oauth2Client = await getOAuth2Client(req.userId)
    const { tokens } = await oauth2Client.getToken(code)
    await saveYouTubeTokens(req.userId, tokens)

    // Get channel info
    oauth2Client.setCredentials(tokens)
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
youtubeRouter.post('/disconnect', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    await connectDB()
    
    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    await UserSettings.findOneAndUpdate(
      { userId: req.userId },
      { $unset: { youtubeTokens: 1 } }
    )

    res.json({ success: true })
  } catch (error: unknown) {
    const err = error as { message?: string }
    console.error('Disconnect error:', err)
    res.status(500).json({ error: err.message || 'Failed to disconnect' })
  }
})

// Check connection status
youtubeRouter.get('/status', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    await connectDB()
    
    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const tokens = await getYouTubeTokens(req.userId)
    if (!tokens) {
      return res.json({ connected: false })
    }

    try {
      const oauth2Client = await getOAuth2Client(req.userId)
      oauth2Client.setCredentials(tokens)
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
      res.json({ connected: false })
    }
  } catch (error: unknown) {
    const err = error as { message?: string }
    console.error('Status check error:', err)
    res.json({ connected: false })
  }
})

// Upload video to YouTube
export async function uploadToYouTube(
  userId: string,
  videoPath: string,
  title: string,
  description: string,
  tags: string[]
): Promise<{ videoId: string; url: string }> {
  await connectDB()
  
  const tokens = await getYouTubeTokens(userId)
  if (!tokens) {
    throw new Error('YouTube not connected')
  }

  const oauth2Client = await getOAuth2Client(userId)
  oauth2Client.setCredentials(tokens)
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
