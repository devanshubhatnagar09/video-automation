import type { VercelRequest, VercelResponse } from '@vercel/node'
import { google } from 'googleapis'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { code } = req.query

    if (!code || typeof code !== 'string') {
      return res.status(400).send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Error</title>
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
              h1 { color: #ef4444; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>❌ Error</h1>
              <p>Missing authorization code</p>
            </div>
          </body>
        </html>
      `)
    }

    const clientId = process.env.YOUTUBE_CLIENT_ID
    const clientSecret = process.env.YOUTUBE_CLIENT_SECRET
    const redirectUri = process.env.YOUTUBE_REDIRECT_URI || `${process.env.VERCEL_URL || 'https://video-automation-ten.vercel.app'}/api/youtube/callback`

    if (!clientId || !clientSecret) {
      return res.status(400).send('YouTube OAuth not configured')
    }

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri)
    const { tokens } = await oauth2Client.getToken(code)
    oauth2Client.setCredentials(tokens)

    // Get channel info
    const youtube = google.youtube({ version: 'v3', auth: oauth2Client })
    const channelResponse = await youtube.channels.list({
      part: ['snippet'],
      mine: true
    })

    const channel = channelResponse.data.items?.[0]
    const channelName = channel?.snippet?.title || 'YouTube Channel'

    // Send success message
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
          <p>Authentication failed: ${err.message || 'Unknown error'}. You can close this window.</p>
        </body>
      </html>
    `)
  }
}
