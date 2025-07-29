const express = require('express');
const router = express.Router();
const { handleDating } = require('../controllers/datingController');
const auth = require('../middleware/auth');

// POST /api/dating - Handle dating advice and conversations
router.post('/', auth, handleDating);

module.exports = router; 