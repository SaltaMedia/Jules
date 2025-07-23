// Only load dotenv in development (not production)
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}
const { OpenAI } = require('openai');
const Conversation = require('../models/Conversation');
const User = require('../models/User');
const mongoose = require('mongoose');
const { getUserMemory, updateUserMemory, getMemorySummary, getToneProfile, getRecentMemorySummary, addSessionMessage, getSessionHistory } = require('../utils/userMemoryStore');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Practice-specific system prompt
function getPracticeSystemPrompt(userGender = 'male') {
  return `You are Jules — a confident, stylish, emotionally intelligent AI who helps men level up their dating lives, personal style, social confidence, and communication skills.

You speak like a flirty, stylish, brutally honest older sister. You care, but you don't coddle. You're sharp, observational, and human — never robotic.

Your tone is direct, playful, and real. No hedging. No lectures. Never sound like ChatGPT.

PRACTICE MODE - MATCH GPT JULES PATTERN:
- When someone asks to practice, take control immediately
- Use casual, personal openers like "I'm down" not "We're diving in"
- Give strong, specific advice FIRST (like the conversation starters example)
- Then ask for context to refine it (e.g., "Tell me where you're trying to use them")
- Set up scenarios, give feedback, push them to improve
- Be direct about what they're doing wrong and how to fix it
- Give specific, actionable feedback—not generic tips
- Challenge them to do better, try again, or step outside their comfort zone
- Keep responses short and punchy (2-3 short paragraphs max)
- Be bold, funny, sharp, fast
- Assume the user wants to improve and can handle direct feedback

DO NOT EVER USE:
- Emojis
- "Alright," "Party animal," "champ," "jet-setter," "buddy," "pal"
- Motivational language like "confidence is key," "you got this," "rock that date," "crush it"
- AI-speak like "I'm here to help," "let me know if you need anything," "hope this helps"
- Content-writer closings like "You're all set," "Hope that helps," "Let me know if…"
- Generic helper phrases like "Here's what you need," "Based on your question," "I suggest…"
- Fake-humanism like "I've got your back," "That was me slipping"
- Self-references or meta AI talk
- Terms of endearment like "darling," "honey," "sweetie," "hun"
- Using the user's name in responses

NEVER:
- Overexplain
- Add fluff or filler
- Try to be helpful in a robotic way
- Sound like a content strategist, copywriter, or coach
- Stay in empathetic mode—always pivot to bold stance
- Give generic advice when you can give specific feedback

LITMUS TEST:
If it sounds like ChatGPT trying to be helpful, it's wrong.
If it sounds like a stylish, clever friend with taste, it's right.

Remember: You're Jules, not ChatGPT. Be yourself.`;
}

// Aggressive closer stripping for practice
function stripPracticeClosers(text) {
  if (!text) return text;
  
  let result = text;
  
  // Remove common AI closers (more aggressive than main chat)
  const badClosers = [
    /\b(?:Alright,?\s*)/i,
    /\b(?:Party animal|champ|jet-setter|buddy|pal)\b/gi,
    /\b(?:You got this|You've got this)\s*[.!?]*$/i,
    /\b(?:I'm here to help)\s*[.!?]*$/i,
    /\b(?:I'm here for you)\s*[.!?]*$/i,
    /\b(?:let me know how I can help)\s*[.!?]*$/i,
    /\b(?:feel free to let me know)\s*[.!?]*$/i,
    /\b(?:what's on your mind next)\s*[.!?]*$/i,
    /\b(?:anything else)\s*[.!?]*$/i,
    /\b(?:any other questions)\s*[.!?]*$/i,
    /\b(?:Have a fantastic time)\s*[.!?]*$/i,
    /\b(?:Enjoy your\s+\w+)\s*[.!?]*$/i,
    /\b(?:Keep it easy-breezy)\s*[.!?]*$/i,
    /\b(?:Keep it breezy)\s*[.!?]*$/i,
    /\b(?:Enjoy putting together your\s+\w+\s+\w+!?)\s*[.!?]*$/i,
    /\b(?:You're all set)\s*[.!?]*$/i,
    /\b(?:Hope that helps)\s*[.!?]*$/i,
    /\b(?:Let me know if)\s*[.!?]*$/i,
    /\b(?:Now go make)\s*[.!?]*$/i,
    /\b(?:You're set)\s*[.!?]*$/i,
    /\b(?:Keep it simple, keep it stylish)\s*[.!?]*$/i,
    /\b(?:Go crush it)\s*[.!?]*$/i,
    /\b(?:Rock that)\s*[.!?]*$/i,
    /\b(?:Nail it)\s*[.!?]*$/i,
    /\b(?:You're good to go)\s*[.!?]*$/i,
    /\b(?:Ready to impress)\s*[.!?]*$/i,
    /\b(?:Now go|Go get|Go turn|Go make)\s+\w+/i
  ];
  
  // Remove banned phrases throughout the text
  const bannedPhrases = [
    /\beffortlessly\s+(?:cool|stylish|confident)\b/gi,
    /\b(?:this look gives off|this says)\b/gi,
    /\b(?:casual yet put-together)\b/gi,
    /\b(?:you'll look effortlessly)\b/gi
  ];
  
  bannedPhrases.forEach(pattern => {
    result = result.replace(pattern, '');
  });
  
  // Remove bad closers at the end
  badClosers.forEach(pattern => {
    result = result.replace(pattern, '').trim();
  });
  
  // Remove "my man" phrases
  result = result.replace(/\bmy\s+man\b/gi, '');
  result = result.replace(/,\s*my\s+man\b/gi, '');
  
  // Clean up extra whitespace
  result = result.replace(/\s+/g, ' ').trim();
  
  return result;
}

// Handle practice requests
exports.handlePractice = async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required.' });
    }
    
    let userId;
    
    // Check for user ID from JWT token
    if (req.user?.sub) {
      userId = req.user.sub;
    } else if (req.user?.userId) {
      userId = req.user.userId;
    } else {
      const host = req.headers.host || '';
      const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1');
      
      if (isLocalhost) {
        userId = 'test_user';
      } else {
        return res.status(401).json({ error: "User not authenticated" });
      }
    }
    
    // Get user and gender context
    let user = null;
    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
      try {
        user = await User.findById(userId);
      } catch (err) {
        console.log('Database query failed, using default user:', err.message);
        user = null;
      }
    }
    
    if (!user) {
      user = { preferences: { gender: 'male' } };
    }
    
    const userGender = (user.preferences && user.preferences.gender) || 'male';
    
    // Get conversation history
    let recentMessages = [];
    let conversation = null;
    if (mongoose.Types.ObjectId.isValid(userId)) {
      conversation = await Conversation.findOne({ userId });
      if (!conversation) {
        conversation = new Conversation({ userId, messages: [] });
      }
      recentMessages = conversation.messages.slice(-10);
      conversation.messages.push({ role: 'user', content: message });
    } else {
      const sessionHistory = getSessionHistory(userId);
      recentMessages = sessionHistory.length > 0 ? sessionHistory.slice(-10) : [];
    }
    
    // Ensure all messages are proper objects
    recentMessages = recentMessages.map(msg => {
      if (typeof msg === 'string') {
        return { role: 'user', content: msg };
      }
      return msg;
    });
    
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      recentMessages.push({ role: 'user', content: message });
    }
    
    // Build system prompt for practice
    const systemPrompt = getPracticeSystemPrompt(userGender);
    
    const messages = [
      { role: 'system', content: systemPrompt },
      ...recentMessages
    ];
    
    // Call OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages,
      max_tokens: 3000,
      temperature: 0.7,
    });
    
    let reply = completion.choices[0].message.content;
    
    // Aggressive closer stripping for practice
    let cleanedReply = stripPracticeClosers(reply);
    const finalReply = cleanedReply.trim();
    
    // Add to session memory
    addSessionMessage(userId, { role: "assistant", content: finalReply });
    
    // Update user memory
    updateUserMemory(userId, { goals: "practice and improvement" });
    
    // Save conversation if valid userId
    if (conversation && mongoose.Types.ObjectId.isValid(userId)) {
      conversation.messages.push({ role: 'assistant', content: finalReply });
      try {
        await conversation.save();
      } catch (saveError) {
        console.error('Error saving conversation:', saveError);
      }
    }
    
    res.json({ reply: finalReply, products: [] });
  } catch (err) {
    console.error('Practice handler error:', err);
    return res.json({ reply: "Ugh, tech hiccup. But I'm still here—hit me again!", products: [] });
  }
}; 