import mongoose, { Schema, Document } from 'mongoose'

export interface IMediaFile extends Document {
  fileId: string // GridFS file ID
  filename: string
  type: 'image' | 'audio' | 'video'
  jobId: string
  userId: mongoose.Types.ObjectId
  size: number
  mimeType: string
  createdAt: Date
  updatedAt: Date
}

const MediaFileSchema = new Schema<IMediaFile>(
  {
    fileId: {
      type: String,
      required: true,
      index: true,
    },
    filename: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ['image', 'audio', 'video'],
      required: true,
    },
    jobId: {
      type: String,
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    size: {
      type: Number,
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
    collection: 'media_files',
  }
)

// Indexes for faster queries
MediaFileSchema.index({ jobId: 1, type: 1 })
MediaFileSchema.index({ userId: 1, createdAt: -1 })

export const MediaFile = mongoose.models.MediaFile || mongoose.model<IMediaFile>('MediaFile', MediaFileSchema)
