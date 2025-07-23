#!/bin/bash

echo "🚀 Jules Railway Deployment Helper"
echo "=================================="

# Check if git is clean
if [ -n "$(git status --porcelain)" ]; then
    echo "❌ Git working directory is not clean. Please commit or stash your changes first."
    exit 1
fi

echo "✅ Git working directory is clean"

# Check if railway.json exists
if [ ! -f "railway.json" ]; then
    echo "❌ railway.json not found. Please ensure it exists in the root directory."
    exit 1
fi

echo "✅ railway.json found"

# Check if root package.json exists
if [ ! -f "package.json" ]; then
    echo "❌ Root package.json not found. Please ensure it exists in the root directory."
    exit 1
fi

echo "✅ Root package.json found"

# Check if backend directory exists
if [ ! -d "jules-backend" ]; then
    echo "❌ jules-backend directory not found."
    exit 1
fi

echo "✅ jules-backend directory found"

echo ""
echo "📋 Required Environment Variables for Railway:"
echo "=============================================="
echo "NODE_ENV=production"
echo "PORT=4000"
echo "MONGODB_URI=your-mongodb-connection-string"
echo "JWT_SECRET=your-jwt-secret"
echo "OPENAI_API_KEY=your-openai-api-key"
echo ""
echo "Optional:"
echo "GOOGLE_CLIENT_ID=your-google-client-id"
echo "GOOGLE_CLIENT_SECRET=your-google-client-secret"
echo "GOOGLE_API_KEY=your-google-api-key"
echo "GOOGLE_CSE_ID=your-custom-search-engine-id"
echo ""

echo "🚀 Ready to deploy! Steps:"
echo "1. Push this code to your repository"
echo "2. Set the environment variables in Railway dashboard"
echo "3. Redeploy in Railway"
echo "4. Test the deployment with: https://your-railway-url.railway.app/health"

echo ""
echo "💡 Tip: Make sure your MongoDB Atlas cluster is accessible from Railway's IP addresses" 