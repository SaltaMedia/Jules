const express = require('express');
const router = express.Router();
const { handleStyle } = require('../controllers/styleController');
const auth = require('../middleware/auth');

// POST /api/style - Handle style advice and recommendations
router.post('/', auth, handleStyle);

module.exports = router; 