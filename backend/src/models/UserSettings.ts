import mongoose, { Schema, Document } from 'mongoose'

export interface IUserSettings extends Document {
  userId: mongoose.Types.ObjectId
  // Encrypted fields
  geminiApiKey?: string // Encrypted
  youtubeClientId?: string // Encrypted
  youtubeClientSecret?: string // Encrypted
  youtubeRedirectUri?: string // Encrypted
  youtubeTokens?: {
    access_token?: string // Encrypted
    refresh_token?: string // Encrypted
    expiry_date?: number
  }
  createdAt: Date
  updatedAt: Date
}

const UserSettingsSchema = new Schema<IUserSettings>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    geminiApiKey: {
      type: String,
      // Stored encrypted
    },
    youtubeClientId: {
      type: String,
      // Stored encrypted
    },
    youtubeClientSecret: {
      type: String,
      // Stored encrypted
    },
    youtubeRedirectUri: {
      type: String,
      // Stored encrypted
    },
    youtubeTokens: {
      access_token: String, // Encrypted
      refresh_token: String, // Encrypted
      expiry_date: Number,
    },
  },
  {
    timestamps: true,
    collection: 'user_settings',
  }
)

// Index for faster lookups
UserSettingsSchema.index({ userId: 1 })

export const UserSettings = mongoose.models.UserSettings || mongoose.model<IUserSettings>('UserSettings', UserSettingsSchema)
