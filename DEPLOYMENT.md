# Jules App Deployment Guide

## Overview
This guide will help you deploy all components of the Jules app to production.

## Components to Deploy
1. **Backend** (Node.js/Express) → Render
2. **Frontend** (Next.js) → Vercel  
3. **Mobile App** (React Native/Expo) → App Stores
4. **Chat App** (Next.js) → Vercel

---

## 1. Backend Deployment (Render)

### Prerequisites
- Render account (free tier available)
- MongoDB Atlas database (already configured)

### Steps
1. **Go to [Render Dashboard](https://dashboard.render.com)**
2. **Click "New +" → "Web Service"**
3. **Connect your GitHub repository**
4. **Configure the service:**
   - **Name**: `jules-backend`
   - **Root Directory**: `jules-backend`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free

5. **Add Environment Variables:**
   ```
   MONGODB_URI=mongodb+srv://spsalta:Q4eqe34UHGRz7ZaT@juleslabs.mtrgoxc.mongodb.net/?retryWrites=true&w=majority&appName=JulesLabs
   OPENAI_API_KEY=your_openai_api_key
   JWT_SECRET=your_jwt_secret
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   GOOGLE_CSE_ID=your_google_cse_id
   GOOGLE_API_KEY=your_google_api_key
   NODE_ENV=production
   ```

6. **Deploy** - Render will automatically deploy your app
7. **Note the URL**: `https://jules-backend.onrender.com`

---

## 2. Frontend Deployment (Vercel)

### Prerequisites
- Vercel account (free tier available)
- GitHub repository connected

### Steps
1. **Go to [Vercel Dashboard](https://vercel.com/dashboard)**
2. **Click "New Project"**
3. **Import your GitHub repository**
4. **Configure the project:**
   - **Framework Preset**: Next.js
   - **Root Directory**: `jules-frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`

5. **Add Environment Variables:**
   ```
   NEXT_PUBLIC_API_URL=https://jules-backend.onrender.com
   ```

6. **Deploy** - Vercel will automatically deploy your app
7. **Custom Domain**: Add `www.juleslabs.com` in Vercel settings

---

## 3. Chat App Deployment (Vercel)

### Steps
1. **Go to [Vercel Dashboard](https://vercel.com/dashboard)**
2. **Click "New Project"**
3. **Import your GitHub repository**
4. **Configure the project:**
   - **Framework Preset**: Next.js
   - **Root Directory**: `jules-chat`
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`

5. **Add Environment Variables:**
   ```
   OPENAI_API_KEY=your_openai_api_key
   SERPAPI_API_KEY=your_serpapi_key
   ```

6. **Deploy** - Vercel will automatically deploy your app

---

## 4. Mobile App Deployment

### Prerequisites
- Expo account
- Apple Developer account (for iOS)
- Google Play Console account (for Android)

### Steps
1. **Build for Production:**
   ```bash
   cd jules-mobile
   npx expo build:android  # For Android
   npx expo build:ios      # For iOS
   ```

2. **Submit to App Stores:**
   - Follow Expo's guide for app store submission
   - Update app configuration in `app.json`

---

## 5. Post-Deployment Checklist

### Backend (Render)
- [ ] Health check: `https://jules-backend.onrender.com/health`
- [ ] Test endpoint: `https://jules-backend.onrender.com/test`
- [ ] Verify MongoDB connection
- [ ] Test authentication endpoints

### Frontend (Vercel)
- [ ] Visit `https://www.juleslabs.com`
- [ ] Test login/registration
- [ ] Test chat functionality
- [ ] Verify API calls to backend

### Mobile App
- [ ] Test on physical devices
- [ ] Verify API connectivity
- [ ] Test all features

---

## 6. Environment Variables Summary

### Backend (.env on Render)
```
MONGODB_URI=mongodb+srv://spsalta:Q4eqe34UHGRz7ZaT@juleslabs.mtrgoxc.mongodb.net/?retryWrites=true&w=majority&appName=JulesLabs
OPENAI_API_KEY=your_openai_api_key
JWT_SECRET=your_jwt_secret
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CSE_ID=your_google_cse_id
GOOGLE_API_KEY=your_google_api_key
NODE_ENV=production
```

### Frontend (Vercel Environment Variables)
```
NEXT_PUBLIC_API_URL=https://jules-backend.onrender.com
```

### Chat App (Vercel Environment Variables)
```
OPENAI_API_KEY=your_openai_api_key
SERPAPI_API_KEY=your_serpapi_key
```

---

## 7. Troubleshooting

### Common Issues
1. **CORS Errors**: Ensure backend CORS is configured for production domains
2. **API Connection**: Verify environment variables are set correctly
3. **Build Failures**: Check for missing dependencies in package.json
4. **Domain Issues**: Ensure DNS is properly configured for custom domains

### Support
- Render: Check logs in dashboard
- Vercel: Check build logs and function logs
- MongoDB: Check connection in Atlas dashboard

---

## 8. Monitoring

### Set up monitoring for:
- Backend uptime and performance
- Frontend build status
- API response times
- Error rates

### Recommended tools:
- Render's built-in monitoring
- Vercel Analytics
- MongoDB Atlas monitoring
- Sentry for error tracking 