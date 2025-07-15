#!/bin/bash

echo "🚀 Jules App Deployment Script"
echo "================================"

# Check if git is clean
if [ -n "$(git status --porcelain)" ]; then
    echo "❌ Git working directory is not clean. Please commit your changes first."
    exit 1
fi

echo "✅ Git working directory is clean"

# Push to GitHub
echo "📤 Pushing to GitHub..."
git push origin main

echo ""
echo "🎯 Next Steps:"
echo "=============="
echo ""
echo "1. BACKEND (Render):"
echo "   - Go to https://dashboard.render.com"
echo "   - Create new Web Service"
echo "   - Connect your GitHub repo"
echo "   - Set root directory to: jules-backend"
echo "   - Add environment variables from DEPLOYMENT.md"
echo ""
echo "2. FRONTEND (Vercel):"
echo "   - Go to https://vercel.com/dashboard"
echo "   - Create new project"
echo "   - Connect your GitHub repo"
echo "   - Set root directory to: jules-frontend"
echo "   - Add environment variable: NEXT_PUBLIC_API_URL=https://jules-backend.onrender.com"
echo ""
echo "3. CHAT APP (Vercel):"
echo "   - Go to https://vercel.com/dashboard"
echo "   - Create new project"
echo "   - Connect your GitHub repo"
echo "   - Set root directory to: jules-chat"
echo "   - Add environment variables: OPENAI_API_KEY, SERPAPI_API_KEY"
echo ""
echo "4. MOBILE APP:"
echo "   - Run: cd jules-mobile && npx expo build:android"
echo "   - Run: cd jules-mobile && npx expo build:ios"
echo ""
echo "📋 See DEPLOYMENT.md for detailed instructions"
echo ""
echo "🔗 Production URLs will be:"
echo "   - Backend: https://jules-backend.onrender.com"
echo "   - Frontend: https://www.juleslabs.com"
echo "   - Chat: https://jules-chat.vercel.app" 