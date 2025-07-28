const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: false },
  createdAt: { type: Date, default: Date.now },
  name: { type: String },
  isOnboarded: { type: Boolean, default: false },
  preferences: { type: Object, default: {} },
  isAdmin: { type: Boolean, default: false },
  settings: {
    julesPersonality: { type: Number, default: 2 },
    aboutMe: { type: String, default: '' }
  },
  bodyInfo: {
    height: { type: String, default: '' },
    weight: { type: String, default: '' },
    topSize: { type: String, default: '' },
    bottomSize: { type: String, default: '' }
  }
});

module.exports = mongoose.model('User', userSchema); 