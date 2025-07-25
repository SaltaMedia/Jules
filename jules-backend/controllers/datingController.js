// Load dotenv only in development (Railway provides env vars in production)
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}
const { OpenAI } = require('openai');
const Conversation = require('../models/Conversation');
const User = require('../models/User');
const mongoose = require('mongoose');
const { getUserMemory, updateUserMemory, getMemorySummary, getToneProfile, getRecentMemorySummary, addSessionMessage, getSessionHistory } = require('../utils/userMemoryStore');

// Initialize OpenAI client lazily to avoid startup issues
let openai = null;
function getOpenAI() {
  if (!openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openai;
}

// Dating-specific system prompt
function getDatingSystemPrompt(userGender = 'male') {
  return `You are Jules — a confident, stylish, emotionally intelligent AI who helps men level up their dating lives, personal style, social confidence, and communication skills.

You speak like a flirty, stylish, brutally honest older sister. You care, but you don't coddle. You're sharp, observational, and human — never robotic.

Your tone is direct, playful, and real. No hedging. No lectures. Never sound like ChatGPT.

DATING ADVICE MODE - MATCH GPT JULES PATTERN:
- Give strong, specific advice FIRST (like the ghosting example)
- Build confidence and reframe situations positively
- Challenge the user's assumptions or ego when appropriate
- Give specific, actionable advice—not generic tips
- Keep responses short and punchy (2-3 short paragraphs max)
- Be bold, funny, sharp, fast
- Assume the user is smart and dating-curious
- Lead the user with confidence, don't just ask questions

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

// Aggressive closer stripping for dating advice
function stripDatingClosers(text) {
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

// Handle dating requests
exports.handleDating = async (req, res) => {
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
    
    // Build system prompt for dating
    const systemPrompt = getDatingSystemPrompt(userGender);
    
    const messages = [
      { role: 'system', content: systemPrompt },
      ...recentMessages
    ];
    
    // Call OpenAI
    const completion = await getOpenAI().chat.completions.create({
      model: 'gpt-4o',
      messages,
      max_tokens: 3000,
      temperature: 0.7,
    });
    
    let reply = completion.choices[0].message.content;
    
    // Aggressive closer stripping for dating
    let cleanedReply = stripDatingClosers(reply);
    const finalReply = cleanedReply.trim();
    
    // Add to session memory
    addSessionMessage(userId, { role: "assistant", content: finalReply });
    
    // Update user memory
    updateUserMemory(userId, { goals: "dating advice" });
    
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
    console.error('Dating handler error:', err);
    return res.json({ reply: "Ugh, tech hiccup. But I'm still here—hit me again!", products: [] });
  }
}; 