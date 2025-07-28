// 🚨🚨🚨 FORCE COMPLETE REBUILD - Render is not deploying latest code 🚨🚨🚨
// 🚨🚨🚨 This message should force Render to rebuild the entire container 🚨🚨🚨
// 🚨🚨🚨 Timestamp: 2025-07-25 22:47:00 UTC 🚨🚨🚨
// 🚨🚨🚨 Git commit: 108539d - CRITICAL FIX: Force isNewSession = true 🚨🚨🚨
// 🚨🚨🚨 BUILD VERSION: 3.1.7 - CLEAN BUILD FORCE 🚨🚨🚨

console.log("🚨🚨🚨 RUNNING BUILD VERSION: 3.1.7 - CLEAN BUILD FORCE 🚨🚨🚨");
console.log("🚨🚨🚨 If you see this, the clean build worked! 🚨🚨🚨");
console.log("🚨🚨🚨 NODE VERSION FORCE REBUILD - This should trigger complete rebuild 🚨🚨🚨");

require('dotenv').config();

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  console.error('Stack:', err.stack);
  process.exit(1);
});
console.log('Starting server...');
// Always load dotenv (works in both dev and production)

// === FORCE RESTART TEST ===
console.log('🚨🚨🚨 FORCE RESTART TEST - This should appear on server startup 🚨🚨🚨');
console.log('🚨🚨🚨 Server started at:', new Date().toISOString());
console.log('🚨🚨🚨 Git commit: 4250730 - FORCE DEPLOY WITH PERSONALITY FIX');
console.log('🚨🚨🚨 THIS SHOULD BE THE LATEST COMMIT - IF YOU SEE OLD COMMIT, DEPLOYMENT IS BROKEN');
console.log('🚨🚨🚨 FORCE_RESTART env var:', process.env.FORCE_RESTART);
console.log('🚨🚨🚨 RESTART_TRIGGER env var:', process.env.RESTART_TRIGGER);
console.log('🚨🚨🚨 DEPLOYMENT_TIMESTAMP env var:', process.env.DEPLOYMENT_TIMESTAMP);
console.log('🚨🚨🚨 PERSONALITY_FIX env var:', process.env.PERSONALITY_FIX);
console.log('🚨🚨🚨 Process ID:', process.pid);
console.log('🚨🚨🚨 Node version:', process.version);
console.log('🚨🚨🚨 Current timestamp:', new Date().toISOString());
console.log('🚨🚨🚨 === FORCE RESTART TEST END ===');

const express = require('express');
console.log('express loaded');
const mongoose = require('mongoose');
console.log('mongoose loaded');
const cors = require('cors');
console.log('cors loaded');
const app = express();
console.log('app created');

console.log('Loading routes...');
const router = require('./routes/index.js');
console.log('router loaded');

const path = require('path');
const session = require('express-session');
console.log('session loaded');
const passport = require('passport');
console.log('passport loaded');

console.log('Loading passport config...');
require('./config/passport');
console.log('passport config loaded');

app.use(express.json());

// Configure CORS for production
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://www.juleslabs.com', 'https://juleslabs.com', 'https://jules-rosy.vercel.app']
    : ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use('/api', router);
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Configure MongoDB session store
const MongoStore = require('connect-mongo');



// Apply session middleware to all API routes that need session persistence
app.use('/api', session({ 
  secret: 'jules_secret', 
  resave: false, 
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI || 'mongodb://localhost:27017/jules',
    collectionName: 'sessions'
  })
}));
app.use('/api', passport.initialize());
app.use('/api', passport.session());

// Google OAuth routes (only if configured)
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  console.log('DEBUG: Google OAuth configured with client ID:', process.env.GOOGLE_CLIENT_ID);
  
  app.get('/api/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

  app.get('/api/auth/google/callback', (req, res, next) => {
    console.log('DEBUG: Google OAuth callback received');
    console.log('DEBUG: Query params:', req.query);
    
    passport.authenticate('google', (err, user, info) => {
      if (err) {
        console.error('GOOGLE OAUTH ERROR:', err, info);
        return res.status(401).send('Google OAuth Error: ' + JSON.stringify(err) + ' Info: ' + JSON.stringify(info));
      }
      if (!user) {
        console.error('GOOGLE OAUTH NO USER:', info);
        return res.status(401).send('Google OAuth No User: ' + JSON.stringify(info));
      }
      
      console.log('DEBUG: Google OAuth successful, user:', user.email);
      
      const jwt = require('jsonwebtoken');
      const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey';
      const token = jwt.sign({ userId: user._id, email: user.email, isAdmin: user.isAdmin }, JWT_SECRET, { expiresIn: '7d' });
      const redirectUrl = process.env.NODE_ENV === 'production' 
        ? `https://www.juleslabs.com/auth/callback?token=${token}`
        : `http://localhost:3000/auth/callback?token=${token}`;
      
      console.log('DEBUG: Redirecting to:', redirectUrl);
      res.redirect(redirectUrl);
    })(req, res, next);
  });
} else {
  console.log('DEBUG: Google OAuth not configured - missing credentials');
}

app.get('/test', (req, res) => res.send('Express is working!'));

// Root endpoint for Railway health checks
app.get('/', (req, res) => {
  console.log('Health check requested at:', new Date().toISOString());
  res.json({ 
    status: 'ok', 
    message: 'Jules Backend API',
    timestamp: new Date().toISOString() 
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: 'ONBOARDING FEATURES v2.3',
    commit: '60c456a'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  // Handle Mongoose CastError specifically
  if (err.name === 'CastError' && err.kind === 'ObjectId') {
    console.log('DEBUG: Caught CastError for invalid ObjectId:', err.value);
    return res.status(400).json({ error: 'Invalid ID format' });
  }
  
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 4000;

console.log('About to connect to MongoDB...');
console.log('MONGODB_URI:', process.env.MONGODB_URI);

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', reason);
  console.error('Stack:', reason.stack);
  process.exit(1);
});

// Start server first, then connect to MongoDB
console.log('Starting server first...');
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  
  // Now connect to MongoDB
  console.log('Calling mongoose.connect...');
  mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB Atlas');
  })
  .catch((err) => {
    console.error('Failed to connect to MongoDB Atlas:', err);
    // Don't exit - server can still run without DB for health checks
  });
});
// FORCE DEPLOYMENT - Mon Jul 28 11:49:16 PDT 2025
