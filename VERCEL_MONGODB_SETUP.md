# MongoDB Atlas Setup for Vercel Deployment

## Vercel पर MongoDB कैसे Use करें

Vercel serverless platform है, इसलिए MongoDB server directly host नहीं कर सकते। लेकिन **MongoDB Atlas** (free cloud MongoDB) use कर सकते हैं!

## Step-by-Step Setup

### Step 1: MongoDB Atlas Account बनाएं (FREE)

1. **Sign up**: https://www.mongodb.com/cloud/atlas/register
2. **Free tier select करें**: "M0 Free" (512MB storage, perfect for development)
3. **Account बनाएं**

### Step 2: Cluster Create करें

1. **"Build a Database"** click करें
2. **"M0 FREE"** select करें
3. **Cloud Provider**: AWS (default)
4. **Region**: Choose closest to you (e.g., `Mumbai (ap-south-1)` for India)
5. **Cluster Name**: `video-automation-cluster` (optional)
6. **"Create"** click करें

⏱️ Cluster create होने में 2-3 minutes लगेंगे

### Step 3: Database User बनाएं

1. **"Database Access"** (left sidebar) → **"Add New Database User"**
2. **Authentication Method**: Password
3. **Username**: `video-automation-user`
4. **Password**: 
   - **"Autogenerate Secure Password"** click करें
   - **Password copy करें** (यह दोबारा नहीं दिखेगा!)
   - Save करें: `MONGODB_PASSWORD=your-generated-password`
5. **Database User Privileges**: "Read and write to any database"
6. **"Add User"** click करें

### Step 4: Network Access (IP Whitelist)

1. **"Network Access"** (left sidebar) → **"Add IP Address"**
2. **"Allow Access from Anywhere"** click करें
   - यह Vercel के लिए जरूरी है (Vercel के IP addresses dynamic हैं)
   - या specific IPs add करें: `0.0.0.0/0`
3. **"Confirm"** click करें

### Step 5: Connection String लें

1. **"Clusters"** → अपने cluster पर **"Connect"** click करें
2. **"Connect your application"** select करें
3. **Driver**: Node.js
4. **Version**: 5.5 or later
5. **Connection string copy करें**:
   ```
   mongodb+srv://video-automation-user:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
6. **Password replace करें**: `<password>` को अपने generated password से replace करें
7. **Database name add करें**: `?retryWrites=true&w=majority` से पहले `/video-automation` add करें

**Final connection string:**
```
mongodb+srv://video-automation-user:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/video-automation?retryWrites=true&w=majority
```

### Step 6: Vercel में Environment Variable Add करें

1. **Vercel Dashboard** → अपना project select करें
2. **Settings** → **Environment Variables**
3. **Add New**:
   - **Key**: `MONGODB_URI`
   - **Value**: अपना connection string (Step 5 से)
   - **Environment**: 
     - ✅ Production
     - ✅ Preview  
     - ✅ Development
4. **Save** click करें

### Step 7: Redeploy करें

```bash
# Code push करें
git add .
git commit -m "Add MongoDB Atlas integration"
git push

# Vercel automatically redeploy करेगा
```

या Vercel Dashboard से **"Redeploy"** click करें

## Verify Setup

### Test Connection:

1. **Vercel Dashboard** → **Functions** → किसी भी API route के logs check करें
2. Logs में `[MongoDB] Connected successfully` दिखना चाहिए

### Test Workflow:

1. Workflow start करें
2. Job MongoDB में save होना चाहिए
3. Status check करें - job मिलना चाहिए

## MongoDB Atlas Dashboard में Data देखें

1. **MongoDB Atlas** → **"Browse Collections"**
2. **Database**: `video-automation`
3. **Collection**: `jobs`
4. सभी jobs यहाँ दिखेंगे!

## Important Notes

### ✅ Free Tier Limits:
- **512MB storage** - हज़ारों jobs के लिए काफी है
- **Shared RAM** - small apps के लिए perfect
- **No credit card required** - completely free!

### ✅ Security:
- Password strong रखें
- IP whitelist properly configure करें
- Connection string को कभी public न करें

### ✅ Performance:
- Atlas free tier production के लिए भी sufficient है
- Auto-scaling available (paid plans)
- Global clusters available

## Troubleshooting

### Connection Error:
```
Error: getaddrinfo ENOTFOUND cluster0.xxxxx.mongodb.net
```
**Fix**: 
- Network Access में IP whitelist check करें
- Connection string verify करें

### Authentication Failed:
```
Error: Authentication failed
```
**Fix**:
- Username/password verify करें
- Database user properly create हुआ है check करें

### Timeout:
```
Error: Server selection timed out
```
**Fix**:
- Network Access में `0.0.0.0/0` add करें
- Region check करें (closest select करें)

## Cost

**M0 Free Tier**: 
- ✅ Completely FREE forever
- ✅ 512MB storage
- ✅ Shared RAM
- ✅ Perfect for development & small production apps

**Upgrade** (अगर जरूरत हो):
- M10: $57/month (2GB RAM, 10GB storage)
- M20: $120/month (4GB RAM, 20GB storage)

## Summary

1. ✅ MongoDB Atlas account बनाएं (free)
2. ✅ Cluster create करें (M0 free)
3. ✅ Database user बनाएं
4. ✅ IP whitelist करें (0.0.0.0/0)
5. ✅ Connection string लें
6. ✅ Vercel में `MONGODB_URI` add करें
7. ✅ Redeploy करें

**Done!** अब आपका app Vercel पर MongoDB Atlas use कर रहा है! 🎉
