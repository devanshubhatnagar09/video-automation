import type { VercelRequest, VercelResponse } from '@vercel/node'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { v4 as uuidv4 } from 'uuid'

// In-memory storage (for demo - use Redis/DB in production)
const jobs = new Map<string, any>()

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { geminiApiKey } = req.body

  if (!geminiApiKey) {
    return res.status(400).json({ error: 'Gemini API key is required' })
  }

  const jobId = uuidv4()
  
  // Start workflow and return immediately
  jobs.set(jobId, { 
    status: 'running', 
    step: 'idea', 
    message: 'Starting workflow...',
    logs: [],
    createdAt: new Date().toISOString()
  })

  // Run workflow in background (note: Vercel has 10s limit for hobby, 60s for pro)
  runWorkflow(jobId, geminiApiKey).catch(err => {
    console.error('Workflow error:', err)
    const job = jobs.get(jobId)
    if (job) {
      job.status = 'error'
      job.error = err.message
    }
  })

  res.json({ jobId, message: 'Workflow started' })
}

async function runWorkflow(jobId: string, apiKey: string) {
  const job = jobs.get(jobId)!
  
  try {
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

    // Step 1: Generate Idea
    job.step = 'idea'
    job.message = 'Generating video idea...'
    job.logs.push({ type: 'step', step: 'idea', message: 'Starting idea generation', timestamp: new Date().toISOString() })

    const ideaPrompt = `You are a viral content strategist. Generate a unique video idea.
Return JSON only: {"title": "...", "hook": "...", "concept": "...", "storyArc": "...", "visualStyle": "...", "targetEmotion": "...", "tags": ["..."]}`

    job.logs.push({ type: 'input', step: 'idea', message: 'Prompt sent to Gemini', data: { prompt: ideaPrompt }, timestamp: new Date().toISOString() })

    const ideaResult = await model.generateContent(ideaPrompt)
    const ideaText = ideaResult.response.text()
    
    job.logs.push({ type: 'output', step: 'idea', message: 'Response received', data: { response: ideaText }, timestamp: new Date().toISOString() })

    const ideaMatch = ideaText.match(/\{[\s\S]*\}/)
    if (!ideaMatch) throw new Error('Failed to parse idea')
    const idea = JSON.parse(ideaMatch[0])

    job.data = { idea }
    job.logs.push({ type: 'info', step: 'idea', message: `Idea generated: ${idea.title}`, timestamp: new Date().toISOString() })

    // Step 2: Generate Prompt
    job.step = 'prompt'
    job.message = 'Creating video prompt...'

    const promptPrompt = `Create a Veo video prompt for: ${idea.title}. Concept: ${idea.concept}. Style: ${idea.visualStyle}.
Return JSON only: {"prompt": "detailed 150-300 word prompt", "duration": "30", "aspectRatio": "9:16", "style": "cinematic"}`

    job.logs.push({ type: 'input', step: 'prompt', message: 'Prompt sent to Gemini', data: { prompt: promptPrompt }, timestamp: new Date().toISOString() })

    const promptResult = await model.generateContent(promptPrompt)
    const promptText = promptResult.response.text()

    job.logs.push({ type: 'output', step: 'prompt', message: 'Response received', data: { response: promptText }, timestamp: new Date().toISOString() })

    const promptMatch = promptText.match(/\{[\s\S]*\}/)
    if (!promptMatch) throw new Error('Failed to parse prompt')
    const videoPrompt = JSON.parse(promptMatch[0])

    job.data.videoPrompt = videoPrompt
    job.logs.push({ type: 'info', step: 'prompt', message: 'Video prompt created', timestamp: new Date().toISOString() })

    // Step 3: Video Generation (simulated or real based on config)
    job.step = 'video'
    job.message = 'Generating video...'
    
    const hasVeoConfig = process.env.GOOGLE_CLOUD_PROJECT && process.env.VEO_OUTPUT_BUCKET
    
    if (hasVeoConfig) {
      job.logs.push({ type: 'info', step: 'video', message: 'Veo configured - would generate real video', data: { veoPrompt: videoPrompt.prompt }, timestamp: new Date().toISOString() })
      // Real Veo integration would go here
    } else {
      job.logs.push({ type: 'info', step: 'video', message: '⚠️ Veo not configured - simulating', timestamp: new Date().toISOString() })
    }

    await new Promise(r => setTimeout(r, 2000))
    job.data.videoUrl = `https://storage.googleapis.com/simulated-${Date.now()}.mp4`

    // Step 4: YouTube Upload (simulated)
    job.step = 'upload'
    job.message = 'Uploading to YouTube...'
    job.logs.push({ type: 'info', step: 'upload', message: '⚠️ YouTube upload simulated', timestamp: new Date().toISOString() })

    await new Promise(r => setTimeout(r, 1000))
    job.data.youtubeUrl = `https://youtube.com/watch?v=SIM-${Date.now()}`

    // Complete
    job.status = 'completed'
    job.message = 'Workflow completed!'
    job.logs.push({ type: 'info', step: 'complete', message: '🎉 Workflow completed', data: job.data, timestamp: new Date().toISOString() })

  } catch (error: unknown) {
    const err = error as { message?: string }
    job.status = 'error'
    job.error = err.message
    job.logs.push({ type: 'error', step: job.step, message: err.message || 'Unknown error', timestamp: new Date().toISOString() })
  }
}

// Export jobs map for status endpoint
export { jobs }
