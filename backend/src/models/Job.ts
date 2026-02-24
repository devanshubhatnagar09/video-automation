import mongoose, { Schema, Document } from 'mongoose'

export interface IJob extends Document {
  jobId: string
  userId: mongoose.Types.ObjectId
  status: 'running' | 'completed' | 'error'
  step: string
  message?: string
  data?: Record<string, unknown>
  error?: string
  logs: Array<{
    type: string
    step: string
    message: string
    data?: unknown
    timestamp: string
  }>
  createdAt: Date
  updatedAt: Date
}

const LogSchema = new Schema({
  type: { type: String, required: true },
  step: { type: String, required: true },
  message: { type: String, required: true },
  data: { type: Schema.Types.Mixed },
  timestamp: { type: String, required: true }
}, { _id: false })

const JobSchema = new Schema<IJob>({
  jobId: { 
    type: String, 
    required: true, 
    unique: true,
    index: true 
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  status: { 
    type: String, 
    enum: ['running', 'completed', 'error'],
    required: true,
    default: 'running'
  },
  step: { 
    type: String, 
    required: true,
    default: 'idea'
  },
  message: { type: String },
  data: { type: Schema.Types.Mixed },
  error: { type: String },
  logs: { 
    type: [LogSchema], 
    default: [] 
  }
}, {
  timestamps: true,
  collection: 'jobs'
})

// Indexes for faster queries
JobSchema.index({ jobId: 1 })
JobSchema.index({ userId: 1, createdAt: -1 })
JobSchema.index({ status: 1 })

export const Job = mongoose.models.Job || mongoose.model<IJob>('Job', JobSchema)
