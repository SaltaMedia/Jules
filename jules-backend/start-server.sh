#!/bin/bash

echo "🚀 Starting Jules Backend Server"
echo "=================================="

# Check if port 4000 is in use
echo "🔍 Checking for port conflicts..."
if lsof -ti:4000 > /dev/null 2>&1; then
    echo "⚠️  Port 4000 is already in use. Killing existing processes..."
    pkill -f "node index.js"
    sleep 2
    
    # Double check if port is now free
    if lsof -ti:4000 > /dev/null 2>&1; then
        echo "❌ Failed to free port 4000. Please manually kill the process using:"
        echo "   lsof -ti:4000 | xargs kill -9"
        exit 1
    else
        echo "✅ Port 4000 is now free"
    fi
else
    echo "✅ Port 4000 is available"
fi

echo "🚀 Starting server..."
node index.js 