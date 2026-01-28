import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface WorkflowStep {
  id: string
  name: string
  status: 'pending' | 'running' | 'completed' | 'error'
  message?: string
  timestamp?: Date
}

export interface VideoRecord {
  id: string
  title: string
  description: string
  script: string
  imagePrompt: string
  videoPath?: string
  youtubeUrl?: string
  status: 'generating' | 'uploading' | 'completed' | 'failed'
  createdAt: string
  duration?: number
  error?: string
}

export interface Prompts {
  contentPrompt: string
  contentPromptHindi: string
  defaultVoice: string
  defaultStyle: string
  language: 'english' | 'hindi'
}

interface AppState {
  // API Keys
  geminiApiKey: string
  setGeminiApiKey: (key: string) => void
  
  // YouTube Auth
  youtubeConnected: boolean
  youtubeChannel: string | null
  setYoutubeConnected: (connected: boolean, channel?: string) => void
  
  // Workflow
  isRunning: boolean
  currentSteps: WorkflowStep[]
  setIsRunning: (running: boolean) => void
  updateStep: (stepId: string, updates: Partial<WorkflowStep>) => void
  resetWorkflow: () => void
  
  // Prompts
  prompts: Prompts
  setPrompts: (prompts: Partial<Prompts>) => void
  
  // History
  videoHistory: VideoRecord[]
  addVideoRecord: (record: VideoRecord) => void
  updateVideoRecord: (id: string, updates: Partial<VideoRecord>) => void
  clearHistory: () => void
  
  // Settings
  cronEnabled: boolean
  setCronEnabled: (enabled: boolean) => void
  cronTime: string
  setCronTime: (time: string) => void
}

const initialSteps: WorkflowStep[] = [
  { id: 'idea', name: 'Generate Content', status: 'pending' },
  { id: 'video', name: 'Create Video (Image + Audio)', status: 'pending' },
  { id: 'upload', name: 'Upload to YouTube', status: 'pending' },
]

const defaultPrompts: Prompts = {
  contentPrompt: `You are a viral YouTube Shorts content creator. Generate content for a short vertical video (15-30 seconds) in ENGLISH.

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
}`,
  contentPromptHindi: `Tum ek viral YouTube Shorts content creator ho. Ek short vertical video (15-30 seconds) ke liye content generate karo HINDI mein.

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
  "script": "Voiceover narration script (30-50 words, punchy aur engaging, Hindi mein)",
  "imagePrompt": "Background image ka description (visual jo content se match kare, dramatic)",
  "tags": ["#Shorts", "#Hindi", "tag3", "tag4", "tag5"],
  "category": "Education/Entertainment/Motivation/Facts/Comedy"
}`,
  defaultVoice: 'Jenny',
  defaultStyle: 'cinematic',
  language: 'english'
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      // API Keys
      geminiApiKey: '',
      setGeminiApiKey: (key) => set({ geminiApiKey: key }),
      
      // YouTube Auth
      youtubeConnected: false,
      youtubeChannel: null,
      setYoutubeConnected: (connected, channel) => 
        set({ youtubeConnected: connected, youtubeChannel: channel || null }),
      
      // Workflow
      isRunning: false,
      currentSteps: initialSteps,
      setIsRunning: (running) => set({ isRunning: running }),
      updateStep: (stepId, updates) =>
        set((state) => ({
          currentSteps: state.currentSteps.map((step) =>
            step.id === stepId ? { ...step, ...updates } : step
          ),
        })),
      resetWorkflow: () =>
        set({
          currentSteps: initialSteps.map((s) => ({ ...s, status: 'pending' as const, message: undefined })),
        }),
      
      // Prompts
      prompts: defaultPrompts,
      setPrompts: (newPrompts) =>
        set((state) => ({
          prompts: { ...state.prompts, ...newPrompts },
        })),
      
      // History
      videoHistory: [],
      addVideoRecord: (record) =>
        set((state) => ({
          videoHistory: [record, ...state.videoHistory].slice(0, 50), // Keep last 50
        })),
      updateVideoRecord: (id, updates) =>
        set((state) => ({
          videoHistory: state.videoHistory.map((record) =>
            record.id === id ? { ...record, ...updates } : record
          ),
        })),
      clearHistory: () => set({ videoHistory: [] }),
      
      // Settings
      cronEnabled: false,
      setCronEnabled: (enabled) => set({ cronEnabled: enabled }),
      cronTime: '09:00',
      setCronTime: (time) => set({ cronTime: time }),
    }),
    {
      name: 'video-automation-storage',
      partialize: (state) => ({
        geminiApiKey: state.geminiApiKey,
        youtubeConnected: state.youtubeConnected,
        youtubeChannel: state.youtubeChannel,
        videoHistory: state.videoHistory,
        cronEnabled: state.cronEnabled,
        cronTime: state.cronTime,
        prompts: state.prompts,
      }),
    }
  )
)
