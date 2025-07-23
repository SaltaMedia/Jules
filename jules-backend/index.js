process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});
console.log('Starting server...');
require('dotenv').config();
console.log('dotenv loaded');

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

// Only apply session middleware to routes that need authentication
const MongoStore = require('connect-mongo');
app.use('/api/auth', session({ 
  secret: 'jules_secret', 
  resave: false, 
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    collectionName: 'sessions'
  })
}));
app.use('/api/auth', passport.initialize());
app.use('/api/auth', passport.session());

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

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
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
});

// Connect to MongoDB Atlas
console.log('Calling mongoose.connect...');
mongoose.connect(process.env.MONGODB_URI)
.then(() => {
  console.log('Connected to MongoDB Atlas');
  console.log('About to start server...');
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
})
.catch((err) => {
  console.error('Failed to connect to MongoDB Atlas:', err);
  process.exit(1);
});
