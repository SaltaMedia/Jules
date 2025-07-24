const express = require('express');
const router = express.Router();
const User = require('../models/User');

// Get user profile including tone level
router.get('/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Get tone level from preferences, default to 2 (balanced)
    const toneLevel = user.preferences?.toneLevel || 2;
    
    res.json({ 
      userId: user._id,
      toneLevel,
      preferences: user.preferences || {}
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user tone level
router.post('/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    const { toneLevel } = req.body;

    if (![1, 2, 3].includes(toneLevel)) {
      return res.status(400).json({ error: 'Invalid tone level. Must be 1, 2, or 3' });
    }

    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update preferences with new tone level
    const updatedPreferences = {
      ...user.preferences,
      toneLevel
    };

    user.preferences = updatedPreferences;
    await user.save();

    res.json({ 
      message: 'Tone level updated successfully', 
      profile: {
        userId: user._id,
        toneLevel,
        preferences: updatedPreferences
      }
    });
  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router; 