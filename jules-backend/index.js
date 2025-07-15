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
const chatRoutes = require('./routes/chat');
console.log('chatRoutes loaded');
const authRoutes = require('./routes/auth');
console.log('authRoutes loaded');
const profileRoutes = require('./routes/profile');
console.log('profileRoutes loaded');
const uploadRoutes = require('./routes/upload');
console.log('uploadRoutes loaded');
const productsRoutes = require('./routes/products');
console.log('productsRoutes loaded');
const adminRoutes = require('./routes/admin');
console.log('adminRoutes loaded');

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
    ? ['https://www.juleslabs.com', 'https://juleslabs.com', 'https://jules-frontend.vercel.app']
    : ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use('/api/chat', chatRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use(session({ secret: 'jules_secret', resave: false, saveUninitialized: false }));
app.use(passport.initialize());
app.use(passport.session());

// Google OAuth routes (only if configured)
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  app.get('/api/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

  app.get('/api/auth/google/callback', (req, res, next) => {
  passport.authenticate('google', (err, user, info) => {
    if (err) {
      console.error('GOOGLE OAUTH ERROR:', err, info);
      return res.status(401).send('Google OAuth Error: ' + JSON.stringify(err) + ' Info: ' + JSON.stringify(info));
    }
    if (!user) {
      console.error('GOOGLE OAUTH NO USER:', info);
      return res.status(401).send('Google OAuth No User: ' + JSON.stringify(info));
    }
    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey';
    const token = jwt.sign({ userId: user._id, email: user.email, isAdmin: user.isAdmin }, JWT_SECRET, { expiresIn: '7d' });
    const redirectUrl = process.env.NODE_ENV === 'production' 
      ? `https://www.juleslabs.com/auth/callback?token=${token}`
      : `http://localhost:3000/auth/callback?token=${token}`;
    res.redirect(redirectUrl);
  })(req, res, next);
  });
}

app.get('/test', (req, res) => res.send('Express is working!'));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 4000;

console.log('About to connect to MongoDB...');
console.log('MONGODB_URI:', process.env.MONGODB_URI);

// Connect to MongoDB Atlas
console.log('Calling mongoose.connect...');
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
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
