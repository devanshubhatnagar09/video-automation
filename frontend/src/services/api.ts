import axios from 'axios'
import { encryptData } from '../utils/encryption.js'

// API URL configuration
// Development: local backend (http://localhost:3001)
// Production: Render backend (from VITE_API_URL or default)
const getApiUrl = () => {
  // Check if we're in development
  if (import.meta.env.DEV) {
    return 'http://localhost:3001/api'
  }
  
  // Production: Use environment variable or default Render URL
  const apiUrl = import.meta.env.VITE_API_URL || 'https://your-backend.onrender.com'
  return `${apiUrl}/api`
}

const api = axios.create({
  baseURL: getApiUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 120000, // 2 minute timeout for long operations
})

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
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

// Auth API
export const signup = async (email: string, password: string, name: string): Promise<{ success: boolean; token?: string; user?: { id: string; email: string; name: string }; error?: string }> => {
  try {
    const response = await api.post('/auth/signup', { email, password, name })
    if (response.data.token) {
      localStorage.setItem('authToken', response.data.token)
      localStorage.setItem('user', JSON.stringify(response.data.user))
    }
    return response.data
  } catch (error: unknown) {
    const err = error as { response?: { data?: { error?: string } } }
    return { success: false, error: err.response?.data?.error || 'Failed to sign up' }
  }
}

export const login = async (email: string, password: string): Promise<{ success: boolean; token?: string; user?: { id: string; email: string; name: string }; error?: string }> => {
  try {
    const response = await api.post('/auth/login', { email, password })
    if (response.data.token) {
      localStorage.setItem('authToken', response.data.token)
      localStorage.setItem('user', JSON.stringify(response.data.user))
    }
    return response.data
  } catch (error: unknown) {
    const err = error as { response?: { data?: { error?: string } } }
    return { success: false, error: err.response?.data?.error || 'Failed to login' }
  }
}

export const logout = () => {
  localStorage.removeItem('authToken')
  localStorage.removeItem('user')
}

export const getCurrentUser = () => {
  const userStr = localStorage.getItem('user')
  return userStr ? JSON.parse(userStr) : null
}

// Gemini API - encrypts API key before sending
export const verifyGeminiKey = async (apiKey: string): Promise<{ valid: boolean; error?: string }> => {
  try {
    const encryptedApiKey = await encryptData(apiKey)
    const response = await api.post('/gemini/verify', { encryptedApiKey })
    return response.data
  } catch (error: unknown) {
    const err = error as { response?: { data?: { error?: string } } }
    return { valid: false, error: err.response?.data?.error || 'Failed to verify API key' }
  }
}

// YouTube API
export const saveYouTubeCredentials = async (
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const encryptedClientId = await encryptData(clientId)
    const encryptedClientSecret = await encryptData(clientSecret)
    const encryptedRedirectUri = await encryptData(redirectUri)
    
    const response = await api.post('/youtube/credentials', {
      encryptedClientId,
      encryptedClientSecret,
      encryptedRedirectUri,
    })
    return response.data
  } catch (error: unknown) {
    const err = error as { response?: { data?: { error?: string } } }
    return { success: false, error: err.response?.data?.error || 'Failed to save credentials' }
  }
}

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

// Trigger workflow with POST (uses stored API key from MongoDB)
export const startWorkflow = async (): Promise<{ jobId: string }> => {
  const response = await api.post('/workflow/start', {})
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
