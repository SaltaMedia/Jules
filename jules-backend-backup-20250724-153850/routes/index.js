const express = require('express');
const router = express.Router();

// Import all route modules
const chatRoutes = require('./chat');
const datingRoutes = require('./dating');
const practiceRoutes = require('./practice');
const styleRoutes = require('./style');
const conversationRoutes = require('./conversation');
const authRoutes = require('./auth');
const profileRoutes = require('./profile');
const userProfileRoutes = require('./userProfile');
const uploadRoutes = require('./upload');
const productsRoutes = require('./products');
const adminRoutes = require('./admin');

// Mount all routes
router.use('/chat', chatRoutes);
router.use('/dating', datingRoutes);
router.use('/practice', practiceRoutes);
router.use('/style', styleRoutes);
router.use('/conversation', conversationRoutes);
router.use('/auth', authRoutes);
router.use('/profile', profileRoutes);
router.use('/user-profile', userProfileRoutes);
router.use('/upload', uploadRoutes);
router.use('/products', productsRoutes);
router.use('/admin', adminRoutes);

module.exports = router; 