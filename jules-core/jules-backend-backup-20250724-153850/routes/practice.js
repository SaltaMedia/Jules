const express = require('express');
const router = express.Router();
const { handlePractice } = require('../controllers/practiceController');
const auth = require('../middleware/auth');

// POST /api/practice - Handle practice scenarios and roleplay
router.post('/', auth, handlePractice);

module.exports = router; 