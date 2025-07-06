# Quick Start Guide

## Start the Backend (Terminal 1):
```bash
cd jules-backend
npm start
```
Backend will run on http://localhost:5000

## Start the Frontend (Terminal 2):
```bash
cd jules-frontend  
npm run dev
```
Frontend will run on http://localhost:3000

## Test the App:
1. Visit http://localhost:3000
2. Click "Talk to Jules"
3. Register/Login
4. Start chatting!

## Troubleshooting:
- Make sure both servers are running
- Check that your .env file has MONGODB_URI and OPENAI_API_KEY
- For Google OAuth, make sure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set 