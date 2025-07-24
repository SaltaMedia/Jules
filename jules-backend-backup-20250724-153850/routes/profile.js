const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

// GET /api/profile - Protected route
router.get('/', auth, (req, res) => {
  res.json({ user: req.user });
});

// PUT /api/profile - Update user profile
router.put('/', auth, async (req, res) => {
  const { name, preferences } = req.body;
  
  // Get user ID from JWT token (handles both Auth0 and Google OAuth)
  let userId;
  if (req.user?.sub) {
    // Auth0 format
    userId = req.user.sub;
  } else if (req.user?.userId) {
    // Google OAuth format
    userId = req.user.userId;
  } else {
    return res.status(401).json({ error: 'User not authenticated' });
  }
  
  try {
    const user = await require('../models/User').findByIdAndUpdate(
      userId,
      { name, preferences },
      { new: true }
    );
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update profile.' });
  }
});

module.exports = router; 