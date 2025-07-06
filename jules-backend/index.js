require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const app = express();
const chatRoutes = require('./routes/chat');
const authRoutes = require('./routes/auth');
const profileRoutes = require('./routes/profile');
const uploadRoutes = require('./routes/upload');
const productsRoutes = require('./routes/products');
const adminRoutes = require('./routes/admin');
const path = require('path');
const session = require('express-session');
const passport = require('passport');
require('./config/passport');

app.use(express.json());
app.use(cors());
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

// Google OAuth routes
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
    res.redirect(`http://localhost:3000/auth/callback?token=${token}`);
  })(req, res, next);
});

app.get('/test', (req, res) => res.send('Express is working!'));

const PORT = process.env.PORT || 4000;

console.log('MONGODB_URI:', process.env.MONGODB_URI);

// Connect to MongoDB Atlas
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('Connected to MongoDB Atlas');
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
})
.catch((err) => {
  console.error('Failed to connect to MongoDB Atlas:', err);
});
