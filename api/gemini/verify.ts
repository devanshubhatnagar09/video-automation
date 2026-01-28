import type { VercelRequest, VercelResponse } from '@vercel/node'
import { GoogleGenerativeAI } from '@google/generative-ai'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT')
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ valid: false, error: 'Method not allowed' })
  }

  try {
    const { apiKey } = req.body

    if (!apiKey || typeof apiKey !== 'string') {
      return res.status(400).json({ valid: false, error: 'API key is required' })
    }

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

    const result = await model.generateContent('Say "API key verified" in 5 words or less')
    const response = await result.response
    const text = response.text()

    if (text && text.trim().length > 0) {
      return res.status(200).json({ valid: true, message: 'API key verified successfully' })
    } else {
      return res.status(200).json({ valid: false, error: 'Invalid response from API' })
    }
  } catch (error: unknown) {
    const err = error as { message?: string; code?: number }
    console.error('Gemini verification error:', {
      message: err.message,
      code: err.code,
      stack: err instanceof Error ? err.stack : undefined
    })
    
    return res.status(200).json({ 
      valid: false, 
      error: err.message || 'Failed to verify API key',
      details: process.env.NODE_ENV === 'development' ? String(err) : undefined
    })
  }
}
