import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { geminiRouter } from './routes/gemini.js'
import { youtubeRouter } from './routes/youtube.js'
import { workflowRouter } from './routes/workflow.js'
import { cronRouter } from './routes/cron.js'
import { historyRouter } from './routes/history.js'
import { initCronJobs } from './cron/scheduler.js'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

// Middleware - CORS configuration
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:3000',
  'http://localhost:5173', // Vite dev server
].filter(Boolean) as string[]

const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true)
    
    if (allowedOrigins.includes(origin) || process.env.NODE_ENV === 'development') {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
}
app.use(cors(corsOptions))
app.use(express.json())

// Health check
app.get('/api/health', (_, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Routes
app.use('/api/gemini', geminiRouter)
app.use('/api/youtube', youtubeRouter)
app.use('/api/workflow', workflowRouter)
app.use('/api/cron', cronRouter)
app.use('/api/history', historyRouter)

// Initialize cron jobs
initCronJobs()

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Error:', err.message)
  res.status(500).json({ error: err.message })
})

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`)
  console.log(`📺 Video Automation API ready`)
})

export default app
