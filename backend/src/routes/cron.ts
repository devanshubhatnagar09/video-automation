import { Router, Request, Response } from 'express'

export const cronRouter = Router()

// Store cron settings in memory (use DB in production)
let cronSettings = {
  enabled: false,
  time: '09:00',
  lastRun: null as string | null,
  nextRun: null as string | null
}

// Get cron status
cronRouter.get('/status', (_req: Request, res: Response) => {
  res.json(cronSettings)
})

// Update cron settings
cronRouter.post('/settings', (req: Request, res: Response) => {
  const { enabled, time } = req.body

  cronSettings = {
    ...cronSettings,
    enabled: enabled ?? cronSettings.enabled,
    time: time ?? cronSettings.time
  }

  // Calculate next run time
  if (cronSettings.enabled) {
    const [hours, minutes] = cronSettings.time.split(':').map(Number)
    const now = new Date()
    const nextRun = new Date()
    nextRun.setHours(hours, minutes, 0, 0)
    
    if (nextRun <= now) {
      nextRun.setDate(nextRun.getDate() + 1)
    }
    
    cronSettings.nextRun = nextRun.toISOString()
  } else {
    cronSettings.nextRun = null
  }

  res.json({ success: true, settings: cronSettings })
})

// Vercel cron endpoint
cronRouter.get('/generate-video', async (_req: Request, res: Response) => {
  // This endpoint is called by Vercel cron
  console.log('Cron job triggered at:', new Date().toISOString())

  cronSettings.lastRun = new Date().toISOString()

  // Calculate next run
  const [hours, minutes] = cronSettings.time.split(':').map(Number)
  const nextRun = new Date()
  nextRun.setDate(nextRun.getDate() + 1)
  nextRun.setHours(hours, minutes, 0, 0)
  cronSettings.nextRun = nextRun.toISOString()

  try {
    // Trigger the workflow
    const apiKey = process.env.GEMINI_API_KEY

    if (!apiKey) {
      return res.status(400).json({ error: 'No GEMINI_API_KEY configured' })
    }

    // Import and call the workflow trigger
    const response = await fetch(`${process.env.VERCEL_URL || 'http://localhost:3001'}/api/workflow/trigger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ geminiApiKey: apiKey })
    })

    const result = await response.json()
    
    res.json({ 
      success: true, 
      message: 'Cron job executed',
      timestamp: cronSettings.lastRun,
      result 
    })
  } catch (error: unknown) {
    const err = error as { message?: string }
    console.error('Cron job error:', err)
    res.status(500).json({ error: err.message || 'Cron job failed' })
  }
})
