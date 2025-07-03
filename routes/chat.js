const express = require('express');
const router = express.Router();
const { handleChat, imageSearch, productSearch } = require('../controllers/chatController');
const auth = require('../middleware/auth');

// POST /api/chat (protected)
router.post('/', auth, handleChat);
router.post('/products', productSearch);

module.exports = router; 