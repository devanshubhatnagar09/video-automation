import type { VercelRequest, VercelResponse } from '@vercel/node'
import { GoogleGenerativeAI } from '@google/generative-ai'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { apiKey } = req.body

    if (!apiKey) {
      return res.status(400).json({ valid: false, error: 'API key is required' })
    }

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

    const result = await model.generateContent('Say "API key verified" in 5 words or less')
    const response = await result.response
    const text = response.text()

    if (text) {
      res.json({ valid: true, message: 'API key verified successfully' })
    } else {
      res.json({ valid: false, error: 'Invalid response from API' })
    }
  } catch (error: unknown) {
    const err = error as { message?: string }
    console.error('Gemini verification error:', err)
    res.json({ valid: false, error: err.message || 'Failed to verify API key' })
  }
}
