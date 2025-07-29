#!/bin/bash

echo "🛑 Stopping Jules Backend Server"
echo "================================"

# Check if any node processes are running on port 4000
if lsof -ti:4000 > /dev/null 2>&1; then
    echo "🔍 Found processes on port 4000. Stopping them..."
    pkill -f "node index.js"
    sleep 2
    
    # Verify they're stopped
    if lsof -ti:4000 > /dev/null 2>&1; then
        echo "⚠️  Some processes may still be running. Force killing..."
        lsof -ti:4000 | xargs kill -9
        echo "✅ All processes on port 4000 have been stopped"
    else
        echo "✅ Server stopped successfully"
    fi
else
    echo "✅ No server running on port 4000"
fi 