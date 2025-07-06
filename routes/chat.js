const express = require('express');
const router = express.Router();
const { handleChat, imageSearch, productSearch, getChatHistory } = require('../controllers/chatController');
const auth = require('../middleware/auth');

// POST /api/chat (protected)
router.post('/', auth, handleChat);
router.post('/products', productSearch);

// GET /api/chat/:userId (protected) - Get chat history
router.get('/:userId', auth, getChatHistory);

module.exports = router; 