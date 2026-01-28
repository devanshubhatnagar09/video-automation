import * as fs from 'fs'
import * as path from 'path'
import ffmpegPath from 'ffmpeg-static'
import { spawn } from 'child_process'

// Use project temp directory (consistent across runs)
const TEMP_DIR = '/Users/devanshu.bhatnagar/Documents/video-automation/backend/temp'

// Ensure temp dir exists
function ensureTempDir() {
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true })
  }
  return TEMP_DIR
}

export interface VideoGenerationResult {
  success: boolean
  videoPath?: string
  error?: string
  method: string
}

/**
 * Generate images using Pollinations.ai (100% FREE, no API key needed!)
 */
async function generateImageWithPollinations(prompt: string, index: number): Promise<string | null> {
  try {
    ensureTempDir()
    
    // Shorten prompt to avoid URL issues
    const shortPrompt = prompt.slice(0, 200)
    const encodedPrompt = encodeURIComponent(shortPrompt)
    const seed = Math.floor(Math.random() * 1000000) + index
    const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1280&height=720&seed=${seed}&nologo=true`
    
    console.log(`🖼️ Generating image ${index + 1}...`)
    console.log(`URL: ${imageUrl.slice(0, 100)}...`)
    
    // Fetch with timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 60000) // 60s timeout
    
    const response = await fetch(imageUrl, { 
      signal: controller.signal,
      headers: {
        'User-Agent': 'VideoAutomation/1.0'
      }
    })
    clearTimeout(timeoutId)
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    const buffer = await response.arrayBuffer()
    
    if (buffer.byteLength < 1000) {
      throw new Error('Image too small, probably an error')
    }
    
    // Pollinations returns JPEG images, save with correct extension
    const imagePath = path.join(TEMP_DIR, `frame_${index.toString().padStart(3, '0')}.jpg`)
    fs.writeFileSync(imagePath, Buffer.from(buffer))
    
    console.log(`✅ Image ${index + 1} saved (${Math.round(buffer.byteLength/1024)}KB)`)
    return imagePath
  } catch (error) {
    const err = error as Error
    console.error(`❌ Image ${index + 1} failed:`, err.message)
    return null
  }
}

/**
 * Generate simple frame prompts
 */
function generateFramePrompts(basePrompt: string): string[] {
  // Shorter prompts work better
  const keywords = basePrompt.split(/[,.]/).slice(0, 3).join(', ')
  
  return [
    `${keywords}, wide shot, cinematic`,
    `${keywords}, close up, detailed`,
    `${keywords}, dynamic angle, colorful`,
    `${keywords}, artistic shot, dramatic lighting`,
    `${keywords}, epic finale, golden hour`
  ]
}

/**
 * Create video from images using FFmpeg
 */
async function createVideoFromImages(outputPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    const ffmpeg = ffmpegPath
    if (!ffmpeg) {
      console.error('❌ FFmpeg not found')
      resolve(false)
      return
    }

    const imagePattern = path.join(TEMP_DIR, 'frame_%03d.jpg')
    
    // Check if images exist
    const frame0 = path.join(TEMP_DIR, 'frame_000.jpg')
    if (!fs.existsSync(frame0)) {
      console.error('❌ No images found for video creation')
      resolve(false)
      return
    }

    console.log(`🎬 FFmpeg path: ${ffmpeg}`)
    console.log(`📁 Image pattern: ${imagePattern}`)
    console.log(`📹 Output: ${outputPath}`)

    // Simpler FFmpeg command
    const args = [
      '-y',
      '-framerate', '0.5',
      '-i', imagePattern,
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-vf', 'scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2',
      '-r', '24',
      outputPath
    ]

    console.log(`🔧 FFmpeg args: ${args.join(' ')}`)

    const proc = spawn(ffmpeg, args)
    let stderr = ''

    proc.stderr.on('data', (data: Buffer) => {
      stderr += data.toString()
    })

    proc.on('close', (code: number) => {
      if (code === 0 && fs.existsSync(outputPath)) {
        const stats = fs.statSync(outputPath)
        console.log(`✅ Video created! Size: ${Math.round(stats.size/1024)}KB`)
        resolve(true)
      } else {
        console.error(`❌ FFmpeg failed with code ${code}`)
        console.error(stderr.slice(-500)) // Last 500 chars of error
        resolve(false)
      }
    })

    proc.on('error', (err: Error) => {
      console.error('❌ FFmpeg spawn error:', err.message)
      resolve(false)
    })
  })
}

/**
 * Clean up temp files
 */
function cleanupTempFiles() {
  try {
    const files = fs.readdirSync(TEMP_DIR)
    files.forEach(file => {
      if (file.startsWith('frame_') && (file.endsWith('.jpg') || file.endsWith('.png'))) {
        fs.unlinkSync(path.join(TEMP_DIR, file))
      }
    })
  } catch (e) {
    // Ignore cleanup errors
  }
}

/**
 * Main function: Generate video from text prompt (100% FREE)
 */
export async function generateFreeVideo(
  prompt: string,
  jobId: string,
  onProgress?: (message: string) => void
): Promise<VideoGenerationResult> {
  const log = (msg: string) => {
    console.log(msg)
    onProgress?.(msg)
  }

  try {
    ensureTempDir()
    
    log('🎬 Starting FREE video generation...')
    log(`📁 Temp directory: ${TEMP_DIR}`)
    log('📝 Using Pollinations.ai (100% FREE)')

    // Clean up old frames first
    cleanupTempFiles()

    // Step 1: Generate frame prompts
    const framePrompts = generateFramePrompts(prompt)
    log(`📸 Will generate ${framePrompts.length} images...`)

    // Step 2: Generate images sequentially (more reliable)
    const validImages: string[] = []
    for (let i = 0; i < framePrompts.length; i++) {
      log(`⏳ Generating image ${i + 1}/${framePrompts.length}...`)
      const imagePath = await generateImageWithPollinations(framePrompts[i], i)
      if (imagePath) {
        validImages.push(imagePath)
      }
      // Small delay between requests
      await new Promise(r => setTimeout(r, 1000))
    }
    
    log(`📸 Generated ${validImages.length}/${framePrompts.length} images`)
    
    if (validImages.length < 2) {
      return {
        success: false,
        error: `Only ${validImages.length} images generated (need at least 2). Pollinations might be rate limiting.`,
        method: 'pollinations+ffmpeg'
      }
    }

    // Step 3: Create video from images
    const videoPath = path.join(TEMP_DIR, `video_${jobId}.mp4`)
    
    log('🎥 Creating video from images with FFmpeg...')
    const videoCreated = await createVideoFromImages(videoPath)
    
    if (!videoCreated) {
      return {
        success: false,
        error: 'FFmpeg failed to create video. Check if ffmpeg-static is installed correctly.',
        method: 'pollinations+ffmpeg'
      }
    }
    
    if (!fs.existsSync(videoPath)) {
      return {
        success: false,
        error: 'Video file was not created',
        method: 'pollinations+ffmpeg'
      }
    }

    // Step 4: Cleanup temp images (keep video)
    cleanupTempFiles()
    
    log('✅ Video generated successfully!')
    log(`📹 Video path: ${videoPath}`)
    
    return {
      success: true,
      videoPath,
      method: 'pollinations+ffmpeg (100% FREE)'
    }
  } catch (error) {
    const err = error as Error
    console.error('Video generation error:', err)
    return {
      success: false,
      error: err.message,
      method: 'pollinations+ffmpeg'
    }
  }
}

/**
 * Get video file path
 */
export function getVideoPath(jobId: string): string | null {
  const videoPath = path.join(TEMP_DIR, `video_${jobId}.mp4`)
  return fs.existsSync(videoPath) ? videoPath : null
}
