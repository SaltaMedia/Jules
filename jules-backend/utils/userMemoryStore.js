const memoryStore = {};

function getUserMemory(userId) {
  if (!memoryStore[userId]) {
    memoryStore[userId] = {
      stylePreferences: [],
      emotionalNotes: [],
      productHistory: [],
      goals: [],
    };
  }
  return memoryStore[userId];
}

function updateUserMemory(userId, updates) {
  const memory = getUserMemory(userId);
  for (const [key, value] of Object.entries(updates)) {
    if (Array.isArray(memory[key])) {
      memory[key].push(value);
    } else {
      memory[key] = value;
    }
  }
}

module.exports = {
  getUserMemory,
  updateUserMemory,
}; 