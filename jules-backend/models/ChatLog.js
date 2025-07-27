const mongoose = require('mongoose');

const ChatLogSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  message: { type: String, required: true },
  reply: { type: String, required: true },
  intent: { type: String }, // optional, default: null
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ChatLog', ChatLogSchema); 