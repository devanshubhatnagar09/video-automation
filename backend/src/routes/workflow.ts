import { Router, Request, Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { generateShortsVideo, VideoOptions, cleanupAllJobFiles } from '../services/shorts-video-generator.js'
import { uploadToYouTube } from './youtube.js'

export const workflowRouter = Router()

// Store settings for video generation
let videoSettings: VideoOptions = {
  voice: 'Jenny',
  language: 'english'
}

// Endpoint to update settings
workflowRouter.post('/settings', (req: Request, res: Response) => {
  const { voice, language } = req.body
  if (voice) videoSettings.voice = voice
  if (language) videoSettings.language = language
  console.log('📝 Video settings updated:', videoSettings)
  res.json({ success: true, settings: videoSettings })
})

// Get current settings
workflowRouter.get('/settings', (_req: Request, res: Response) => {
  res.json({ settings: videoSettings })
})

// Types
interface LogEntry {
  timestamp: string
  type: 'input' | 'output' | 'info' | 'error' | 'step'
  step: string
  message: string
  data?: unknown
}

interface JobStatus {
  status: 'running' | 'completed' | 'error'
  step: string
  message?: string
  data?: Record<string, unknown>
  error?: string
  logs: LogEntry[]
}

// Store job status and logs in memory
const jobs = new Map<string, JobStatus>()

// Helper to add log
function addLog(jobId: string, log: Omit<LogEntry, 'timestamp'>) {
  const job = jobs.get(jobId)
  if (job) {
    const entry: LogEntry = {
      ...log,
      timestamp: new Date().toISOString()
    }
    job.logs.push(entry)
    console.log(`[${jobId.slice(0, 8)}] [${log.type.toUpperCase()}] [${log.step}] ${log.message}`)
    if (log.data) {
      console.log(JSON.stringify(log.data, null, 2))
    }
  }
}

// Start workflow (POST version)
workflowRouter.post('/start', async (req: Request, res: Response) => {
  const { geminiApiKey } = req.body

  if (!geminiApiKey) {
    return res.status(400).json({ error: 'Gemini API key is required' })
  }

  const jobId = uuidv4()
  jobs.set(jobId, { 
    status: 'running', 
    step: 'idea', 
    message: 'Starting workflow...', 
    logs: [] 
  })

  addLog(jobId, { type: 'info', step: 'init', message: 'Workflow started' })

  // Run workflow in background
  runWorkflow(jobId, geminiApiKey)

  res.json({ jobId })
})

// Get workflow status
workflowRouter.get('/status/:jobId', (req: Request, res: Response) => {
  const { jobId } = req.params
  const job = jobs.get(jobId)

  if (!job) {
    return res.status(404).json({ error: 'Job not found' })
  }

  res.json({ success: true, ...job })
})

// Get logs for a job
workflowRouter.get('/logs/:jobId', (req: Request, res: Response) => {
  const { jobId } = req.params
  const job = jobs.get(jobId)

  if (!job) {
    return res.status(404).json({ error: 'Job not found' })
  }

  res.json({ logs: job.logs })
})

// Get all recent logs
workflowRouter.get('/logs', (_req: Request, res: Response) => {
  const allLogs: Array<LogEntry & { jobId: string }> = []
  
  jobs.forEach((job, jobId) => {
    job.logs.forEach(log => {
      allLogs.push({ ...log, jobId })
    })
  })

  // Sort by timestamp, most recent first
  allLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  res.json({ logs: allLogs.slice(0, 100) }) // Last 100 logs
})

// Background workflow runner - YouTube Shorts style
async function runWorkflow(jobId: string, apiKey: string) {
  const job = jobs.get(jobId)!
  
  try {
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

    // ============ STEP 1: Generate Video Content ============
    job.step = 'idea'
    job.message = 'Generating video content...'
    addLog(jobId, { type: 'step', step: 'idea', message: '🎯 Step 1: Generating YouTube Shorts content' })

    // Choose prompt based on language setting
    const contentPrompt = videoSettings.language === 'hindi' 
      ? `Tum ek viral YouTube Shorts content creator ho. Ek short vertical video (15-30 seconds) ke liye content generate karo HINDI mein.

Kuch aisa banao jo attention grab kare:
- Ek interesting fact
- Koi mind-blowing revelation
- Funny observation
- Inspiring quote
- Useful life hack
- Surprising statistic

Apna response is EXACT JSON format mein do (no markdown, sirf JSON):
{
  "title": "YouTube ke liye catchy video title (max 60 chars, Hindi mein)",
  "hook": "Attention grabbing opening line (1 sentence, Hindi mein)",
  "script": "Voiceover narration script (30-50 words, punchy aur engaging, HINDI mein Devanagari script mein likho)",
  "imagePrompt": "Background image ka description in English (visual jo content se match kare, dramatic)",
  "tags": ["#Shorts", "#Hindi", "tag3", "tag4", "tag5"],
  "category": "Education/Entertainment/Motivation/Facts/Comedy"
}`
      : `You are a viral YouTube Shorts content creator. Generate content for a short vertical video (15-30 seconds) in ENGLISH.

Create something that will grab attention - it could be:
- A fascinating fact
- A mind-blowing revelation  
- A funny observation
- An inspiring quote
- A useful life hack
- A surprising statistic

Provide your response in this EXACT JSON format (no markdown, just JSON):
{
  "title": "Catchy video title for YouTube (max 60 chars)",
  "hook": "Opening hook that grabs attention (1 sentence)",
  "script": "The voiceover narration script (30-50 words, punchy and engaging, in English)",
  "imagePrompt": "Description of the background image (visual that matches the content, dramatic and eye-catching)",
  "tags": ["#Shorts", "tag2", "tag3", "tag4", "tag5"],
  "category": "Education/Entertainment/Motivation/Facts/Comedy"
}`

    addLog(jobId, { 
      type: 'input', 
      step: 'idea', 
      message: '📤 Asking Gemini for Shorts content',
      data: { prompt: contentPrompt }
    })

    const contentResult = await model.generateContent(contentPrompt)
    const contentText = contentResult.response.text()
    
    addLog(jobId, { 
      type: 'output', 
      step: 'idea', 
      message: '📥 Received content from Gemini',
      data: { rawResponse: contentText }
    })

    const contentMatch = contentText.match(/\{[\s\S]*\}/)
    if (!contentMatch) {
      throw new Error('Failed to parse content JSON from Gemini response')
    }
    
    const content = JSON.parse(contentMatch[0])
    addLog(jobId, { 
      type: 'info', 
      step: 'idea', 
      message: `✅ Content generated: "${content.title}"`,
      data: content
    })

    job.message = `Content: ${content.title}`
    job.data = { content }

    // ============ STEP 2: Generate Video (Image + Audio + Subtitles) ============
    job.step = 'video'
    job.message = '🎬 Creating YouTube Shorts video...'
    addLog(jobId, { 
      type: 'step', 
      step: 'video', 
      message: '🎥 Step 2: Creating video (Image + TTS Audio + Subtitles)' 
    })
    addLog(jobId, { 
      type: 'info', 
      step: 'video', 
      message: '📐 Format: 9:16 vertical (1080x1920) for YouTube Shorts',
      data: { 
        imagePrompt: content.imagePrompt,
        voiceover: content.script,
        method: 'Pollinations.ai (FREE image) + Edge TTS (FREE audio) + FFmpeg'
      }
    })

    // Generate Shorts video with voice/language settings
    const videoResult = await generateShortsVideo(
      content.imagePrompt,
      content.script,
      jobId,
      (msg) => {
        addLog(jobId, { type: 'info', step: 'video', message: msg })
      },
      {
        voice: videoSettings.voice,
        language: videoSettings.language
      }
    )

    let videoPath: string | null = null
    
    if (videoResult.success && videoResult.videoPath) {
      videoPath = videoResult.videoPath
      addLog(jobId, { 
        type: 'output', 
        step: 'video', 
        message: `✅ Video created! Duration: ${videoResult.duration?.toFixed(1)}s`,
        data: { 
          videoPath: videoResult.videoPath,
          duration: videoResult.duration
        }
      })
      job.message = `Video created (${videoResult.duration?.toFixed(1)}s)`
    } else {
      addLog(jobId, { 
        type: 'error', 
        step: 'video', 
        message: `⚠️ Video generation failed: ${videoResult.error}`,
        data: videoResult
      })
      throw new Error(`Video generation failed: ${videoResult.error}`)
    }

    job.data = { ...job.data, videoPath, duration: videoResult.duration }

    // ============ STEP 3: YouTube Upload ============
    job.step = 'upload'
    job.message = '📺 Uploading to YouTube...'
    addLog(jobId, { 
      type: 'step', 
      step: 'upload', 
      message: '📺 Step 3: Uploading to YouTube' 
    })

    let youtubeUrl: string
    let uploadSuccess = false

    if (videoPath) {
      try {
        const description = `${content.hook}

${content.script}

🤖 Generated with AI Video Automation

${content.tags.join(' ')}`

        addLog(jobId, { 
          type: 'input', 
          step: 'upload', 
          message: '📤 Uploading to YouTube...',
          data: { 
            title: content.title,
            description,
            tags: content.tags,
            videoPath
          }
        })

        const uploadResult = await uploadToYouTube(
          videoPath,
          content.title,
          description,
          content.tags.map((t: string) => t.replace('#', ''))
        )

        youtubeUrl = uploadResult.url
        uploadSuccess = true
        
        addLog(jobId, { 
          type: 'output', 
          step: 'upload', 
          message: '✅ Video uploaded to YouTube!',
          data: { 
            videoId: uploadResult.videoId,
            youtubeUrl: uploadResult.url
          }
        })
        
        // Delete video file after successful upload
        if (videoPath) {
          try {
            cleanupAllJobFiles(jobId, videoPath)
            addLog(jobId, { 
              type: 'info', 
              step: 'upload', 
              message: '🗑️ Cleaned up temp video file'
            })
          } catch (cleanupError) {
            const err = cleanupError as Error
            console.error('Cleanup error:', err.message)
            // Don't fail the workflow if cleanup fails
          }
        }
      } catch (uploadError: unknown) {
        const err = uploadError as Error
        addLog(jobId, { 
          type: 'error', 
          step: 'upload', 
          message: `⚠️ YouTube upload failed: ${err.message}`,
          data: { error: err.message }
        })
        youtubeUrl = `UPLOAD_FAILED`
        // Don't delete video file on upload failure - user might want to retry
        addLog(jobId, { 
          type: 'info', 
          step: 'upload', 
          message: '💾 Video file kept for retry'
        })
      }
    } else {
      youtubeUrl = `NO_VIDEO`
      addLog(jobId, { 
        type: 'error', 
        step: 'upload', 
        message: '⚠️ No video file available for upload'
      })
    }

    // ============ COMPLETE ============
    job.status = 'completed'
    job.step = 'complete'
    job.message = uploadSuccess 
      ? '✅ Video uploaded to YouTube!' 
      : '✅ Video created (YouTube upload failed - connect account in Settings)'
    job.data = {
      ...job.data,
      youtubeUrl,
      uploadSuccess
    }

    addLog(jobId, { 
      type: 'info', 
      step: 'complete', 
      message: uploadSuccess 
        ? '🎉 Success! Video is LIVE on YouTube!' 
        : '🎉 Video created! Connect YouTube account to upload.',
      data: {
        title: content.title,
        script: content.script,
        videoPath,
        youtubeUrl,
        uploadSuccess,
        duration: videoResult.duration
      }
    })

  } catch (error: unknown) {
    const err = error as { message?: string }
    const currentStep = job.step || 'unknown'
    
    addLog(jobId, { 
      type: 'error', 
      step: currentStep, 
      message: `❌ Error: ${err.message || 'Unknown error'}`,
      data: { error: err }
    })

    job.status = 'error'
    job.error = err.message || 'Workflow failed'
    job.message = `Error in ${currentStep}: ${err.message}`
  }
}

// Manual trigger endpoint (for cron)
workflowRouter.post('/trigger', async (req: Request, res: Response) => {
  const apiKey = process.env.GEMINI_API_KEY || req.body.geminiApiKey

  if (!apiKey) {
    return res.status(400).json({ error: 'No API key configured' })
  }

  const jobId = uuidv4()
  jobs.set(jobId, { 
    status: 'running', 
    step: 'idea', 
    message: 'Starting scheduled workflow...', 
    logs: [] 
  })

  addLog(jobId, { type: 'info', step: 'init', message: 'Cron workflow triggered' })
  runWorkflow(jobId, apiKey)

  res.json({ success: true, jobId, message: 'Workflow triggered' })
})
