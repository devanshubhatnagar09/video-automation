import { Router, Request, Response } from 'express'

export const historyRouter = Router()

// Store video history in memory (use DB in production)
interface VideoRecord {
  id: string
  title: string
  description: string
  idea: string
  prompt: string
  videoUrl?: string
  youtubeUrl?: string
  status: 'generating' | 'uploading' | 'completed' | 'failed'
  createdAt: string
  error?: string
}

const videoHistory: VideoRecord[] = []

// Get all videos
historyRouter.get('/', (_req: Request, res: Response) => {
  res.json({ videos: videoHistory })
})

// Add video record
historyRouter.post('/', (req: Request, res: Response) => {
  const video = req.body as VideoRecord
  video.createdAt = video.createdAt || new Date().toISOString()
  videoHistory.unshift(video)
  res.json({ success: true, video })
})

// Update video record
historyRouter.patch('/:id', (req: Request, res: Response) => {
  const { id } = req.params
  const updates = req.body
  
  const index = videoHistory.findIndex(v => v.id === id)
  if (index === -1) {
    return res.status(404).json({ error: 'Video not found' })
  }
  
  videoHistory[index] = { ...videoHistory[index], ...updates }
  res.json({ success: true, video: videoHistory[index] })
})

// Get single video
historyRouter.get('/:id', (req: Request, res: Response) => {
  const { id } = req.params
  const video = videoHistory.find(v => v.id === id)
  
  if (!video) {
    return res.status(404).json({ error: 'Video not found' })
  }
  
  res.json({ video })
})

// Delete video record
historyRouter.delete('/:id', (req: Request, res: Response) => {
  const { id } = req.params
  const index = videoHistory.findIndex(v => v.id === id)
  
  if (index === -1) {
    return res.status(404).json({ error: 'Video not found' })
  }
  
  videoHistory.splice(index, 1)
  res.json({ success: true })
})
