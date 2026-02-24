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
  const MAX_RETRIES = 5 // Increased retries for better reliability
  const RETRY_DELAY = 3000 // 3 seconds base delay
  
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
      console.error('⏱️ Image generation timeout after 90 seconds')
    }, 90000) // 90s timeout (increased for reliability)
    
    let response: Response
    try {
      response = await fetch(imageUrl, { 
        signal: controller.signal,
        headers: { 
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'image/jpeg,image/png,image/webp,*/*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': 'https://pollinations.ai/',
          'Cache-Control': 'no-cache'
        },
        // Add redirect handling
        redirect: 'follow'
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
      
      // HTTP 530 is Cloudflare error - usually temporary, retry with longer delay
      if (response.status === 530) {
        console.log(`⚠️ Cloudflare error (530) detected - this is usually temporary`)
        if (retryCount < MAX_RETRIES) {
          const extendedDelay = RETRY_DELAY * (retryCount + 2) // Longer delay for 530 errors
          console.log(`🔄 Retrying in ${extendedDelay}ms...`)
          await new Promise(resolve => setTimeout(resolve, extendedDelay))
          return generateVerticalImage(prompt, jobId, retryCount + 1)
        }
      }
      
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
 * Get audio duration using ffmpeg (works for both audio and video)
 * ffmpeg-static includes ffmpeg but not ffprobe, so we use ffmpeg's stderr output
 */
function getAudioDuration(audioPath: string): number {
  try {
    if (!ffmpegPath) {
      console.log('⚠️ FFmpeg not available, using default duration 10s')
      return 10
    }
    
    if (!fs.existsSync(audioPath)) {
      console.log(`⚠️ Audio file not found: ${audioPath}`)
      return 10
    }
    
    // Use ffmpeg to get duration from stderr output
    // FFmpeg outputs: Duration: HH:MM:SS.mm, start: ...
    const output = execSync(
      `"${ffmpegPath}" -i "${audioPath}" 2>&1 | grep -E "Duration:" | head -1 | sed -E 's/.*Duration: ([0-9:]+\\.[0-9]+).*/\\1/' || echo "00:00:10.00"`,
      { encoding: 'utf8', timeout: 10000, stdio: 'pipe' }
    ).trim()
    
    if (!output || output === '00:00:10.00') {
      return 10
    }
    
    // Parse HH:MM:SS.mm format
    const parts = output.split(':')
    if (parts.length === 3) {
      const hours = parseFloat(parts[0]) || 0
      const minutes = parseFloat(parts[1]) || 0
      const seconds = parseFloat(parts[2]) || 0
      const totalSeconds = hours * 3600 + minutes * 60 + seconds
      return totalSeconds > 0 ? totalSeconds : 10
    }
    
    return 10
  } catch (error) {
    const err = error as Error
    console.log(`⚠️ Could not get audio duration: ${err.message}, using default 10s`)
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
    
    // Use a base path - we'll determine the actual format based on what succeeds
    const audioBasePath = path.join(TEMP_DIR, `shorts_audio_${jobId}`)
    let mp3Path = `${audioBasePath}.mp3`
    let actualAudioPath: string | null = null
    
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
    
    // Method 1: Try HTTP-based TTS (Google Translate TTS - PRIMARY METHOD for Render)
    // This works on all platforms including Render/Linux - most reliable
    if (!audioGenerated) {
      try {
        console.log('📢 Trying HTTP-based TTS (Google Translate - works on Render)...')
        const ttsLang = language === 'hindi' ? 'hi' : 'en'
        
        // Google Translate TTS has ~200 char limit, so split long text
        const maxChunkLength = 150 // Reduced for better reliability
        const textChunks: string[] = []
        
        if (cleanText.length <= maxChunkLength) {
          textChunks.push(cleanText)
        } else {
          // Split by sentences first, then by words
          const sentences = cleanText.match(/[^.!?]+[.!?]+/g) || [cleanText]
          let currentChunk = ''
          
          for (const sentence of sentences) {
            if ((currentChunk + sentence).length <= maxChunkLength) {
              currentChunk += sentence
            } else {
              if (currentChunk) textChunks.push(currentChunk.trim())
              // If single sentence is too long, split by words
              if (sentence.length > maxChunkLength) {
                const words = sentence.split(' ')
                let wordChunk = ''
                for (const word of words) {
                  if ((wordChunk + ' ' + word).length <= maxChunkLength) {
                    wordChunk += (wordChunk ? ' ' : '') + word
                  } else {
                    if (wordChunk) textChunks.push(wordChunk.trim())
                    wordChunk = word
                  }
                }
                if (wordChunk) currentChunk = wordChunk
              } else {
                currentChunk = sentence
              }
            }
          }
          if (currentChunk) textChunks.push(currentChunk.trim())
        }
        
        console.log(`   Splitting text into ${textChunks.length} chunks for TTS...`)
        
        const audioChunks: Buffer[] = []
        let failedChunks = 0
        const maxFailures = Math.ceil(textChunks.length * 0.3) // Allow 30% failures
        
        for (let i = 0; i < textChunks.length; i++) {
          const chunk = textChunks[i]
          if (!chunk.trim()) continue
          
          try {
            const encodedText = encodeURIComponent(chunk)
            // Use different Google TTS endpoints for better reliability
            const endpoints = [
              `https://translate.google.com/translate_tts?ie=UTF-8&tl=${ttsLang}&client=tw-ob&q=${encodedText}`,
              `https://translate.google.com/translate_tts?ie=UTF-8&tl=${ttsLang}&client=gtx&q=${encodedText}`,
              `https://translate.google.com/translate_tts?ie=UTF-8&tl=${ttsLang}&q=${encodedText}`
            ]
            
            let chunkSuccess = false
            for (let endpointIdx = 0; endpointIdx < endpoints.length && !chunkSuccess; endpointIdx++) {
              try {
                console.log(`   Fetching chunk ${i + 1}/${textChunks.length} (${chunk.length} chars) [endpoint ${endpointIdx + 1}]...`)
                
                const controller = new AbortController()
                const timeoutId = setTimeout(() => controller.abort(), 20000) // 20s timeout per chunk
                
                const response = await fetch(endpoints[endpointIdx], {
                  headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'audio/mpeg, audio/*',
                    'Referer': 'https://translate.google.com/',
                    'Accept-Language': 'en-US,en;q=0.9'
                  },
                  signal: controller.signal,
                  redirect: 'follow'
                })
                
                clearTimeout(timeoutId)
                
                if (response.ok && response.headers.get('content-type')?.includes('audio')) {
                  const audioBuffer = await response.arrayBuffer()
                  const buffer = Buffer.from(audioBuffer)
                  if (buffer.length > 500) { // Minimum size check
                    audioChunks.push(buffer)
                    console.log(`   ✅ Chunk ${i + 1} received: ${buffer.length} bytes`)
                    chunkSuccess = true
                  } else {
                    console.log(`   ⚠️ Chunk ${i + 1} too small: ${buffer.length} bytes`)
                  }
                } else {
                  console.log(`   ⚠️ Chunk ${i + 1} endpoint ${endpointIdx + 1} failed: ${response.status}`)
                }
              } catch (endpointError) {
                const err = endpointError as Error
                if (err.name !== 'AbortError') {
                  console.log(`   ⚠️ Chunk ${i + 1} endpoint ${endpointIdx + 1} error: ${err.message}`)
                }
              }
            }
            
            if (!chunkSuccess) {
              failedChunks++
              console.log(`   ❌ Chunk ${i + 1} failed on all endpoints`)
              if (failedChunks > maxFailures) {
                console.log(`   ❌ Too many chunk failures (${failedChunks}/${textChunks.length}), stopping`)
                break
              }
            }
            
            // Progressive delay between requests to avoid rate limiting
            // Longer delays for production stability on Render
            if (i < textChunks.length - 1) {
              const delay = Math.min(2000 + (i * 400), 5000) // 2s to 5s delay (production-safe)
              console.log(`   Waiting ${delay}ms before next chunk...`)
              await new Promise(resolve => setTimeout(resolve, delay))
            }
          } catch (chunkError) {
            const err = chunkError as Error
            failedChunks++
            console.log(`   ❌ Chunk ${i + 1} error: ${err.message}`)
            if (failedChunks > maxFailures) {
              console.log(`   ❌ Too many chunk failures (${failedChunks}/${textChunks.length}), stopping`)
              break
            }
          }
        }
        
        // Need at least 50% of chunks to succeed (or at least 1 chunk)
        const minRequiredChunks = Math.max(1, Math.ceil(textChunks.length * 0.5))
        const receivedChunks = audioChunks.length
        if (receivedChunks >= minRequiredChunks) {
          try {
            // Combine all audio chunks efficiently
            console.log(`   Combining ${receivedChunks} audio chunks...`)
            const combinedBuffer = Buffer.concat(audioChunks)
            
            // Clear chunks array to free memory immediately
            audioChunks.length = 0
            
            if (combinedBuffer.length > 1000) {
              fs.writeFileSync(mp3Path, combinedBuffer)
              console.log(`✅ HTTP-based TTS succeeded! Combined audio size: ${combinedBuffer.length} bytes (${receivedChunks}/${textChunks.length} chunks)`)
              audioGenerated = true
            } else {
              console.log(`⚠️ Combined audio too small: ${combinedBuffer.length} bytes`)
            }
          } catch (combineError) {
            const err = combineError as Error
            console.log(`❌ Failed to combine audio chunks: ${err.message}`)
          }
        } else {
          console.log(`❌ Not enough audio chunks received: ${receivedChunks}/${textChunks.length} (need ${minRequiredChunks})`)
          // Clear chunks to free memory
          audioChunks.length = 0
        }
      } catch (httpTtsError) {
        const err = httpTtsError as Error
        console.log(`❌ HTTP-based TTS failed: ${err.message}`)
        if (err.stack) {
          console.log(`   Stack: ${err.stack.split('\n').slice(0, 3).join('\n')}`)
        }
      }
    }
    
    // Method 2: Try edge-tts via Python shell command (works for both languages)
    // Usually fails on Render, but try anyway
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
    
    // Method 3: Try edge-tts-node npm package (works on all platforms)
    if (!audioGenerated) {
      try {
        console.log('📢 Trying edge-tts-node npm package...')
        const edgeTTSModule = await import('edge-tts-node').catch((err) => {
          console.log(`❌ edge-tts-node import error: ${(err as Error).message}`)
          return null
        })
        
        if (edgeTTSModule) {
          const edgeVoice = VOICE_MAP[voice] || (language === 'hindi' ? 'hi-IN-SwaraNeural' : 'en-US-JennyNeural')
          console.log(`   Using voice: ${edgeVoice}`)
          console.log(`   Text length: ${cleanText.length} characters`)
          
          let tts: any = null
          try {
            // Use edge-tts-node MsEdgeTTS class
            const { MsEdgeTTS, OUTPUT_FORMAT } = edgeTTSModule
            tts = new MsEdgeTTS({ enableLogger: false })
            
            // Try webm format first (most reliable)
            console.log('   Setting metadata for WebM format...')
            await tts.setMetadata(edgeVoice, OUTPUT_FORMAT.WEBM_24KHZ_16BIT_MONO_OPUS)
            
            const webmPath = path.join(TEMP_DIR, `shorts_audio_${jobId}.webm`)
            console.log('   Generating audio to file...')
            await tts.toFile(webmPath, cleanText)
            
            // Check if webm file was created
            if (fs.existsSync(webmPath)) {
              const stats = fs.statSync(webmPath)
              console.log(`   WebM file created: ${stats.size} bytes`)
              
              if (stats.size > 1000) {
                // Convert webm to mp3 using ffmpeg if available
                if (ffmpegPath) {
                  try {
                    console.log('   Converting webm to mp3 with FFmpeg...')
                    execSync(`"${ffmpegPath}" -y -i "${webmPath}" -ar 44100 -ac 1 -b:a 192k "${mp3Path}"`, {
                      timeout: 30000,
                      stdio: 'pipe'
                    })
                    
                    if (fs.existsSync(mp3Path)) {
                      const mp3Stats = fs.statSync(mp3Path)
                      if (mp3Stats.size > 1000) {
                        console.log(`✅ edge-tts-node succeeded! MP3 size: ${mp3Stats.size} bytes`)
                        audioGenerated = true
                        if (fs.existsSync(webmPath)) fs.unlinkSync(webmPath)
                      } else {
                        console.log(`⚠️ MP3 file too small (${mp3Stats.size} bytes), using webm directly`)
                        fs.copyFileSync(webmPath, mp3Path)
                        audioGenerated = true
                        if (fs.existsSync(webmPath)) fs.unlinkSync(webmPath)
                      }
                    } else {
                      console.log('⚠️ MP3 file not created, using webm directly')
                      fs.copyFileSync(webmPath, mp3Path)
                      audioGenerated = true
                      if (fs.existsSync(webmPath)) fs.unlinkSync(webmPath)
                    }
                  } catch (convertError) {
                    const convertErr = convertError as Error
                    console.log(`⚠️ FFmpeg conversion failed: ${convertErr.message}`)
                    console.log(`   Using webm directly (FFmpeg can handle webm in video)`)
                    // Use webm directly - FFmpeg can handle webm in video creation
                    fs.copyFileSync(webmPath, mp3Path)
                    console.log('✅ edge-tts-node succeeded (webm format)!')
                    audioGenerated = true
                    if (fs.existsSync(webmPath)) fs.unlinkSync(webmPath)
                  }
                } else {
                  // No ffmpeg, use webm directly
                  console.log('   No FFmpeg available, using webm directly')
                  fs.copyFileSync(webmPath, mp3Path)
                  console.log('✅ edge-tts-node succeeded (webm format, no conversion)!')
                  audioGenerated = true
                  if (fs.existsSync(webmPath)) fs.unlinkSync(webmPath)
                }
              } else {
                console.log(`⚠️ WebM file too small (${stats.size} bytes), trying MP3 format...`)
                if (fs.existsSync(webmPath)) fs.unlinkSync(webmPath)
                
                // Try MP3 format as fallback
                try {
                  console.log('   Setting metadata for MP3 format...')
                  await tts.setMetadata(edgeVoice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3)
                  
                  console.log('   Generating MP3 audio...')
                  await tts.toFile(mp3Path, cleanText)
                  
                  if (fs.existsSync(mp3Path)) {
                    const mp3Stats = fs.statSync(mp3Path)
                    console.log(`   MP3 file created: ${mp3Stats.size} bytes`)
                    if (mp3Stats.size > 1000) {
                      console.log('✅ edge-tts-node succeeded with MP3!')
                      audioGenerated = true
                    } else {
                      console.log(`⚠️ MP3 file too small (${mp3Stats.size} bytes)`)
                      if (fs.existsSync(mp3Path)) fs.unlinkSync(mp3Path)
                    }
                  }
                } catch (mp3Error) {
                  const mp3Err = mp3Error as Error
                  console.log(`❌ MP3 format also failed: ${mp3Err.message}`)
                }
              }
            } else {
              console.log('❌ WebM file was not created')
            }
            
            // Close TTS connection
            if (tts) {
              try {
                tts.close()
              } catch (closeError) {
                // Ignore close errors
              }
            }
          } catch (edgeError) {
            const err = edgeError as Error
            console.log(`❌ edge-tts-node generation failed: ${err.message}`)
            console.log(`   Error type: ${err.constructor.name}`)
            if (err.stack) {
              console.log(`   Stack: ${err.stack.split('\n').slice(0, 5).join('\n')}`)
            }
            
            // Close TTS connection on error
            if (tts) {
              try {
                tts.close()
              } catch (closeError) {
                // Ignore close errors
              }
            }
          }
        } else {
          console.log('❌ edge-tts-node module not available')
        }
      } catch (importError) {
        const err = importError as Error
        console.log('❌ edge-tts-node import failed:', err.message)
        if (err.stack) {
          console.log(`   Stack: ${err.stack.split('\n').slice(0, 3).join('\n')}`)
        }
      }
    }
    
    // Method 4: For English - use macOS say (very natural Samantha voice) - only on macOS
    if (!audioGenerated && language === 'english' && process.platform === 'darwin') {
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
    
    // Method 5: Final fallback - use macOS say with any available voice for Hindi (only on macOS)
    if (!audioGenerated && language === 'hindi' && process.platform === 'darwin') {
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
    // Check for both mp3 and webm formats
    const webmPath = `${audioBasePath}.webm`
    if (audioGenerated) {
      // Determine which file actually exists
      if (fs.existsSync(mp3Path) && fs.statSync(mp3Path).size > 1000) {
        actualAudioPath = mp3Path
      } else if (fs.existsSync(webmPath) && fs.statSync(webmPath).size > 1000) {
        actualAudioPath = webmPath
        // Copy webm to mp3 path for compatibility (FFmpeg will handle it)
        fs.copyFileSync(webmPath, mp3Path)
      }
      
      if (actualAudioPath && fs.existsSync(actualAudioPath)) {
        const duration = getAudioDuration(actualAudioPath)
        console.log(`✅ Final audio duration: ${duration.toFixed(1)}s`)
        console.log(`✅ Audio file: ${actualAudioPath} (${fs.statSync(actualAudioPath).size} bytes)`)
        
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
        
        // Return mp3Path (even if it's actually webm copied to mp3, FFmpeg can handle it)
        return { audioPath: mp3Path, subtitles }
      } else {
        console.log('⚠️ Audio file not found or too small after generation')
        audioGenerated = false
      }
    }
    
    // If we got here, all methods failed
    const errorMsg = language === 'hindi' 
      ? 'All audio generation methods failed for Hindi. Tried: HTTP-based TTS (Google), Python edge-tts, edge-tts-node npm package, macOS say fallback.'
      : 'All audio generation methods failed. Tried: HTTP-based TTS (Google), Python edge-tts, edge-tts-node npm package, macOS say.'
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
      console.error('❌ FFmpeg not found - cannot create video')
      resolve(false)
      return
    }
    
    if (!fs.existsSync(ffmpegPath)) {
      console.error(`❌ FFmpeg executable not found at: ${ffmpegPath}`)
      resolve(false)
      return
    }
    
    if (!fs.existsSync(imagePath)) {
      console.error(`❌ Image file not found: ${imagePath}`)
      resolve(false)
      return
    }
    
    if (!fs.existsSync(audioPath)) {
      console.error(`❌ Audio file not found: ${audioPath}`)
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
    
    const proc = spawn(ffmpegPath, args, {
      stdio: ['ignore', 'pipe', 'pipe']
    }) as any
    let stderr = ''
    let stdout = ''

    // Set timeout (90 seconds max) - increased for reliability
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true
        console.error('❌ FFmpeg timeout after 90 seconds - killing process')
        try {
          proc.kill('SIGKILL')
          // Force cleanup after kill
          setTimeout(() => {
            try {
              if (proc && !proc.killed) {
                proc.kill('SIGTERM')
              }
            } catch (e) {
              // Ignore cleanup errors
            }
          }, 1000)
        } catch (killError) {
          console.error('Error killing FFmpeg process:', killError)
        }
        if (fs.existsSync(assPath)) {
          try {
            fs.unlinkSync(assPath)
          } catch (e) {
            // Ignore cleanup errors
          }
        }
        resolve(false)
      }
    }, 90000)

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
        
        const fallback = spawn(ffmpegPath, fallbackArgs, {
          stdio: ['ignore', 'pipe', 'pipe']
        }) as any
        
        let fallbackStderr = ''
        fallback.stderr?.on('data', (data: Buffer) => {
          fallbackStderr += data.toString()
        })
        
        // Set timeout for fallback
        const fallbackKillTimeout = setTimeout(() => {
          if (!fallbackResolved) {
            fallbackResolved = true
            clearTimeout(fallbackTimeout)
            console.error('❌ Fallback FFmpeg timeout - killing process')
            try {
              fallback.kill('SIGKILL')
            } catch (e) {
              // Ignore
            }
            resolve(false)
          }
        }, 90000)
        
        fallback.on('close', (fallbackCode: number) => {
          if (fallbackResolved) return
          clearTimeout(fallbackKillTimeout)
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
        error: 'AUDIO_GENERATION_FAILED',
        errorMessage: language === 'hindi' 
          ? 'Failed to generate audio. Tried: Python edge-tts, HTTP-based TTS (Google), edge-tts-node npm package, macOS say fallback.'
          : 'Failed to generate audio. Tried: Python edge-tts, HTTP-based TTS (Google), edge-tts-node npm package, macOS say.'
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
