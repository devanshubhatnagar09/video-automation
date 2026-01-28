import type { VercelRequest, VercelResponse } from '@vercel/node'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { v4 as uuidv4 } from 'uuid'
import { setJob, updateJob, getJob } from './jobs.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { geminiApiKey } = req.body

  if (!geminiApiKey) {
    return res.status(400).json({ error: 'Gemini API key is required' })
  }

  const jobId = uuidv4()
  
  // Start workflow and return immediately
  setJob(jobId, { 
    status: 'running', 
    step: 'idea', 
    message: 'Starting workflow...',
    logs: [],
    createdAt: new Date().toISOString()
  })

  // Run workflow in background (note: Vercel has 10s limit for hobby, 60s for pro)
  runWorkflow(jobId, geminiApiKey).catch(err => {
    console.error('Workflow error:', err)
    updateJob(jobId, {
      status: 'error',
      error: err instanceof Error ? err.message : 'Unknown error'
    })
  })

  res.json({ jobId, message: 'Workflow started' })
}

function addLog(jobId: string, log: { type: string; step: string; message: string; data?: unknown; timestamp: string }) {
  const job = getJob(jobId)
  if (job) {
    updateJob(jobId, {
      logs: [...job.logs, log]
    })
  }
}

async function runWorkflow(jobId: string, apiKey: string) {
  try {
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

    // Step 1: Generate Idea
    updateJob(jobId, {
      step: 'idea',
      message: 'Generating video idea...'
    })
    addLog(jobId, { type: 'step', step: 'idea', message: 'Starting idea generation', timestamp: new Date().toISOString() })

    const ideaPrompt = `You are a viral content strategist. Generate a unique video idea.
Return JSON only: {"title": "...", "hook": "...", "concept": "...", "storyArc": "...", "visualStyle": "...", "targetEmotion": "...", "tags": ["..."]}`

    addLog(jobId, { type: 'input', step: 'idea', message: 'Prompt sent to Gemini', data: { prompt: ideaPrompt }, timestamp: new Date().toISOString() })

    const ideaResult = await model.generateContent(ideaPrompt)
    const ideaText = ideaResult.response.text()
    
    addLog(jobId, { type: 'output', step: 'idea', message: 'Response received', data: { response: ideaText }, timestamp: new Date().toISOString() })

    const ideaMatch = ideaText.match(/\{[\s\S]*\}/)
    if (!ideaMatch) throw new Error('Failed to parse idea')
    const idea = JSON.parse(ideaMatch[0])

    const currentJob = getJob(jobId)!
    updateJob(jobId, {
      data: { idea }
    })
    addLog(jobId, { type: 'info', step: 'idea', message: `Idea generated: ${idea.title}`, timestamp: new Date().toISOString() })

    // Step 2: Generate Prompt
    updateJob(jobId, {
      step: 'prompt',
      message: 'Creating video prompt...'
    })

    const promptPrompt = `Create a Veo video prompt for: ${idea.title}. Concept: ${idea.concept}. Style: ${idea.visualStyle}.
Return JSON only: {"prompt": "detailed 150-300 word prompt", "duration": "30", "aspectRatio": "9:16", "style": "cinematic"}`

    addLog(jobId, { type: 'input', step: 'prompt', message: 'Prompt sent to Gemini', data: { prompt: promptPrompt }, timestamp: new Date().toISOString() })

    const promptResult = await model.generateContent(promptPrompt)
    const promptText = promptResult.response.text()

    addLog(jobId, { type: 'output', step: 'prompt', message: 'Response received', data: { response: promptText }, timestamp: new Date().toISOString() })

    const promptMatch = promptText.match(/\{[\s\S]*\}/)
    if (!promptMatch) throw new Error('Failed to parse prompt')
    const videoPrompt = JSON.parse(promptMatch[0])

    const job2 = getJob(jobId)!
    updateJob(jobId, {
      data: { ...job2.data, videoPrompt }
    })
    addLog(jobId, { type: 'info', step: 'prompt', message: 'Video prompt created', timestamp: new Date().toISOString() })

    // Step 3: Video Generation (simulated or real based on config)
    updateJob(jobId, {
      step: 'video',
      message: 'Generating video...'
    })
    
    const hasVeoConfig = process.env.GOOGLE_CLOUD_PROJECT && process.env.VEO_OUTPUT_BUCKET
    
    if (hasVeoConfig) {
      addLog(jobId, { type: 'info', step: 'video', message: 'Veo configured - would generate real video', data: { veoPrompt: videoPrompt.prompt }, timestamp: new Date().toISOString() })
    } else {
      addLog(jobId, { type: 'info', step: 'video', message: '⚠️ Veo not configured - simulating', timestamp: new Date().toISOString() })
    }

    await new Promise(r => setTimeout(r, 2000))
    
    const job3 = getJob(jobId)!
    updateJob(jobId, {
      data: { ...job3.data, videoUrl: `https://storage.googleapis.com/simulated-${Date.now()}.mp4` }
    })

    // Step 4: YouTube Upload (simulated)
    updateJob(jobId, {
      step: 'upload',
      message: 'Uploading to YouTube...'
    })
    
    addLog(jobId, { type: 'info', step: 'upload', message: '⚠️ YouTube upload simulated', timestamp: new Date().toISOString() })

    await new Promise(r => setTimeout(r, 1000))
    
    const job4 = getJob(jobId)!
    updateJob(jobId, {
      data: { ...job4.data, youtubeUrl: `https://youtube.com/watch?v=SIM-${Date.now()}` }
    })

    // Complete
    updateJob(jobId, {
      status: 'completed',
      message: 'Workflow completed!'
    })
    
    const job5 = getJob(jobId)!
    addLog(jobId, { type: 'info', step: 'complete', message: '🎉 Workflow completed', data: job5.data, timestamp: new Date().toISOString() })

  } catch (error: unknown) {
    const err = error as { message?: string }
    const currentJob = getJob(jobId)
    if (currentJob) {
      addLog(jobId, { type: 'error', step: currentJob.step, message: err.message || 'Unknown error', timestamp: new Date().toISOString() })
      updateJob(jobId, {
        status: 'error',
        error: err.message || 'Unknown error'
      })
    }
  }
}
