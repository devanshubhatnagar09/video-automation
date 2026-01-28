import axios from 'axios'

// Use relative URL - works for both local dev (via Vite proxy) and Vercel
const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 120000, // 2 minute timeout for long operations
})

export interface GenerateVideoResponse {
  success: boolean
  data?: {
    id: string
    idea: string
    prompt: string
    title: string
    description: string
    videoUrl?: string
    youtubeUrl?: string
  }
  error?: string
}

export interface WorkflowStatusResponse {
  success: boolean
  step: string
  status: 'running' | 'completed' | 'error'
  message?: string
  data?: Record<string, unknown>
}

// Gemini API
export const verifyGeminiKey = async (apiKey: string): Promise<{ valid: boolean; error?: string }> => {
  try {
    const response = await api.post('/gemini/verify', { apiKey })
    return response.data
  } catch (error: unknown) {
    const err = error as { response?: { data?: { error?: string } } }
    return { valid: false, error: err.response?.data?.error || 'Failed to verify API key' }
  }
}

// YouTube API
export const getYoutubeAuthUrl = async (): Promise<{ url: string }> => {
  const response = await api.get('/youtube/auth-url')
  return response.data
}

export const handleYoutubeCallback = async (code: string): Promise<{ success: boolean; channel?: string }> => {
  const response = await api.post('/youtube/callback', { code })
  return response.data
}

export const disconnectYoutube = async (): Promise<{ success: boolean }> => {
  const response = await api.post('/youtube/disconnect')
  return response.data
}

// Workflow API
export const triggerWorkflow = async (
  geminiApiKey: string,
  onProgress?: (status: WorkflowStatusResponse) => void
): Promise<GenerateVideoResponse> => {
  const eventSource = new EventSource(`/api/workflow/start?apiKey=${encodeURIComponent(geminiApiKey)}`)
  
  return new Promise((resolve, reject) => {
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data)
      
      if (data.type === 'progress' && onProgress) {
        onProgress(data)
      }
      
      if (data.type === 'complete') {
        eventSource.close()
        resolve(data)
      }
      
      if (data.type === 'error') {
        eventSource.close()
        reject(new Error(data.error))
      }
    }
    
    eventSource.onerror = () => {
      eventSource.close()
      reject(new Error('Connection lost'))
    }
  })
}

// Trigger workflow with POST (alternative)
export const startWorkflow = async (geminiApiKey: string): Promise<{ jobId: string }> => {
  const response = await api.post('/workflow/start', { geminiApiKey })
  return response.data
}

export const getWorkflowStatus = async (jobId: string): Promise<WorkflowStatusResponse> => {
  const response = await api.get(`/workflow/status?jobId=${jobId}`)
  return response.data
}

// Cron settings
export const updateCronSettings = async (enabled: boolean, time: string): Promise<{ success: boolean }> => {
  const response = await api.post('/cron/settings', { enabled, time })
  return response.data
}

export const getCronStatus = async (): Promise<{ enabled: boolean; time: string; lastRun?: string; nextRun?: string }> => {
  const response = await api.get('/cron/status')
  return response.data
}

// History
export const getVideoHistory = async (): Promise<{ videos: GenerateVideoResponse['data'][] }> => {
  const response = await api.get('/history')
  return response.data
}

// Logs
export interface LogEntry {
  timestamp: string
  type: 'input' | 'output' | 'info' | 'error' | 'step'
  step: string
  message: string
  data?: unknown
  jobId?: string
}

export const getJobLogs = async (jobId: string): Promise<{ logs: LogEntry[] }> => {
  const response = await api.get(`/workflow/logs?jobId=${jobId}`)
  return response.data
}

export const getAllLogs = async (): Promise<{ logs: LogEntry[] }> => {
  const response = await api.get('/workflow/logs')
  return response.data
}

// Video Settings (voice/language)
export interface VideoSettings {
  voice: string
  language: string
}

export const updateVideoSettings = async (settings: Partial<VideoSettings>): Promise<{ success: boolean; settings: VideoSettings }> => {
  const response = await api.post('/workflow/settings', settings)
  return response.data
}

export const getVideoSettings = async (): Promise<{ settings: VideoSettings }> => {
  const response = await api.get('/workflow/settings')
  return response.data
}

export default api
