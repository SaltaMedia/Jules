const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');

// Only configure Google OAuth if credentials are provided
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  // Determine the callback URL based on environment
  const callbackURL = process.env.NODE_ENV === 'production' 
    ? `${process.env.RAILWAY_URL || 'https://jules-production-2221.up.railway.app'}/api/auth/google/callback`
    : 'http://localhost:4000/api/auth/google/callback';
    
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: callbackURL,
  }, async (accessToken, refreshToken, profile, done) => {
  try {
    let user = await User.findOne({ email: profile.emails[0].value });
    if (!user) {
      user = await User.create({
        email: profile.emails[0].value,
        name: profile.displayName,
        isAdmin: false,
      });
    }
    return done(null, user);
  } catch (err) {
    console.error('Passport Google Strategy error:', err);
    return done(err, null);
  }
  }));
}

// These should always be configured, regardless of Google OAuth
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    // Check if id is a valid MongoDB ObjectId
    const mongoose = require('mongoose');
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      console.log('DEBUG: Invalid ObjectId in deserializeUser:', id);
      return done(null, null);
    }
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    console.error('Passport deserializeUser error:', err);
    done(null, null); // Return null instead of error to prevent crashes
  }
}); 