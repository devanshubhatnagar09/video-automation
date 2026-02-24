import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import ffmpegPathModule from 'ffmpeg-static'
import { spawn, execSync, ChildProcess } from 'child_process'
import { uploadToGridFS, deleteFromGridFS } from './gridfs-storage.js'
import connectDB from '../db/mongodb.js'
import { MediaFile } from '../models/MediaFile.js'
import mongoose from 'mongoose'

// Get FFmpeg path with null check
const ffmpegPath: string | null = ffmpegPathModule || null

// Use OS temp directory (works on any system including Render)
const TEMP_DIR = path.join(os.tmpdir(), 'video-automation')

function ensureTempDir() {
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true })
  }
}

export interface ShortsVideoResult {
  success: boolean
  videoPath?: string // Local temp path for FFmpeg/upload
  videoFileId?: string // GridFS file ID
  error?: string
  errorMessage?: string // Detailed error message
  duration?: number
  requiresManualImage?: boolean // Flag to indicate manual image upload needed
}

/**
 * Download random 9:16 image from Picsum.photos (fallback)
 */
async function downloadPicsumImage(jobId: string): Promise<string | null> {
  try {
    ensureTempDir()
    
    // 9:16 aspect ratio for Shorts (1080x1920)
    const width = 1080
    const height = 1920
    const seed = Math.floor(Math.random() * 1000000)
    const imageUrl = `https://picsum.photos/${width}/${height}?random=${seed}`
    
    console.log(`🖼️ Downloading random image from Picsum.photos...`)
    console.log(`🔗 URL: ${imageUrl}`)
    
    const controller = new AbortController()
    const timeoutId = setTimeout(() => {
      controller.abort()
      console.error('⏱️ Picsum image download timeout after 30 seconds')
    }, 30000) // 30s timeout
    
    let response: Response
    try {
      response = await fetch(imageUrl, { 
        signal: controller.signal,
        headers: { 
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'image/jpeg,image/png,image/webp,*/*'
        }
      })
      clearTimeout(timeoutId)
    } catch (fetchError) {
      clearTimeout(timeoutId)
      const err = fetchError as Error
      if (err.name === 'AbortError') {
        console.error('⏱️ Request timeout')
        return null
      }
      console.error(`❌ Fetch error: ${err.message}`)
      return null
    }
    
    if (!response.ok) {
      console.error(`❌ HTTP ${response.status}: ${response.statusText}`)
      return null
    }
    
    const contentType = response.headers.get('content-type') || ''
    if (!contentType.startsWith('image/')) {
      console.error(`❌ Invalid content type: ${contentType}`)
      return null
    }
    
    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    
    // Save image
    const ext = contentType.includes('png') ? '.png' : contentType.includes('webp') ? '.webp' : '.jpg'
    const imagePath = path.join(TEMP_DIR, `picsum_${jobId}${ext}`)
    fs.writeFileSync(imagePath, buffer)
    
    console.log(`✅ Picsum image downloaded: ${imagePath} (${(buffer.length / 1024).toFixed(1)}KB)`)
    return imagePath
  } catch (error) {
    const err = error as Error
    console.error(`❌ Picsum image download failed:`, err.message)
    return null
  }
}

/**
 * Generate 9:16 vertical image using Pollinations.ai (FREE)
 * With retry logic for reliability
 */
async function generateVerticalImage(prompt: string, jobId: string, retryCount = 0): Promise<string | null> {
  const MAX_RETRIES = 3
  const RETRY_DELAY = 2000 // 2 seconds
  
  try {
    ensureTempDir()
    
    // 9:16 aspect ratio for Shorts (1080x1920)
    const shortPrompt = prompt.slice(0, 150)
    const encodedPrompt = encodeURIComponent(shortPrompt + ', vertical composition, mobile wallpaper style, high quality')
    const seed = Math.floor(Math.random() * 1000000)
    const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1080&height=1920&seed=${seed}&nologo=true`
    
    console.log(`🖼️ Generating 9:16 vertical image... (Attempt ${retryCount + 1}/${MAX_RETRIES + 1})`)
    console.log(`📝 Prompt: ${shortPrompt.slice(0, 50)}...`)
    console.log(`🔗 URL: ${imageUrl.substring(0, 100)}...`)
    
    const controller = new AbortController()
    const timeoutId = setTimeout(() => {
      controller.abort()
      console.error('⏱️ Image generation timeout after 60 seconds')
    }, 60000) // 60s timeout (reduced from 90s)
    
    let response: Response
    try {
      response = await fetch(imageUrl, { 
        signal: controller.signal,
        headers: { 
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'image/jpeg,image/png,image/webp,*/*',
          'Referer': 'https://pollinations.ai/'
        }
      })
      clearTimeout(timeoutId)
    } catch (fetchError) {
      clearTimeout(timeoutId)
      const err = fetchError as Error
      if (err.name === 'AbortError') {
        console.error('⏱️ Request timeout')
        if (retryCount < MAX_RETRIES) {
          console.log(`🔄 Retrying in ${RETRY_DELAY}ms...`)
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY))
          return generateVerticalImage(prompt, jobId, retryCount + 1)
        }
        throw new Error('Image generation timeout after multiple retries')
      }
      console.error(`❌ Fetch error: ${err.message}`)
      if (retryCount < MAX_RETRIES) {
        console.log(`🔄 Retrying in ${RETRY_DELAY}ms...`)
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY))
        return generateVerticalImage(prompt, jobId, retryCount + 1)
      }
      throw new Error(`Fetch failed after retries: ${err.message}`)
    }
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      console.error(`❌ HTTP ${response.status}: ${errorText.slice(0, 200)}`)
      if (retryCount < MAX_RETRIES && response.status >= 500) {
        // Retry on server errors
        console.log(`🔄 Retrying due to server error (${response.status})...`)
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY))
        return generateVerticalImage(prompt, jobId, retryCount + 1)
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    const contentType = response.headers.get('content-type') || ''
    if (!contentType.startsWith('image/')) {
      const text = await response.text()
      console.error(`❌ Invalid content type: ${contentType}`)
      console.error(`Response preview: ${text.slice(0, 200)}`)
      if (retryCount < MAX_RETRIES) {
        console.log(`🔄 Retrying due to invalid content type...`)
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY))
        return generateVerticalImage(prompt, jobId, retryCount + 1)
      }
      throw new Error(`Invalid content type: ${contentType}. Expected image.`)
    }
    
    const buffer = await response.arrayBuffer()
    console.log(`📦 Received ${buffer.byteLength} bytes`)
    
    if (buffer.byteLength < 5000) {
      const text = new TextDecoder().decode(buffer.slice(0, 200))
      console.error(`❌ Image too small (${buffer.byteLength} bytes). Response: ${text}`)
      if (retryCount < MAX_RETRIES) {
        console.log(`🔄 Retrying due to small response...`)
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY))
        return generateVerticalImage(prompt, jobId, retryCount + 1)
      }
      throw new Error(`Image too small (${buffer.byteLength} bytes). May be an error page.`)
    }
    
    const imagePath = path.join(TEMP_DIR, `shorts_bg_${jobId}.jpg`)
    
    try {
      fs.writeFileSync(imagePath, Buffer.from(buffer))
      const stats = fs.statSync(imagePath)
      console.log(`✅ Image saved: ${imagePath} (${Math.round(stats.size/1024)}KB)`)
      return imagePath
    } catch (writeError) {
      const err = writeError as Error
      console.error(`❌ Failed to write image file: ${err.message}`)
      console.error(`Temp dir: ${TEMP_DIR}, exists: ${fs.existsSync(TEMP_DIR)}`)
      throw new Error(`Failed to write image: ${err.message}`)
    }
  } catch (error) {
    const err = error as Error
    console.error(`❌ Image generation failed (attempt ${retryCount + 1}):`, err.message)
    if (retryCount < MAX_RETRIES) {
      console.log(`🔄 Retrying in ${RETRY_DELAY}ms...`)
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY))
      return generateVerticalImage(prompt, jobId, retryCount + 1)
    }
    console.error('Stack:', err.stack)
    return null
  }
}

/**
 * Get audio duration using ffprobe
 */
function getAudioDuration(audioPath: string): number {
  try {
    if (!ffmpegPath) return 10
    
    const ffprobePath = ffmpegPath.replace('ffmpeg', 'ffprobe')
    const result = execSync(
      `"${ffprobePath}" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioPath}"`,
      { encoding: 'utf8', timeout: 10000 }
    )
    return parseFloat(result.trim()) || 10
  } catch {
    return 10 // Default 10 seconds
  }
}

// Voice mapping for Edge TTS
const VOICE_MAP: Record<string, string> = {
  // English voices (very natural)
  'Jenny': 'en-US-JennyNeural',      // Friendly, conversational female
  'Guy': 'en-US-GuyNeural',          // Professional male
  'Aria': 'en-US-AriaNeural',        // Warm, expressive female
  // Hindi voices
  'Swara': 'hi-IN-SwaraNeural',      // Natural Hindi female
  'Madhur': 'hi-IN-MadhurNeural',    // Clear Hindi male
}

/**
 * Generate natural human-like audio using Edge TTS (Microsoft Neural Voices)
 * With multiple fallbacks for reliability
 */
async function generateNaturalAudio(
  text: string, 
  jobId: string,
  voice: string = 'Jenny',
  language: string = 'english'
): Promise<{ audioPath: string | null, subtitles: SubtitleEntry[] }> {
  const subtitles: SubtitleEntry[] = []
  
  try {
    ensureTempDir()
    
    const mp3Path = path.join(TEMP_DIR, `shorts_audio_${jobId}.mp3`)
    
    // Clean text - allow Hindi characters if Hindi language
    let cleanText = text
      .replace(/"/g, "'")
      .replace(/\n/g, ' ')
      .trim()
    
    if (language === 'english') {
      cleanText = cleanText.replace(/[^\w\s.,!?'-]/g, '')
    }
    // For Hindi, keep Devanagari characters
    
    console.log('🎙️ Generating natural voice...')
    console.log(`🗣️ Voice: ${voice} (${VOICE_MAP[voice] || voice})`)
    console.log(`🌐 Language: ${language}`)
    console.log(`📝 Text: "${cleanText.slice(0, 100)}..."`)
    
    let audioGenerated = false
    
    // Method 1: Try edge-tts via Python shell command (works for both languages)
    if (!audioGenerated) {
      try {
        console.log('📢 Trying edge-tts Python command...')
        const edgeVoice = VOICE_MAP[voice] || (language === 'hindi' ? 'hi-IN-SwaraNeural' : 'en-US-JennyNeural')
        
        // Escape text properly for shell - use single quotes to preserve special chars
        const escapedText = cleanText.replace(/'/g, "'\\''")
        
        // Try different ways to call edge-tts
        const commands = [
          `python3 -m edge_tts --voice "${edgeVoice}" --text '${escapedText}' --write-media "${mp3Path}"`,
          `edge-tts --voice "${edgeVoice}" --text '${escapedText}' --write-media "${mp3Path}"`,
          `/Users/devanshu.bhatnagar/Library/Python/3.8/bin/edge-tts --voice "${edgeVoice}" --text '${escapedText}' --write-media "${mp3Path}"`
        ]
        
        for (let i = 0; i < commands.length; i++) {
          const cmd = commands[i]
          try {
            console.log(`   Trying command ${i + 1}/${commands.length}...`)
            execSync(cmd, { timeout: 60000, stdio: 'pipe', encoding: 'utf8' })
            
            // Wait a bit for file to be written
            await new Promise(resolve => setTimeout(resolve, 500))
            
            if (fs.existsSync(mp3Path)) {
              const stats = fs.statSync(mp3Path)
              console.log(`   Audio file size: ${stats.size} bytes`)
              if (stats.size > 1000) {
                console.log('✅ Python edge-tts succeeded!')
                audioGenerated = true
                break
              }
            }
          } catch (cmdError) {
            const err = cmdError as Error
            console.log(`   Command ${i + 1} failed: ${err.message}`)
            continue
          }
        }
      } catch (pyError) {
        const err = pyError as Error
        console.log('❌ Python edge-tts failed:', err.message)
      }
    }
    
    // Method 2: For English - use macOS say (very natural Samantha voice)
    if (!audioGenerated && language === 'english') {
      try {
        console.log('📢 Trying macOS say...')
        const aiffPath = path.join(TEMP_DIR, `shorts_audio_${jobId}.aiff`)
        const cleanEnglishText = cleanText.replace(/[^\w\s.,!?'-]/g, '')
        
        execSync(`say -v "Samantha" -r 150 -o "${aiffPath}" "${cleanEnglishText}"`, { 
          timeout: 60000,
          stdio: 'pipe'
        })
        
        if (fs.existsSync(aiffPath) && ffmpegPath) {
          execSync(`"${ffmpegPath}" -y -i "${aiffPath}" -af "volume=2.0" -ar 44100 -ac 1 -b:a 192k "${mp3Path}"`, { 
            timeout: 30000,
            stdio: 'pipe'
          })
          
          if (fs.existsSync(aiffPath)) fs.unlinkSync(aiffPath)
          
          if (fs.existsSync(mp3Path) && fs.statSync(mp3Path).size > 1000) {
            console.log('✅ macOS say succeeded!')
            audioGenerated = true
          }
        }
      } catch (sayError) {
        const err = sayError as Error
        console.log('❌ macOS say failed:', err.message)
      }
    }
    
    // Method 3: Final fallback - use macOS say with any available voice for Hindi
    if (!audioGenerated && language === 'hindi') {
      try {
        console.log('📢 Fallback: Using macOS say for Hindi (limited)...')
        const aiffPath = path.join(TEMP_DIR, `shorts_audio_${jobId}.aiff`)
        
        // Clean for macOS say - remove non-ASCII
        const asciiText = cleanText.replace(/[^\x00-\x7F]/g, ' ').replace(/\s+/g, ' ').trim()
        
        if (asciiText.length > 10) {
          execSync(`say -v "Samantha" -r 140 -o "${aiffPath}" "${asciiText}"`, { 
            timeout: 60000,
            stdio: 'pipe'
          })
          
          if (fs.existsSync(aiffPath) && ffmpegPath) {
            execSync(`"${ffmpegPath}" -y -i "${aiffPath}" -af "volume=2.0" -ar 44100 -ac 1 -b:a 192k "${mp3Path}"`, { 
              timeout: 30000,
              stdio: 'pipe'
            })
            
            if (fs.existsSync(aiffPath)) fs.unlinkSync(aiffPath)
            
            if (fs.existsSync(mp3Path) && fs.statSync(mp3Path).size > 1000) {
              console.log('✅ Fallback macOS say succeeded!')
              audioGenerated = true
              // Update cleanText for subtitles to match what was spoken
              cleanText = asciiText
            }
          }
        }
      } catch (fallbackError) {
        const err = fallbackError as Error
        console.log('❌ Fallback failed:', err.message)
      }
    }
    
    // Generate subtitles if audio was created
    if (audioGenerated && fs.existsSync(mp3Path)) {
      const duration = getAudioDuration(mp3Path)
      console.log(`✅ Final audio duration: ${duration.toFixed(1)}s`)
      
      const words = cleanText.split(' ').filter(w => w.length > 0)
      if (words.length > 0) {
        const avgWordDuration = duration / words.length
        let currentTime = 0
        
        const phraseSize = language === 'hindi' ? 3 : 4
        for (let i = 0; i < words.length; i += phraseSize) {
          const phrase = words.slice(i, i + phraseSize).join(' ')
          const phraseDuration = avgWordDuration * Math.min(phraseSize, words.length - i)
          
          subtitles.push({
            start: currentTime,
            end: currentTime + phraseDuration,
            text: phrase
          })
          
          currentTime += phraseDuration
        }
      }
      
      return { audioPath: mp3Path, subtitles }
    }
    
    // If we got here, all methods failed
    const errorMsg = language === 'hindi' 
      ? 'All audio generation methods failed for Hindi. Tried: Python edge-tts, macOS say fallback.'
      : 'All audio generation methods failed. Tried: Python edge-tts, macOS say.'
    throw new Error(errorMsg)
  } catch (error) {
    const err = error as Error
    console.error('❌ Audio generation failed:', err.message)
    return { audioPath: null, subtitles: [] }
  }
}

interface SubtitleEntry {
  start: number
  end: number
  text: string
}

/**
 * Create ASS subtitle file with nice styling
 */
function createAssSubtitles(subtitles: SubtitleEntry[], outputPath: string): void {
  // Convert seconds to ASS timestamp format (H:MM:SS.cc)
  const toAssTime = (seconds: number): string => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = Math.floor(seconds % 60)
    const cs = Math.floor((seconds % 1) * 100)
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${cs.toString().padStart(2, '0')}`
  }

  const assContent = `[Script Info]
Title: Video Subtitles
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,60,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,1,0,0,0,100,100,0,0,1,3,2,2,50,50,180,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${subtitles.map(sub => 
  `Dialogue: 0,${toAssTime(sub.start)},${toAssTime(sub.end)},Default,,0,0,0,,${sub.text}`
).join('\n')}
`

  fs.writeFileSync(outputPath, assContent)
  console.log(`📝 Created ASS subtitles with ${subtitles.length} entries`)
}

/**
 * Create video with image + audio + synced subtitles using FFmpeg
 */
async function createVideoWithSyncedSubtitles(
  imagePath: string,
  audioPath: string,
  subtitles: SubtitleEntry[],
  outputPath: string
): Promise<boolean> {
  return new Promise((resolve) => {
    if (!ffmpegPath) {
      console.error('❌ FFmpeg not found')
      resolve(false)
      return
    }

    const duration = getAudioDuration(audioPath)
    console.log(`⏱️ Audio duration: ${duration.toFixed(1)}s`)

    // Create ASS subtitle file
    const assPath = path.join(TEMP_DIR, `subs_${Date.now()}.ass`)
    createAssSubtitles(subtitles, assPath)

    // Use exact audio duration for video
    const videoDuration = Math.max(duration, 5) // Minimum 5 seconds

    // Escape ASS path for FFmpeg (handle spaces and special chars)
    const escapedAssPath = assPath.replace(/\\/g, '/').replace(/'/g, "\\'")

    // FFmpeg command with ASS subtitles (properly synced)
    // Use -t with exact duration instead of -shortest for better reliability
    const args = [
      '-y',
      '-loop', '1',
      '-i', imagePath,
      '-i', audioPath,
      '-c:v', 'libx264',
      '-tune', 'stillimage',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-ar', '44100',
      '-filter_complex', `[0:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,ass=${escapedAssPath}[v];[1:a]volume=1.8[a]`,
      '-map', '[v]',
      '-map', '[a]',
      '-pix_fmt', 'yuv420p',
      '-t', videoDuration.toFixed(2), // Exact duration
      outputPath
    ]

    console.log('🎬 Creating video with synced subtitles...')
    console.log(`📹 Video duration: ${videoDuration.toFixed(1)}s`)
    console.log(`📝 ASS file: ${assPath}`)
    
    let resolved = false
    if (!ffmpegPath) {
      throw new Error('FFmpeg not found. Make sure ffmpeg-static is installed.')
    }
    
    const proc = spawn(ffmpegPath, args) as any
    let stderr = ''
    let stdout = ''

    // Set timeout (60 seconds max)
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true
        console.error('❌ FFmpeg timeout after 60 seconds')
        proc.kill('SIGKILL')
        if (fs.existsSync(assPath)) {
          fs.unlinkSync(assPath)
        }
        resolve(false)
      }
    }, 60000)

    proc.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString()
    })

    proc.stderr.on('data', (data: Buffer) => {
      const text = data.toString()
      stderr += text
      // Log progress
      const timeMatch = text.match(/time=(\d+:\d+:\d+\.\d+)/)
      if (timeMatch) {
        console.log(`   FFmpeg progress: ${timeMatch[1]}`)
      }
    })

    proc.on('close', (code: number) => {
      if (resolved) return
      resolved = true
      clearTimeout(timeout)
      
      // Clean up ASS file
      if (fs.existsSync(assPath)) {
        fs.unlinkSync(assPath)
      }
      
      if (code === 0 && fs.existsSync(outputPath)) {
        const stats = fs.statSync(outputPath)
        console.log(`✅ Video created with synced subtitles! Size: ${Math.round(stats.size/1024)}KB`)
        resolve(true)
      } else {
        console.error(`❌ FFmpeg failed (code ${code})`)
        console.error('Error:', stderr.slice(-1000))
        
        // Fallback without subtitles
        console.log('🔄 Creating video without subtitles...')
        const fallbackArgs = [
          '-y',
          '-loop', '1',
          '-i', imagePath,
          '-i', audioPath,
          '-c:v', 'libx264',
          '-tune', 'stillimage',
          '-c:a', 'aac',
          '-b:a', '192k',
          '-ar', '44100',
          '-filter_complex', '[0:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2[v];[1:a]volume=1.8[a]',
          '-map', '[v]',
          '-map', '[a]',
          '-pix_fmt', 'yuv420p',
          '-t', videoDuration.toFixed(2), // Exact duration
          outputPath
        ]
        
        let fallbackResolved = false
        const fallbackTimeout = setTimeout(() => {
          if (!fallbackResolved) {
            fallbackResolved = true
            console.error('❌ Fallback FFmpeg timeout')
            resolve(false)
          }
        }, 60000)
        
        if (!ffmpegPath) {
          if (!fallbackResolved) {
            fallbackResolved = true
            clearTimeout(fallbackTimeout)
            resolve(false)
          }
          return
        }
        
        const fallback = spawn(ffmpegPath, fallbackArgs) as any
        fallback.on('close', (fallbackCode: number) => {
          if (fallbackResolved) return
          fallbackResolved = true
          clearTimeout(fallbackTimeout)
          if (fallbackCode === 0 && fs.existsSync(outputPath)) {
            console.log('✅ Video created (no subtitles)')
            resolve(true)
          } else {
            resolve(false)
          }
        })
        fallback.on('error', () => {
          if (!fallbackResolved) {
            fallbackResolved = true
            clearTimeout(fallbackTimeout)
            resolve(false)
          }
        })
      }
    })

    proc.on('error', (err: Error) => {
      if (resolved) return
      resolved = true
      clearTimeout(timeout)
      console.error('❌ FFmpeg spawn error:', err.message)
      if (fs.existsSync(assPath)) {
        fs.unlinkSync(assPath)
      }
      resolve(false)
    })
  })
}

/**
 * Clean up temp files for a job
 */
function cleanupJobFiles(jobId: string) {
  try {
    const files = fs.readdirSync(TEMP_DIR)
    files.forEach(file => {
      if (file.includes(jobId) && !file.startsWith('shorts_' + jobId.slice(0, 8))) {
        const filePath = path.join(TEMP_DIR, file)
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath)
        }
      }
    })
  } catch {
    // Ignore cleanup errors
  }
}

/**
 * Delete video file after successful upload
 */
export function deleteVideoFile(videoPath: string): void {
  try {
    if (fs.existsSync(videoPath)) {
      fs.unlinkSync(videoPath)
      console.log(`🗑️ Deleted video file: ${path.basename(videoPath)}`)
    }
  } catch (error) {
    const err = error as Error
    console.error(`⚠️ Failed to delete video file: ${err.message}`)
  }
}

/**
 * Delete all temp files for a job including video
 * Also deletes GridFS files if fileId is provided
 */
export async function cleanupAllJobFiles(jobId: string, videoFileId?: string): Promise<void> {
  try {
    // Clean up other temp files
    cleanupJobFiles(jobId)
    
    // Delete video from GridFS if fileId provided
    if (videoFileId) {
      try {
        await deleteFromGridFS(videoFileId)
        console.log(`✅ Deleted video from GridFS: ${videoFileId}`)
        
        // Also delete MediaFile record
        await connectDB()
        await MediaFile.deleteOne({ fileId: videoFileId })
      } catch (error) {
        console.error('GridFS delete error:', error)
      }
    }
    
    // Also cleanup local video file if exists
    const videoPath = path.join(TEMP_DIR, `shorts_${jobId}.mp4`)
    if (fs.existsSync(videoPath)) {
      try {
        fs.unlinkSync(videoPath)
        console.log(`✅ Deleted local video file: ${videoPath}`)
      } catch (error) {
        console.error('Local file delete error:', error)
      }
    }
    
    console.log(`✅ Cleaned up all temp files for job: ${jobId.slice(0, 8)}`)
  } catch (error) {
    const err = error as Error
    console.error(`⚠️ Cleanup error: ${err.message}`)
  }
}

export interface VideoOptions {
  voice?: string
  language?: string
}

/**
 * Main function: Generate YouTube Shorts video (100% FREE)
 */
export async function generateShortsVideo(
  imagePrompt: string,
  voiceoverText: string,
  jobId: string,
  userId: string,
  onProgress?: (msg: string) => void,
  options: VideoOptions = {},
  manualImagePath?: string // Optional: path to manually uploaded image
): Promise<ShortsVideoResult> {
  const log = (msg: string) => {
    console.log(msg)
    onProgress?.(msg)
  }

  const voice = options.voice || 'Jenny'
  const language = options.language || 'english'

  try {
    ensureTempDir()
    
    log('🎬 Starting YouTube Shorts video generation...')
    log('📐 Format: 9:16 vertical (1080x1920)')
    log(`🗣️ Voice: ${voice} | 🌐 Language: ${language}`)

    // Step 1: Generate background image or use manual upload
    let imagePath: string | null = null
    
    if (manualImagePath && fs.existsSync(manualImagePath)) {
      log('📸 Using manually uploaded image...')
      // Copy manual image to temp directory
      imagePath = path.join(TEMP_DIR, `shorts_bg_${jobId}.jpg`)
      fs.copyFileSync(manualImagePath, imagePath)
      log('✅ Manual image loaded successfully')
    } else {
      log('📸 Step 1: Generating background image...')
      log(`📝 Image prompt: ${imagePrompt.slice(0, 100)}...`)
      
      imagePath = await generateVerticalImage(imagePrompt, jobId)
      
      if (!imagePath) {
        log('❌ Image generation failed - trying multiple fallbacks...')
        
        // Try fallback 1: Simple prompt
        const fallbackPrompts = [
          'beautiful abstract background, vertical, colorful, high quality',
          'gradient background, vertical, modern, vibrant colors',
          'minimalist background, vertical, clean, professional'
        ]
        
        for (let i = 0; i < fallbackPrompts.length; i++) {
          log(`🔄 Fallback attempt ${i + 1}/${fallbackPrompts.length}...`)
          const fallbackImagePath = await generateVerticalImage(fallbackPrompts[i], `${jobId}_fallback${i}`)
          
          if (fallbackImagePath) {
            log(`✅ Fallback ${i + 1} succeeded`)
            imagePath = path.join(TEMP_DIR, `shorts_bg_${jobId}.jpg`)
            fs.copyFileSync(fallbackImagePath, imagePath)
            if (fs.existsSync(fallbackImagePath)) {
              fs.unlinkSync(fallbackImagePath)
            }
            break
          }
        }
        
        if (!imagePath) {
          log('❌ All fallback attempts failed - trying Picsum.photos...')
          
          // Try Picsum.photos as final fallback before manual upload
          const picsumImagePath = await downloadPicsumImage(jobId)
          
          if (picsumImagePath) {
            log('✅ Picsum.photos fallback succeeded')
            imagePath = path.join(TEMP_DIR, `shorts_bg_${jobId}.jpg`)
            fs.copyFileSync(picsumImagePath, imagePath)
            if (fs.existsSync(picsumImagePath)) {
              fs.unlinkSync(picsumImagePath)
            }
          } else {
            log('❌ Picsum.photos also failed')
            return {
              success: false,
              error: 'IMAGE_GENERATION_FAILED', // Special error code for manual upload option
              errorMessage: 'Failed to generate background image after multiple attempts (Pollinations.ai and Picsum.photos). Please upload an image manually.'
            }
          }
        }
      }
    }

    // Step 2: Generate natural voiceover audio with timing
    log('🎙️ Step 2: Generating natural voiceover...')
    const { audioPath, subtitles } = await generateNaturalAudio(voiceoverText, jobId, voice, language)
    
    if (!audioPath) {
      return {
        success: false,
        error: 'Failed to generate audio. Make sure Python edge-tts is installed for Hindi support.'
      }
    }

    // Step 3: Create video with synced subtitles
    log('🎥 Step 3: Creating video with synced subtitles...')
    const videoPath = path.join(TEMP_DIR, `shorts_${jobId}.mp4`)
    
    const success = await createVideoWithSyncedSubtitles(
      imagePath,
      audioPath,
      subtitles,
      videoPath
    )

    if (!success || !fs.existsSync(videoPath)) {
      return {
        success: false,
        error: 'Failed to create video'
      }
    }

    // Get final video duration
    const duration = getAudioDuration(videoPath)

    // Upload video to GridFS
    log('☁️ Uploading video to MongoDB GridFS...')
    try {
      await connectDB()
      const videoBuffer = fs.readFileSync(videoPath)
      const videoFileId = await uploadToGridFS(
        videoBuffer,
        `shorts_${jobId}.mp4`,
        {
          jobId,
          userId,
          type: 'video',
          duration,
        }
      )

      // Save file reference to MongoDB
      await MediaFile.create({
        fileId: videoFileId,
        filename: `shorts_${jobId}.mp4`,
        type: 'video',
        jobId,
        userId: new mongoose.Types.ObjectId(userId),
        size: videoBuffer.length,
        mimeType: 'video/mp4',
      })

      log(`✅ Video uploaded to GridFS! File ID: ${videoFileId}`)

      // Cleanup temp files (including video)
      cleanupJobFiles(jobId)
      // Also delete the video file from temp
      if (fs.existsSync(videoPath)) {
        fs.unlinkSync(videoPath)
      }

      return {
        success: true,
        videoPath, // Keep for backward compatibility (will be deleted)
        videoFileId, // GridFS file ID
        duration,
      }
    } catch (uploadError: unknown) {
      const err = uploadError as { message?: string }
      console.error('GridFS upload error:', err)
      log(`⚠️ Failed to upload to GridFS: ${err.message || 'Unknown error'}`)
      
      // Return success with local path if upload fails (fallback)
      return {
        success: true,
        videoPath,
        duration,
      }
    }
    
    return {
      success: true,
      videoPath,
      duration
    }
  } catch (error) {
    const err = error as Error
    console.error('Video generation error:', err)
    return {
      success: false,
      error: err.message
    }
  }
}
