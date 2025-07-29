const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const User = require('../models/User');

// GET /api/admin/users - List all users (admin only)
router.get('/users', auth, admin, async (req, res) => {
  try {
    const users = await User.find({}, '-password'); // Exclude passwords
    res.json({ users });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users.' });
  }
});

module.exports = router; 