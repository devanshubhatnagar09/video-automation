#!/bin/bash

# MongoDB Start Script for macOS/Linux

echo "🚀 Starting MongoDB..."

# Detect OS
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    if command -v brew &> /dev/null; then
        if brew services list | grep -q "mongodb-community.*started"; then
            echo "✅ MongoDB is already running!"
        else
            echo "Starting MongoDB via Homebrew..."
            brew services start mongodb-community
            sleep 2
            echo "✅ MongoDB started on mongodb://localhost:27017"
        fi
    else
        echo "❌ Homebrew not found. Please install MongoDB manually."
        echo "Run: brew tap mongodb/brew && brew install mongodb-community"
        exit 1
    fi
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    if systemctl is-active --quiet mongod; then
        echo "✅ MongoDB is already running!"
    else
        echo "Starting MongoDB via systemd..."
        sudo systemctl start mongod
        sleep 2
        if systemctl is-active --quiet mongod; then
            echo "✅ MongoDB started on mongodb://localhost:27017"
        else
            echo "❌ Failed to start MongoDB. Check logs: sudo journalctl -u mongod"
            exit 1
        fi
    fi
else
    echo "❌ Unsupported OS. Please start MongoDB manually."
    exit 1
fi

# Test connection
echo ""
echo "Testing MongoDB connection..."
if mongosh --eval "db.adminCommand('ping')" --quiet &> /dev/null; then
    echo "✅ MongoDB connection successful!"
    echo ""
    echo "Connection string: mongodb://localhost:27017/video-automation"
else
    echo "⚠️  MongoDB might still be starting. Wait a few seconds and try again."
fi
