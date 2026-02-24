import mongoose from 'mongoose'
import { Readable } from 'stream'
import connectDB from '../db/mongodb.js'

let gridFSBucket: mongoose.mongo.GridFSBucket | null = null

/**
 * Initialize GridFS bucket for file storage
 */
async function getGridFSBucket(): Promise<mongoose.mongo.GridFSBucket> {
  await connectDB()
  
  if (!mongoose.connection.db) {
    throw new Error('MongoDB connection not established')
  }
  
  if (!gridFSBucket) {
    gridFSBucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
      bucketName: 'videos'
    })
  }
  return gridFSBucket
}

/**
 * Upload file to GridFS
 */
export async function uploadToGridFS(
  fileBuffer: Buffer,
  filename: string,
  metadata?: Record<string, unknown>
): Promise<string> {
  const bucket = await getGridFSBucket()
  
  return new Promise((resolve, reject) => {
    const readableStream = Readable.from(fileBuffer)
    const uploadStream = bucket.openUploadStream(filename, {
      metadata: metadata || {}
    })
    
    readableStream.pipe(uploadStream)
    
    uploadStream.on('finish', () => {
      resolve(uploadStream.id.toString())
    })
    
    uploadStream.on('error', (error: Error) => {
      reject(error)
    })
  })
}

/**
 * Download file from GridFS
 */
export async function downloadFromGridFS(fileId: string): Promise<Buffer> {
  const bucket = await getGridFSBucket()
  const ObjectId = mongoose.Types.ObjectId
  
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    const downloadStream = bucket.openDownloadStream(new ObjectId(fileId))
    
    downloadStream.on('data', (chunk: Buffer) => {
      chunks.push(chunk)
    })
    
    downloadStream.on('end', () => {
      resolve(Buffer.concat(chunks))
    })
    
    downloadStream.on('error', (error: Error) => {
      reject(error)
    })
  })
}

/**
 * Delete file from GridFS
 */
export async function deleteFromGridFS(fileId: string): Promise<void> {
  const bucket = await getGridFSBucket()
  const ObjectId = mongoose.Types.ObjectId
  
  try {
    await bucket.delete(new ObjectId(fileId))
  } catch (error) {
    throw error
  }
}

/**
 * Get file info from GridFS
 */
export async function getFileInfo(fileId: string): Promise<{
  filename: string
  length: number
  uploadDate: Date
  metadata?: Record<string, unknown>
} | null> {
  const bucket = await getGridFSBucket()
  const ObjectId = mongoose.Types.ObjectId
  
  try {
    const files = await bucket.find({ _id: new ObjectId(fileId) }).toArray()
    
    if (files && files.length > 0) {
      const file = files[0]
      return {
        filename: file.filename,
        length: file.length,
        uploadDate: file.uploadDate,
        metadata: file.metadata
      }
    }
    
    return null
  } catch (error) {
    throw error
  }
}
