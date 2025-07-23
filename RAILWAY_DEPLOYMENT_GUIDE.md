# Railway Deployment Guide for Jules Backend

## Problem
Railway is failing to deploy because it's trying to build from the root directory, which contains multiple projects (backend, frontend, mobile, chat) without a clear entry point.

## Solution
We've created configuration files to tell Railway to deploy the backend specifically.

## Files Created
1. `railway.json` - Tells Railway how to build and deploy
2. `package.json` - Root package.json that points to the backend

## Required Environment Variables

Set these in your Railway project dashboard:

### Required Variables:
```
NODE_ENV=production
PORT=4000
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/jules?retryWrites=true&w=majority
JWT_SECRET=your-super-secret-jwt-key-here
OPENAI_API_KEY=sk-your-openai-api-key-here
```

### Optional Variables (for full functionality):
```
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_API_KEY=your-google-api-key
GOOGLE_CSE_ID=your-custom-search-engine-id
```

## Deployment Steps

1. **Push the updated code** with the new `railway.json` and root `package.json`
2. **Set environment variables** in Railway dashboard
3. **Redeploy** - Railway should now successfully build and deploy the backend

## What Each Variable Does

- `NODE_ENV=production` - Enables production mode with proper CORS settings
- `PORT=4000` - Server port (Railway will override this with their own port)
- `MONGODB_URI` - Your MongoDB Atlas connection string
- `JWT_SECRET` - Secret key for JWT token generation
- `OPENAI_API_KEY` - Required for AI chat functionality
- `GOOGLE_CLIENT_ID/SECRET` - For Google OAuth login (optional)
- `GOOGLE_API_KEY/CSE_ID` - For product search functionality (optional)

## Testing the Deployment

Once deployed, test these endpoints:
- `https://your-railway-url.railway.app/health` - Should return status
- `https://your-railway-url.railway.app/test` - Should return "Express is working!"

## Troubleshooting

If deployment still fails:
1. Check Railway logs for specific error messages
2. Verify all required environment variables are set
3. Ensure MongoDB URI is correct and accessible
4. Check that OpenAI API key is valid

## Next Steps

After successful backend deployment:
1. Update your frontend to point to the new Railway backend URL
2. Deploy frontend separately (Vercel recommended for Next.js)
3. Update CORS settings if needed 