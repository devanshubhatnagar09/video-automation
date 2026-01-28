import type { VercelRequest, VercelResponse } from '@vercel/node'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { v4 as uuidv4 } from 'uuid'
import { setJob, updateJob, getJob } from './jobs.js'
import { Job } from '../models/Job.js'
import connectDB from '../db/mongodb.js'

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
  
  try {
    // Start workflow and return immediately
    await setJob(jobId, { 
      status: 'running', 
      step: 'idea', 
      message: 'Starting workflow...',
      logs: [],
      createdAt: new Date().toISOString()
    })
    
    console.log(`[Start] Created job ${jobId}`)

    // Run workflow in background (note: Vercel has 10s limit for hobby, 60s for pro)
    // Don't await - let it run async so we can return immediately
    runWorkflow(jobId, geminiApiKey).catch(async (err) => {
      console.error('[Start] Workflow error:', err)
      try {
        await updateJob(jobId, {
          status: 'error',
          error: err instanceof Error ? err.message : 'Unknown error'
        })
        await addLog(jobId, { 
          type: 'error', 
          step: 'init', 
          message: `Workflow failed: ${err instanceof Error ? err.message : 'Unknown error'}`, 
          timestamp: new Date().toISOString() 
        })
      } catch (updateErr) {
        console.error('[Start] Failed to update job on error:', updateErr)
      }
    })

    res.json({ jobId, message: 'Workflow started' })
  } catch (error) {
    console.error('[Start] Error:', error)
    res.status(500).json({
      error: 'Failed to start workflow',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

async function addLog(jobId: string, log: { type: string; step: string; message: string; data?: unknown; timestamp: string }) {
  try {
    await connectDB()
    const job = await Job.findOne({ jobId })
    if (job) {
      const updatedLogs = [...job.logs, log]
      await Job.findOneAndUpdate(
        { jobId },
        { $set: { logs: updatedLogs } },
        { new: true }
      )
      console.log(`[addLog] Added log to job ${jobId}: ${log.type} - ${log.message}`)
    } else {
      console.warn(`[addLog] Job ${jobId} not found`)
    }
  } catch (error) {
    console.error('[addLog] Error:', error)
  }
}

async function runWorkflow(jobId: string, apiKey: string) {
  console.log(`[runWorkflow] Starting workflow for job ${jobId}`)
  
  try {
    // Verify job exists
    const initialJob = await getJob(jobId)
    if (!initialJob) {
      throw new Error(`Job ${jobId} not found in database`)
    }
    
    console.log(`[runWorkflow] Job found, initializing Gemini AI`)
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

    // Step 1: Generate Idea
    console.log(`[runWorkflow] Step 1: Generating idea`)
    await updateJob(jobId, {
      step: 'idea',
      message: 'Generating video idea...'
    })
    await addLog(jobId, { type: 'step', step: 'idea', message: 'Starting idea generation', timestamp: new Date().toISOString() })

    const ideaPrompt = `You are a viral content strategist. Generate a unique video idea.
Return JSON only: {"title": "...", "hook": "...", "concept": "...", "storyArc": "...", "visualStyle": "...", "targetEmotion": "...", "tags": ["..."]}`

    await addLog(jobId, { type: 'input', step: 'idea', message: 'Prompt sent to Gemini', data: { prompt: ideaPrompt }, timestamp: new Date().toISOString() })

    console.log(`[runWorkflow] Calling Gemini API for idea generation`)
    const ideaResult = await model.generateContent(ideaPrompt)
    const ideaText = ideaResult.response.text()
    console.log(`[runWorkflow] Gemini response received, length: ${ideaText.length}`)
    
    await addLog(jobId, { type: 'output', step: 'idea', message: 'Response received', data: { response: ideaText }, timestamp: new Date().toISOString() })

    const ideaMatch = ideaText.match(/\{[\s\S]*\}/)
    if (!ideaMatch) throw new Error('Failed to parse idea')
    const idea = JSON.parse(ideaMatch[0])

    const currentJob = await getJob(jobId)
    if (!currentJob) throw new Error('Job not found')
    
    await updateJob(jobId, {
      data: { idea }
    })
    await addLog(jobId, { type: 'info', step: 'idea', message: `Idea generated: ${idea.title}`, timestamp: new Date().toISOString() })

    // Step 2: Generate Prompt
    await updateJob(jobId, {
      step: 'prompt',
      message: 'Creating video prompt...'
    })

    const promptPrompt = `Create a Veo video prompt for: ${idea.title}. Concept: ${idea.concept}. Style: ${idea.visualStyle}.
Return JSON only: {"prompt": "detailed 150-300 word prompt", "duration": "30", "aspectRatio": "9:16", "style": "cinematic"}`

    await addLog(jobId, { type: 'input', step: 'prompt', message: 'Prompt sent to Gemini', data: { prompt: promptPrompt }, timestamp: new Date().toISOString() })

    const promptResult = await model.generateContent(promptPrompt)
    const promptText = promptResult.response.text()

    await addLog(jobId, { type: 'output', step: 'prompt', message: 'Response received', data: { response: promptText }, timestamp: new Date().toISOString() })

    const promptMatch = promptText.match(/\{[\s\S]*\}/)
    if (!promptMatch) throw new Error('Failed to parse prompt')
    const videoPrompt = JSON.parse(promptMatch[0])

    const job2 = await getJob(jobId)
    if (!job2) throw new Error('Job not found')
    
    await updateJob(jobId, {
      data: { ...job2.data, videoPrompt }
    })
    await addLog(jobId, { type: 'info', step: 'prompt', message: 'Video prompt created', timestamp: new Date().toISOString() })

    // Step 3: Video Generation (simulated or real based on config)
    await updateJob(jobId, {
      step: 'video',
      message: 'Generating video...'
    })
    
    const hasVeoConfig = process.env.GOOGLE_CLOUD_PROJECT && process.env.VEO_OUTPUT_BUCKET
    
    if (hasVeoConfig) {
      await addLog(jobId, { type: 'info', step: 'video', message: 'Veo configured - would generate real video', data: { veoPrompt: videoPrompt.prompt }, timestamp: new Date().toISOString() })
    } else {
      await addLog(jobId, { type: 'info', step: 'video', message: '⚠️ Veo not configured - simulating', timestamp: new Date().toISOString() })
    }

    await new Promise(r => setTimeout(r, 2000))
    
    const job3 = await getJob(jobId)
    if (!job3) throw new Error('Job not found')
    
    await updateJob(jobId, {
      data: { ...job3.data, videoUrl: `https://storage.googleapis.com/simulated-${Date.now()}.mp4` }
    })

    // Step 4: YouTube Upload (simulated)
    await updateJob(jobId, {
      step: 'upload',
      message: 'Uploading to YouTube...'
    })
    
    await addLog(jobId, { type: 'info', step: 'upload', message: '⚠️ YouTube upload simulated', timestamp: new Date().toISOString() })

    await new Promise(r => setTimeout(r, 1000))
    
    const job4 = await getJob(jobId)
    if (!job4) throw new Error('Job not found')
    
    await updateJob(jobId, {
      data: { ...job4.data, youtubeUrl: `https://youtube.com/watch?v=SIM-${Date.now()}` }
    })

    // Complete
    await updateJob(jobId, {
      status: 'completed',
      message: 'Workflow completed!'
    })
    
    const job5 = await getJob(jobId)
    if (!job5) throw new Error('Job not found')
    
    await addLog(jobId, { type: 'info', step: 'complete', message: '🎉 Workflow completed', data: job5.data, timestamp: new Date().toISOString() })

  } catch (error: unknown) {
    const err = error as { message?: string }
    console.error(`[runWorkflow] Error in workflow ${jobId}:`, err)
    
    try {
      const currentJob = await getJob(jobId)
      const errorStep = currentJob?.step || 'unknown'
      const errorMessage = err.message || 'Unknown error'
      
      await addLog(jobId, { 
        type: 'error', 
        step: errorStep, 
        message: `Workflow failed: ${errorMessage}`, 
        timestamp: new Date().toISOString() 
      })
      
      await updateJob(jobId, {
        status: 'error',
        error: errorMessage
      })
      
      console.log(`[runWorkflow] Error logged for job ${jobId}`)
    } catch (logError) {
      console.error(`[runWorkflow] Failed to log error for job ${jobId}:`, logError)
    }
  }
}
