import type { VercelRequest, VercelResponse } from '@vercel/node'
import { GoogleGenerativeAI } from '@google/generative-ai'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Verify this is called by Vercel Cron (optional security)
  const authHeader = req.headers['authorization']
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    // Allow for testing, but log warning
    console.warn('Cron endpoint called without proper authorization')
  }

  console.log('🕐 Cron job triggered at:', new Date().toISOString())

  const apiKey = process.env.GEMINI_API_KEY

  if (!apiKey) {
    return res.status(400).json({ error: 'GEMINI_API_KEY not configured' })
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

    // Generate idea
    const ideaResult = await model.generateContent(`Generate a viral video idea. Return JSON: {"title": "...", "concept": "...", "tags": ["..."]}`)
    const ideaText = ideaResult.response.text()
    const ideaMatch = ideaText.match(/\{[\s\S]*\}/)
    
    if (!ideaMatch) {
      throw new Error('Failed to generate idea')
    }

    const idea = JSON.parse(ideaMatch[0])

    // Generate prompt
    const promptResult = await model.generateContent(`Create a Veo video prompt for: ${idea.title}. Return JSON: {"prompt": "detailed prompt", "duration": "30"}`)
    const promptText = promptResult.response.text()
    const promptMatch = promptText.match(/\{[\s\S]*\}/)

    if (!promptMatch) {
      throw new Error('Failed to generate prompt')
    }

    const videoPrompt = JSON.parse(promptMatch[0])

    // Log the generated content
    console.log('✅ Cron generated:', { idea, videoPrompt })

    // Here you would:
    // 1. Call Veo API to generate video (if configured)
    // 2. Upload to YouTube (if connected)
    // 3. Store in database

    res.json({
      success: true,
      message: 'Cron job executed successfully',
      timestamp: new Date().toISOString(),
      generated: {
        idea,
        videoPrompt,
        note: 'Video generation and YouTube upload depend on configuration'
      }
    })
  } catch (error: unknown) {
    const err = error as { message?: string }
    console.error('Cron job error:', err)
    res.status(500).json({ 
      error: err.message || 'Cron job failed',
      timestamp: new Date().toISOString()
    })
  }
}
