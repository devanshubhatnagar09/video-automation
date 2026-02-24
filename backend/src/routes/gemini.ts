import { Router, Request, Response } from 'express'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { decrypt } from '../utils/encryption.js'
import { authenticateToken, AuthRequest } from '../middleware/auth.js'
import connectDB from '../db/mongodb.js'
import { UserSettings } from '../models/UserSettings.js'

export const geminiRouter = Router()

// Verify Gemini API key (decrypts encrypted key from frontend)
geminiRouter.post('/verify', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    await connectDB()
    
    const { encryptedApiKey } = req.body

    if (!encryptedApiKey) {
      return res.status(400).json({ valid: false, error: 'API key is required' })
    }

    // Decrypt the API key
    let apiKey: string
    try {
      apiKey = decrypt(encryptedApiKey)
    } catch (error) {
      return res.status(400).json({ valid: false, error: 'Invalid encrypted API key format' })
    }

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

    // Test the API key with a simple request
    const result = await model.generateContent('Say "API key verified" in 5 words or less')
    const response = await result.response
    const text = response.text()

    if (text) {
      // Save encrypted API key to MongoDB
      if (req.userId) {
        await UserSettings.findOneAndUpdate(
          { userId: req.userId },
          { geminiApiKey: encryptedApiKey },
          { upsert: true, new: true }
        )
      }

      res.json({ valid: true, message: 'API key verified successfully' })
    } else {
      res.json({ valid: false, error: 'Invalid response from API' })
    }
  } catch (error: unknown) {
    const err = error as { message?: string }
    console.error('Gemini verification error:', err)
    res.json({ valid: false, error: err.message || 'Failed to verify API key' })
  }
})

// Generate video idea (uses stored API key from MongoDB)
geminiRouter.post('/generate-idea', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    await connectDB()
    
    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    // Get encrypted API key from MongoDB
    const settings = await UserSettings.findOne({ userId: req.userId })
    if (!settings || !settings.geminiApiKey) {
      return res.status(400).json({ error: 'Gemini API key not configured. Please verify your API key first.' })
    }

    // Decrypt API key
    const apiKey = decrypt(settings.geminiApiKey)
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

    const prompt = `You are a viral content strategist and creative director. Generate a unique, attention-grabbing video idea that could go viral on YouTube Shorts, TikTok, or Instagram Reels.

Requirements:
- Must hook viewers in the first 2-3 seconds
- Should tell a micro-story or present an interesting concept
- Suitable for 15-60 second video
- Visually interesting and achievable with AI video generation
- Emotionally engaging (funny, surprising, heartwarming, or thought-provoking)

Provide your response in this exact JSON format:
{
  "title": "Catchy, SEO-friendly video title",
  "hook": "The attention-grabbing opening (first 3 seconds)",
  "concept": "Brief description of the video concept",
  "storyArc": "Beginning, middle, end summary",
  "visualStyle": "Cinematic style description",
  "targetEmotion": "Primary emotion to evoke",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"]
}

Be creative and original. Think of something that hasn't been done a million times.`

    const result = await model.generateContent(prompt)
    const response = await result.response
    const text = response.text()

    // Parse the JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const idea = JSON.parse(jsonMatch[0])
      res.json({ success: true, idea })
    } else {
      res.json({ success: false, error: 'Failed to parse idea', rawResponse: text })
    }
  } catch (error: unknown) {
    const err = error as { message?: string }
    console.error('Idea generation error:', err)
    res.status(500).json({ error: err.message || 'Failed to generate idea' })
  }
})

// Generate video prompt from idea (uses stored API key from MongoDB)
geminiRouter.post('/generate-prompt', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    await connectDB()
    
    const { idea } = req.body

    if (!idea) {
      return res.status(400).json({ error: 'Idea is required' })
    }

    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    // Get encrypted API key from MongoDB
    const settings = await UserSettings.findOne({ userId: req.userId })
    if (!settings || !settings.geminiApiKey) {
      return res.status(400).json({ error: 'Gemini API key not configured. Please verify your API key first.' })
    }

    // Decrypt API key
    const apiKey = decrypt(settings.geminiApiKey)
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

    const prompt = `You are an expert at creating prompts for AI video generation (specifically Google Veo). Based on the following video idea, create a detailed, technical prompt that will generate a high-quality video.

Video Idea:
Title: ${idea.title}
Concept: ${idea.concept}
Hook: ${idea.hook}
Story Arc: ${idea.storyArc}
Visual Style: ${idea.visualStyle}
Target Emotion: ${idea.targetEmotion}

Create a Veo-optimized video generation prompt that includes:
1. Scene description with specific visual details
2. Camera movement and angles
3. Lighting and atmosphere
4. Subject details and actions
5. Pacing and timing cues
6. Style references

Provide your response in this exact JSON format:
{
  "prompt": "The complete video generation prompt (detailed, 150-300 words)",
  "duration": "Suggested duration in seconds (15-60)",
  "aspectRatio": "9:16 for vertical or 16:9 for horizontal",
  "style": "Primary visual style keyword",
  "music": "Suggested music mood/genre"
}

Make the prompt specific and detailed enough for Veo to generate a compelling video.`

    const result = await model.generateContent(prompt)
    const response = await result.response
    const text = response.text()

    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const videoPrompt = JSON.parse(jsonMatch[0])
      res.json({ success: true, videoPrompt })
    } else {
      res.json({ success: false, error: 'Failed to parse prompt', rawResponse: text })
    }
  } catch (error: unknown) {
    const err = error as { message?: string }
    console.error('Prompt generation error:', err)
    res.status(500).json({ error: err.message || 'Failed to generate prompt' })
  }
})
