const memoryStore = {};

function getUserMemory(userId) {
  if (!memoryStore[userId]) {
    memoryStore[userId] = {
      stylePreferences: [],
      emotionalNotes: [],
      productHistory: [],
      goals: [],
      recentMessages: [], // Add session memory for recent messages
      vagueChatCount: 0, // Track vague chat count
    };
  }
  return memoryStore[userId];
}

function updateUserMemory(userId, updates) {
  const memory = getUserMemory(userId);
  for (const [key, value] of Object.entries(updates)) {
    if (Array.isArray(memory[key])) {
      // Add timestamp to each memory entry
      const timestampedEntry = {
        value: value,
        timestamp: Date.now()
      };
      memory[key].push(timestampedEntry);
    } else {
      memory[key] = value;
    }
  }
}

function getMemorySummary(userId) {
  const memory = getUserMemory(userId);
  
  // Extract just the values for display (without timestamps)
  const stylePrefs = memory.stylePreferences.map(entry => entry.value || entry).join(", ") || "N/A";
  const emotionalNotes = memory.emotionalNotes.map(entry => entry.value || entry).join(", ") || "N/A";
  const productHistory = memory.productHistory.map(entry => entry.value || entry).join(", ") || "N/A";
  const goals = memory.goals.map(entry => entry.value || entry).join(", ") || "N/A";
  
  const summary = `
User prefers: ${stylePrefs}
Emotional patterns: ${emotionalNotes}
Products they've liked: ${productHistory}
Goals they've shared: ${goals}
`.trim();
  
  console.log('DEBUG: getMemorySummary called for userId:', userId);
  console.log('DEBUG: Memory summary:', summary);
  return summary;
}

function getToneProfile(userId) {
  const memory = getUserMemory(userId);
  const sadnessTriggers = ["rejected", "ghosted", "lonely", "hurt", "sad", "upset", "depressed"];
  
  // Count sad emotions from both old format (strings) and new format (objects)
  const emotionalNotes = memory.emotionalNotes.map(entry => entry.value || entry);
  const sadCount = emotionalNotes.filter(note =>
    sadnessTriggers.some(trigger => note.toLowerCase().includes(trigger))
  ).length;
  
  if (sadCount >= 3) return "gentle";
  if (sadCount === 0) return "confident";
  return "balanced";
}

function getRecentMemory(userId, days = 7) {
  const memory = getUserMemory(userId);
  const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000); // days ago in milliseconds
  
  const recentMemory = {
    stylePreferences: [],
    emotionalNotes: [],
    productHistory: [],
    goals: [],
  };
  
  // Filter each memory type for recent entries
  for (const [key, entries] of Object.entries(memory)) {
    if (Array.isArray(entries)) {
      recentMemory[key] = entries.filter(entry => {
        // Handle both old format (strings) and new format (objects with timestamps)
        if (typeof entry === 'string') {
          return true; // Keep old entries for backward compatibility
        }
        return entry.timestamp && entry.timestamp > cutoffTime;
      });
    }
  }
  
  return recentMemory;
}

function getRecentMemorySummary(userId, days = 7) {
  const recentMemory = getRecentMemory(userId, days);
  
  // Extract just the values for display
  const stylePrefs = recentMemory.stylePreferences.map(entry => entry.value || entry).join(", ") || "N/A";
  const emotionalNotes = recentMemory.emotionalNotes.map(entry => entry.value || entry).join(", ") || "N/A";
  const productHistory = recentMemory.productHistory.map(entry => entry.value || entry).join(", ") || "N/A";
  const goals = recentMemory.goals.map(entry => entry.value || entry).join(", ") || "N/A";
  
  return `
Recent preferences (last ${days} days): ${stylePrefs}
Recent emotional patterns: ${emotionalNotes}
Recent product interests: ${productHistory}
Recent goals: ${goals}
`.trim();
}

// Session memory functions
function addSessionMessage(userId, message) {
  const memory = getUserMemory(userId);
  // Add timestamp if not present
  const messageWithTimestamp = {
    ...message,
    timestamp: message.timestamp || new Date()
  };
  memory.recentMessages.push(messageWithTimestamp);
  
  // Keep only the last 10 messages
  if (memory.recentMessages.length > 10) {
    memory.recentMessages.shift();
  }
  
  console.log('DEBUG: Session memory updated for userId:', userId);
  console.log('DEBUG: Session now has', memory.recentMessages.length, 'messages');
  console.log('DEBUG: Latest session message:', {
    role: messageWithTimestamp.role,
    content: messageWithTimestamp.content.substring(0, 50) + '...',
    timestamp: messageWithTimestamp.timestamp
  });
}

function getSessionHistory(userId) {
  const memory = getUserMemory(userId);
  const sessionHistory = memory.recentMessages || [];
  console.log('DEBUG: getSessionHistory called for userId:', userId);
  console.log('DEBUG: Session history length:', sessionHistory.length);
  console.log('DEBUG: Session history:', JSON.stringify(sessionHistory, null, 2));
  return sessionHistory;
}

module.exports = {
  getUserMemory,
  updateUserMemory,
  getMemorySummary,
  getToneProfile,
  getRecentMemory,
  getRecentMemorySummary,
  addSessionMessage,
  getSessionHistory,
}; 