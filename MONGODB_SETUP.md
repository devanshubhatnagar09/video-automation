# MongoDB Setup Guide

## MongoDB Integration Complete! 🎉

अब आपका app MongoDB use कर रहा है jobs को save करने के लिए। यह Vercel serverless functions में cold starts के बाद भी jobs persist रहेंगे।

## Setup Steps

### 1. MongoDB Atlas (Free) - Recommended

1. **Sign up**: https://www.mongodb.com/cloud/atlas
2. **Create Cluster**: 
   - Choose **FREE** tier (M0)
   - Select region closest to you
   - Click "Create Cluster"
3. **Create Database User**:
   - Go to **Database Access** → **Add New Database User**
   - Username: `video-automation`
   - Password: Generate secure password (save it!)
   - Database User Privileges: **Read and write to any database**
4. **Whitelist IP**:
   - Go to **Network Access** → **Add IP Address**
   - Click **"Allow Access from Anywhere"** (for Vercel)
   - Or add specific IPs
5. **Get Connection String**:
   - Go to **Clusters** → Click **"Connect"**
   - Choose **"Connect your application"**
   - Copy the connection string
   - Replace `<password>` with your database user password
   - Replace `<dbname>` with `video-automation` (optional)

Example:
```
mongodb+srv://video-automation:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/video-automation?retryWrites=true&w=majority
```

### 2. Local MongoDB (Optional)

अगर local development करना है:

```bash
# Install MongoDB locally
# macOS:
brew install mongodb-community

# Start MongoDB
brew services start mongodb-community

# Connection string:
mongodb://localhost:27017/video-automation
```

### 3. Environment Variables

#### Local Development:
`.env.example` file में `MONGODB_URI` add करें:

```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/video-automation?retryWrites=true&w=majority
```

#### Vercel Deployment:
1. Vercel Dashboard → Project → Settings → Environment Variables
2. Add:
   - **Key**: `MONGODB_URI`
   - **Value**: Your MongoDB Atlas connection string
   - **Environment**: Production, Preview, Development (all)

### 4. Install Dependencies

```bash
npm install
```

Mongoose automatically install हो जाएगा।

## How It Works

### Before (In-Memory):
- ❌ Jobs lost on cold start
- ❌ Different function instances can't share data
- ❌ No persistence

### After (MongoDB):
- ✅ Jobs persist across cold starts
- ✅ All function instances share same database
- ✅ Jobs history saved permanently
- ✅ Can query old jobs

## Database Schema

Jobs collection में यह structure है:

```typescript
{
  jobId: string (unique, indexed)
  status: 'running' | 'completed' | 'error'
  step: string
  message?: string
  data?: object
  error?: string
  logs: Array<{
    type: string
    step: string
    message: string
    data?: any
    timestamp: string
  }>
  createdAt: Date
  updatedAt: Date
}
```

## Testing

1. **Start workflow**: `/api/workflow/start`
2. **Check status**: `/api/workflow/status/[jobId]`
3. **View logs**: `/api/workflow/logs/[jobId]`

अब jobs MongoDB में save होंगे और cold starts के बाद भी available रहेंगे!

## Troubleshooting

### Connection Error:
- Check MongoDB URI format
- Verify username/password
- Check IP whitelist (Atlas)
- Check network access

### Jobs Not Found:
- Check MongoDB connection
- Verify `MONGODB_URI` environment variable
- Check Vercel function logs

### Performance:
- MongoDB Atlas free tier is sufficient for most use cases
- Connection pooling automatically handled
- Indexes added for faster queries

## Next Steps

1. ✅ MongoDB setup complete
2. ✅ Jobs persist in database
3. ✅ All endpoints updated
4. 🔄 Deploy to Vercel
5. 🔄 Add `MONGODB_URI` to Vercel environment variables

**Ready to deploy!** 🚀
