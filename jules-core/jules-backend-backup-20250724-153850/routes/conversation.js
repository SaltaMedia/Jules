const express = require('express');
const router = express.Router();
const { handleConversation } = require('../controllers/conversationController');
const auth = require('../middleware/auth');

// POST /api/conversation - Handle casual conversation and banter
router.post('/', auth, handleConversation);

module.exports = router; 