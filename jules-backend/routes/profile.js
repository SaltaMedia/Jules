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
  try {
    const user = await require('../models/User').findByIdAndUpdate(
      req.user.userId,
      { name, preferences },
      { new: true }
    );
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update profile.' });
  }
});

module.exports = router; 