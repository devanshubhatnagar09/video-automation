import { Router, Request, Response } from 'express'
import multer, { FileFilterCallback } from 'multer'
import * as path from 'path'
import * as os from 'os'
import * as fs from 'fs'
import { authenticateToken, AuthRequest } from '../middleware/auth.js'
import connectDB from '../db/mongodb.js'
import { Job } from '../models/Job.js'
import { generateShortsVideo, VideoOptions } from '../services/shorts-video-generator.js'
import { uploadToYouTube } from './youtube.js'
import { cleanupAllJobFiles } from '../services/shorts-video-generator.js'

// Helper to add log to job
async function addLogToJob(jobId: string, userId: string, log: {
  type: string
  step: string
  message: string
  data?: unknown
}) {
  try {
    await connectDB()
    await Job.findOneAndUpdate(
      { jobId, userId },
      {
        $push: {
          logs: {
            ...log,
            timestamp: new Date().toISOString()
          }
        }
      }
    )
  } catch (err) {
    console.error('Failed to add log to job:', err)
  }
}

export const workflowUploadRouter = Router()

// Configure multer for image uploads
const TEMP_DIR = path.join(os.tmpdir(), 'video-automation')

// Ensure temp directory exists
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true })
}

const storage = multer.diskStorage({
  destination: (_req: Request, _file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => {
    cb(null, TEMP_DIR)
  },
  filename: (req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
    const jobId = (req.params as { jobId?: string }).jobId || 'temp'
    const ext = path.extname(file.originalname) || '.jpg'
    cb(null, `manual_image_${jobId}${ext}`)
  }
})

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
  fileFilter: (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    // Accept only image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true)
    } else {
      cb(new Error('Only image files are allowed'))
    }
  }
})

/**
 * Upload manual image for a job that failed image generation
 * POST /api/workflow/upload-image/:jobId
 */
workflowUploadRouter.post(
  '/upload-image/:jobId',
  authenticateToken,
  upload.single('image'),
  async (req: AuthRequest, res: Response) => {
    try {
      await connectDB()

      if (!req.userId) {
        return res.status(401).json({ error: 'Unauthorized' })
      }

      const { jobId } = req.params as { jobId: string }

      if (!req.file) {
        return res.status(400).json({ error: 'No image file provided' })
      }

      // Verify job belongs to user
      const job = await Job.findOne({ jobId, userId: req.userId })
      if (!job) {
        // Cleanup uploaded file
        if (req.file.path && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path)
        }
        return res.status(404).json({ error: 'Job not found or access denied' })
      }

      // Check if job is in a state that allows manual image upload
      if (job.status === 'completed') {
        return res.status(400).json({ error: 'Job already completed' })
      }

      const manualImagePath = req.file.path

      // Get video settings from job data or use defaults
      // Check if stored in job.data.videoSettings or use defaults
      const videoSettings: VideoOptions = {
        voice: (job.data as any)?.videoSettings?.voice || 'Jenny',
        language: (job.data as any)?.videoSettings?.language || 'english'
      }

      await addLogToJob(jobId, req.userId, {
        type: 'info',
        step: 'video',
        message: '📤 Manual image uploaded, continuing video generation...',
        data: {
          filename: req.file.originalname,
          size: req.file.size,
          mimetype: req.file.mimetype
        }
      })

      // Continue video generation with manual image
      const videoResult = await generateShortsVideo(
        job.data?.content?.imagePrompt || 'background image',
        job.data?.content?.script || '',
        jobId,
        req.userId!,
        async (msg) => {
          console.log(`[${jobId}] ${msg}`)
          await addLogToJob(jobId, req.userId!, {
            type: 'info',
            step: 'video',
            message: msg
          })
        },
        {
          voice: videoSettings.voice || 'Jenny',
          language: videoSettings.language || 'english'
        },
        manualImagePath // Pass manual image path
      )

      if (!videoResult.success) {
        await addLogToJob(jobId, req.userId, {
          type: 'error',
          step: 'video',
          message: `⚠️ Video generation failed: ${videoResult.error}`,
          data: videoResult
        })
        return res.status(500).json({
          error: videoResult.error || 'Video generation failed',
          errorMessage: videoResult.errorMessage
        })
      }

      await addLogToJob(jobId, req.userId, {
        type: 'output',
        step: 'video',
        message: `✅ Video created with manual image! Duration: ${videoResult.duration?.toFixed(1)}s`,
        data: {
          videoPath: videoResult.videoPath,
          videoFileId: videoResult.videoFileId,
          duration: videoResult.duration,
          manualImageUsed: true
        }
      })

      // Update job status
      await Job.findOneAndUpdate(
        { jobId },
        {
          $set: {
            status: 'running',
            step: 'upload',
            message: 'Video created with manual image, ready for YouTube upload',
            data: {
              ...job.data,
              videoPath: videoResult.videoPath,
              videoFileId: videoResult.videoFileId,
              duration: videoResult.duration,
              manualImageUsed: true
            }
          }
        }
      )

      res.json({
        success: true,
        message: 'Image uploaded and video generated successfully',
        videoFileId: videoResult.videoFileId,
        videoPath: videoResult.videoPath,
        duration: videoResult.duration
      })
    } catch (error: unknown) {
      const err = error as { message?: string }
      console.error('Manual image upload error:', err)
      
      // Cleanup uploaded file on error
      if (req.file && req.file.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path)
      }
      
      res.status(500).json({ error: err.message || 'Failed to process manual image upload' })
    }
  }
)

/**
 * Continue workflow with manual image - upload to YouTube
 * POST /api/workflow/continue/:jobId
 */
workflowUploadRouter.post('/continue/:jobId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    await connectDB()

    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const { jobId } = req.params as { jobId: string }

    // Get job
    const job = await Job.findOne({ jobId, userId: req.userId })
    if (!job) {
      return res.status(404).json({ error: 'Job not found' })
    }

    const videoFileIdOrPath = job.data?.videoFileId || job.data?.videoPath
    if (!videoFileIdOrPath) {
      return res.status(400).json({ error: 'No video available. Please upload an image first.' })
    }

    const content = job.data?.content
    if (!content) {
      return res.status(400).json({ error: 'Content not found in job data' })
    }

    // Upload to YouTube
    const description = `${content.hook}

${content.script}

🤖 Generated with AI Video Automation

${content.tags?.join(' ') || ''}`

    const uploadResult = await uploadToYouTube(
      req.userId,
      videoFileIdOrPath,
      content.title,
      description,
      (content.tags || []).map((t: string) => t.replace('#', ''))
    )

    // Update job status
    await Job.findOneAndUpdate(
      { jobId },
      {
        $set: {
          status: 'completed',
          step: 'complete',
          message: '✅ Video uploaded to YouTube!',
          data: {
            ...job.data,
            youtubeUrl: uploadResult.url,
            uploadSuccess: true
          }
        }
      }
    )

    // Cleanup after successful upload
    try {
      await cleanupAllJobFiles(jobId, job.data?.videoFileId)
    } catch (cleanupError) {
      console.error('Cleanup error:', cleanupError)
    }

    res.json({
      success: true,
      message: 'Video uploaded to YouTube successfully',
      videoId: uploadResult.videoId,
      youtubeUrl: uploadResult.url
    })
  } catch (error: unknown) {
    const err = error as { message?: string }
    console.error('Continue workflow error:', err)
    res.status(500).json({ error: err.message || 'Failed to continue workflow' })
  }
})
