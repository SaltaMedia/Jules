const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: false },
  createdAt: { type: Date, default: Date.now },
  name: { type: String },
  preferences: { type: Object, default: {} },
  isAdmin: { type: Boolean, default: false }
});

module.exports = mongoose.model('User', userSchema); 