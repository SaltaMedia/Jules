const express = require('express');
const router = express.Router();
const { exportLogsToCSV, getLogs } = require('../controllers/logsController');
const auth = require('../middleware/auth');

// GET /api/logs/export - Export logs as CSV
router.get('/export', auth, exportLogsToCSV);

// GET /api/logs - Get logs for admin dashboard (optional)
router.get('/', auth, getLogs);

module.exports = router; 