const ChatLog = require('../models/ChatLog');

exports.exportLogsToCSV = async (req, res) => {
  try {
    // For admin users, allow export of all logs
    // For regular users, only export their own logs
    const query = req.user.isAdmin ? {} : { userId: req.user.userId };
    
    const logs = await ChatLog.find(query).sort({ timestamp: -1 });

    // Convert to CSV format manually since we don't want to add json2csv dependency
    const csvHeaders = 'userId,message,reply,intent,timestamp\n';
    const csvRows = logs.map(log => {
      // Escape quotes and commas in CSV
      const escapeCsv = (str) => {
        if (!str) return '';
        return `"${str.replace(/"/g, '""')}"`;
      };
      
      return `${escapeCsv(log.userId)},${escapeCsv(log.message)},${escapeCsv(log.reply)},${escapeCsv(log.intent || '')},${log.timestamp.toISOString()}`;
    }).join('\n');

    const csv = csvHeaders + csvRows;

    res.header('Content-Type', 'text/csv');
    res.attachment('jules_chat_logs.csv');
    return res.send(csv);
  } catch (err) {
    console.error('Export logs error:', err);
    res.status(500).json({ error: 'Failed to export logs.' });
  }
};

// Get logs for admin dashboard (optional)
exports.getLogs = async (req, res) => {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({ error: 'Admin access required.' });
    }

    const { page = 1, limit = 50, userId } = req.query;
    const query = userId ? { userId } : {};
    
    const logs = await ChatLog.find(query)
      .sort({ timestamp: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await ChatLog.countDocuments(query);

    res.json({
      logs,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (err) {
    console.error('Get logs error:', err);
    res.status(500).json({ error: 'Failed to retrieve logs.' });
  }
}; 