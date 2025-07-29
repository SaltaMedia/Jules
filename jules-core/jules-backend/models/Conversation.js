const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now, required: true }
}, { _id: false });

const conversationSchema = new mongoose.Schema({
  userId: { type: String, required: true }, // or sessionId if you prefer
  messages: [messageSchema]
}, { timestamps: true });

module.exports = mongoose.model('Conversation', conversationSchema); 