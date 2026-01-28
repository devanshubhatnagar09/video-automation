import mongoose from 'mongoose'

// MongoDB connection for Vercel serverless functions
// Uses connection pooling to handle multiple function invocations

let cached = global.mongoose

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null }
}

async function connectDB() {
  const MONGODB_URI = process.env.MONGODB_URI

  if (!MONGODB_URI) {
    throw new Error('Please define MONGODB_URI environment variable')
  }

  // If already connected, return cached connection
  if (cached.conn) {
    return cached.conn
  }

  // If connection is in progress, wait for it
  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
    }

    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
      console.log('[MongoDB] Connected successfully')
      return mongoose
    }).catch((err) => {
      console.error('[MongoDB] Connection error:', err)
      cached.promise = null
      throw err
    })
  }

  try {
    cached.conn = await cached.promise
  } catch (e) {
    cached.promise = null
    throw e
  }

  return cached.conn
}

export default connectDB

// TypeScript global declaration
declare global {
  var mongoose: {
    conn: typeof mongoose | null
    promise: Promise<typeof mongoose> | null
  }
}
