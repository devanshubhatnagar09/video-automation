# Local MongoDB Setup Guide

## MongoDB Local Installation & Setup

### Step 1: Install MongoDB

#### macOS (using Homebrew):
```bash
# Install MongoDB Community Edition
brew tap mongodb/brew
brew install mongodb-community

# Start MongoDB service
brew services start mongodb-community

# Or run manually:
mongod --config /opt/homebrew/etc/mongod.conf
```

#### Linux (Ubuntu/Debian):
```bash
# Import MongoDB public GPG key
wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | sudo apt-key add -

# Add MongoDB repository
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

# Update and install
sudo apt-get update
sudo apt-get install -y mongodb-org

# Start MongoDB
sudo systemctl start mongod
sudo systemctl enable mongod
```

#### Windows:
1. Download MongoDB Community Server: https://www.mongodb.com/try/download/community
2. Run installer
3. Choose "Complete" installation
4. Install as Windows Service (recommended)
5. MongoDB will start automatically

### Step 2: Verify MongoDB is Running

```bash
# Check if MongoDB is running
mongosh

# Or check status (macOS/Linux)
brew services list | grep mongodb
# or
sudo systemctl status mongod
```

### Step 3: Create Database

MongoDB automatically creates database when you first write to it. No need to create manually!

### Step 4: Update Environment Variables

#### Local Development (.env):
```env
MONGODB_URI=mongodb://localhost:27017/video-automation
```

#### Default MongoDB Settings:
- **Host**: `localhost`
- **Port**: `27017` (default)
- **Database**: `video-automation` (auto-created)

### Step 5: Test Connection

```bash
# Test MongoDB connection
mongosh video-automation

# Or test from Node.js:
node -e "const mongoose = require('mongoose'); mongoose.connect('mongodb://localhost:27017/video-automation').then(() => console.log('Connected!')).catch(e => console.error(e))"
```

## Quick Start Script

Create a script to start MongoDB easily:

### macOS/Linux: `scripts/start-mongodb.sh`
```bash
#!/bin/bash
echo "Starting MongoDB..."

# Check if MongoDB is already running
if pgrep -x "mongod" > /dev/null; then
    echo "MongoDB is already running!"
else
    # Start MongoDB
    brew services start mongodb-community  # macOS
    # OR
    sudo systemctl start mongod  # Linux
    
    echo "MongoDB started on mongodb://localhost:27017"
fi
```

### Windows: `scripts/start-mongodb.bat`
```batch
@echo off
echo Starting MongoDB...
net start MongoDB
echo MongoDB started on mongodb://localhost:27017
```

## MongoDB Management

### View Data:
```bash
# Connect to MongoDB shell
mongosh video-automation

# List collections
show collections

# View jobs
db.jobs.find().pretty()

# Count jobs
db.jobs.countDocuments()

# Find specific job
db.jobs.findOne({ jobId: "your-job-id" })
```

### Reset Database (if needed):
```bash
mongosh video-automation
db.jobs.deleteMany({})
```

### Backup Database:
```bash
mongodump --db=video-automation --out=./backup
```

### Restore Database:
```bash
mongorestore --db=video-automation ./backup/video-automation
```

## Troubleshooting

### MongoDB Not Starting:
```bash
# Check logs
tail -f /opt/homebrew/var/log/mongodb/mongo.log  # macOS
tail -f /var/log/mongodb/mongod.log  # Linux

# Check if port 27017 is in use
lsof -i :27017  # macOS/Linux
netstat -ano | findstr :27017  # Windows
```

### Connection Refused:
- Make sure MongoDB is running: `brew services list` or `sudo systemctl status mongod`
- Check firewall settings
- Verify port 27017 is not blocked

### Permission Issues:
```bash
# macOS: Check MongoDB data directory permissions
ls -la /opt/homebrew/var/mongodb

# Linux: Check MongoDB user
sudo chown -R mongodb:mongodb /var/lib/mongodb
```

## Default Configuration

MongoDB runs on:
- **Host**: `localhost`
- **Port**: `27017`
- **Data Directory**: 
  - macOS: `/opt/homebrew/var/mongodb`
  - Linux: `/var/lib/mongodb`
  - Windows: `C:\Program Files\MongoDB\Server\7.0\data`

## Next Steps

1. ✅ Install MongoDB locally
2. ✅ Start MongoDB service
3. ✅ Update `.env` with `MONGODB_URI=mongodb://localhost:27017/video-automation`
4. ✅ Run `npm install` to install mongoose
5. ✅ Test the app - jobs will save to local MongoDB!

**Your app is now using local MongoDB!** 🎉
