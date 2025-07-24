// Always load dotenv (works in both dev and production)
require('dotenv').config();
const { OpenAI } = require('openai');

// Debug logging helper - enable in production for troubleshooting
const debugLog = (...args) => {
  console.log(...args);
};
const Conversation = require('../models/Conversation');
const User = require('../models/User');
const axios = require('axios');
const mongoose = require('mongoose');
const { getUserMemory, updateUserMemory, getMemorySummary, getToneProfile, getRecentMemorySummary, addSessionMessage, getSessionHistory } = require('../utils/userMemoryStore');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// === MULTI-INTENT ROUTING & MODULAR PROMPT LOGIC ===
const fs = require('fs');
const path = require('path');
const configPath = path.join(__dirname, '../jules_cursor_config.json');
let julesConfig = {};
try {
  julesConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  console.log('=== CONFIG LOADING DEBUG ===');
  console.log('Config path:', configPath);
  console.log('Config file exists:', fs.existsSync(configPath));
  console.log('Config file size:', fs.statSync(configPath).size, 'bytes');
  console.log('Loaded Jules config successfully');
  console.log('Config keys:', Object.keys(julesConfig));
  console.log('Intent routing keys:', Object.keys(julesConfig.intent_routing || {}));
  console.log('Modes available:', Object.keys(julesConfig.modes || {}));
  console.log('Conversation mode style:', julesConfig.modes?.conversation?.style);
  console.log('=== CONFIG LOADING DEBUG END ===');
} catch (err) {
  console.error('=== CONFIG LOADING ERROR ===');
  console.error('Failed to load Jules config:', err);
  console.error('Config path attempted:', configPath);
  console.error('Current directory:', __dirname);
  console.error('Directory contents:', fs.readdirSync(__dirname));
  console.error('Parent directory contents:', fs.readdirSync(path.dirname(__dirname)));
  console.error('=== CONFIG LOADING ERROR END ===');
}

// Intent router using config.intent_routing
function routeIntent(message) {
  const lower = message.toLowerCase();
  for (const [phrase, mode] of Object.entries(julesConfig.intent_routing || {})) {
    if (lower.includes(phrase.toLowerCase())) {
      return mode;
    }
  }
  // Default to conversation
  return 'conversation';
}

// Modular prompt builder
function buildSystemPrompt(mode, userGender, convoHistory, memoryContext) {
  const persona = julesConfig.persona || {};
  const modeConfig = (julesConfig.modes && julesConfig.modes[mode]) || {};
  let prompt = '';
  prompt += `You are Jules, a ${persona.role || ''}. Gender: ${persona.gender || ''}.\n`;
  prompt += `Tone: ${julesConfig.tone_mode || 'natural'}. Style: ${julesConfig.response_style || 'witty'}.\n`;
  prompt += `Mode: ${mode}. ${modeConfig.description || ''}\n`;
  if (modeConfig.style) prompt += `Style: ${modeConfig.style}\n`;
  prompt += `Persona: ${persona.linguistic ? persona.linguistic.join(', ') : ''}.\n`;
  prompt += `Speech: ${persona.speech_patterns && persona.speech_patterns.used ? persona.speech_patterns.used.join(', ') : ''}.\n`;
  prompt += `\nConversation so far:\n${convoHistory}\n`;
  prompt += `\n${memoryContext}\n`;
  prompt += `\nInstructions: ${julesConfig._instructions || ''}`;
  return prompt;
}

// Function to detect and extract gender context from user messages
function detectGenderContext(message) {
  const maleIndicators = /(?:i'?m\s+a\s+man|i'?m\s+male|i'?m\s+a\s+guy|i'?m\s+a\s+dude|but\s+i'?m\s+a\s+man|as\s+a\s+man|for\s+a\s+man|men'?s|guy'?s|male'?s)/i;
  const femaleIndicators = /(?:i'?m\s+a\s+woman|i'?m\s+female|i'?m\s+a\s+girl|but\s+i'?m\s+a\s+woman|as\s+a\s+woman|for\s+a\s+woman|women'?s|girl'?s|female'?s)/i;
  
  if (maleIndicators.test(message)) {
    return 'male';
  } else if (femaleIndicators.test(message)) {
    return 'female';
  }
  return null;
}

// Function to classify user intent for routing and behavior control
function classifyIntent(input) {
  const msg = input.toLowerCase();
  
  debugLog('DEBUG: classifyIntent called with:', input);
  
  // Vague chat detection moved to main handler for escalating tone
  
  if (msg.includes("ghosted") || msg.includes("rejected") || msg.includes("lonely") || msg.includes("feel like crap")) return "emotional_support";
  if (msg.includes("practice") || msg.includes("roleplay") || msg.includes("scenario") || msg.includes("try this")) return "practice";
  // Product requests take priority over style advice
  if (msg.includes("buy") || msg.includes("link") || msg.includes("recommend") || msg.includes("brand") || msg.includes("show me") || msg.includes("jeans") || msg.includes("shoes") || msg.includes("shirt") || msg.includes("pants") || msg.includes("sneakers") || msg.includes("blazer") || msg.includes("jacket") || msg.includes("suit") || msg.includes("coat") || msg.includes("t-shirt") || msg.includes("tshirt") || msg.includes("shorts") || msg.includes("socks") || msg.includes("kicks")) {
    debugLog('DEBUG: classifyIntent detected product_request via keywords');
    return "product_request";
  }
  if (msg.includes("wear") || msg.includes("outfit") || msg.includes("style") || msg.includes("pack") || msg.includes("travel") || msg.includes("europe") || msg.includes("trip") || msg.includes("what should i wear") || msg.includes("what should i rock") || msg.includes("outfit advice") || msg.includes("fashion advice") || msg.includes("style advice") || msg.includes("what to wear") || msg.includes("clothing") || msg.includes("dress") || msg.includes("look") || msg.includes("appearance") || msg.includes("grooming")) return "style_advice";
  if (msg.includes("text her") || msg.includes("first date") || msg.includes("should i say") || msg.includes("date") || msg.includes("dating")) return "dating_advice";
  debugLog('DEBUG: classifyIntent returning general_chat');
  return "general_chat";
}

// Memory extraction functions
function extractStyle(input) {
  const styleKeywords = {
    casual: ["casual", "relaxed", "comfortable", "everyday", "laid-back"],
    streetwear: ["streetwear", "street", "urban", "hip-hop", "sneakerhead"],
    formal: ["formal", "business", "professional", "suit", "dress", "office"],
    athletic: ["athletic", "workout", "gym", "sports", "active", "fitness"],
    minimalist: ["minimalist", "simple", "clean", "basic", "essential"],
    vintage: ["vintage", "retro", "classic", "throwback", "old-school"],
    luxury: ["luxury", "premium", "high-end", "designer", "expensive"],
    outdoor: ["outdoor", "hiking", "camping", "adventure", "outdoorsy"]
  };
  
  const inputLower = input.toLowerCase();
  for (const [style, keywords] of Object.entries(styleKeywords)) {
    if (keywords.some(keyword => inputLower.includes(keyword))) {
      return style;
    }
  }
  return "general";
}

function extractEmotion(input) {
  const emotionKeywords = {
    "felt ghosted": ["ghosted", "ignored", "no response", "disappeared"],
    "experienced rejection": ["rejected", "turned down", "said no", "not interested"],
    "feeling lonely": ["lonely", "alone", "isolated", "single", "by myself"],
    "seeking confidence": ["confident", "confidence", "self-assured", "sure of myself"],
    "feeling anxious": ["nervous", "anxious", "worried", "stressed", "overthinking"],
    "feeling hurt": ["hurt", "pain", "sad", "upset", "disappointed"],
    "feeling excited": ["excited", "thrilled", "pumped", "stoked", "happy"],
    "feeling frustrated": ["frustrated", "annoyed", "irritated", "angry", "mad"]
  };
  
  const inputLower = input.toLowerCase();
  for (const [emotion, keywords] of Object.entries(emotionKeywords)) {
    if (keywords.some(keyword => inputLower.includes(keyword))) {
      return emotion;
    }
  }
  return "general emotional state";
}

function extractProducts(input) {
  debugLog('DEBUG: extractProducts called with:', input);
  
  const productKeywords = [
    "shoes", "boots", "sneakers", "loafers", "oxfords", "derbies",
    "shirt", "tee", "t-shirt", "polo", "henley", "sweater", "hoodie",
    "jeans", "pants", "chinos", "shorts", "joggers", "sweatpants",
    "jacket", "blazer", "suit", "coat", "vest", "waistcoat",
    "tie", "belt", "watch", "accessory", "jewelry", "bag", "backpack"
  ];
  
  const inputLower = input.toLowerCase();
  const foundProducts = productKeywords.filter(product => inputLower.includes(product));
  
  if (foundProducts.length > 0) {
    debugLog('DEBUG: extractProducts found products:', foundProducts);
    return foundProducts.join(", ");
  }
  
  // If no specific products found, extract general clothing terms
  const generalTerms = ["clothing", "outfit", "dress", "wear", "fashion"];
  const foundTerms = generalTerms.filter(term => inputLower.includes(term));
  
  // Only return product-related terms if we actually found something specific
  const result = foundTerms.length > 0 ? foundTerms.join(", ") : null;
  debugLog('DEBUG: extractProducts returning:', result);
  return result;
}

function extractGoals(input) {
  const goalKeywords = {
    "first date preparation": ["first date", "first time meeting", "meeting someone"],
    "relationship building": ["relationship", "dating", "long-term", "serious"],
    "building confidence": ["confidence", "self-esteem", "self-assurance", "feel better"],
    "improving style": ["style", "fashion", "look better", "dress better", "upgrade"],
    "career advancement": ["job", "career", "work", "professional", "interview"],
    "social skills": ["social", "meet people", "friends", "networking", "conversation"],
    "fitness goals": ["fitness", "workout", "gym", "health", "exercise"]
  };
  
  const inputLower = input.toLowerCase();
  for (const [goal, keywords] of Object.entries(goalKeywords)) {
    if (keywords.some(keyword => inputLower.includes(keyword))) {
      return goal;
    }
  }
  return "personal development";
}

// Function to get gender-specific system prompt
function getSystemPrompt(userGender = 'male') {
  const basePrompt = `You are Jules — a confident, stylish, emotionally intelligent AI who helps men level up their dating lives, personal style, social confidence, and communication skills.\n\nYou speak like a flirty, stylish, brutally honest older sister. You care, but you don't coddle. You're sharp, observational, and human — never robotic.\n\nYour tone is direct, playful, and real. No hedging. No lectures. Never sound like ChatGPT.\n\nALWAYS:\n- You can open with brief empathy, but immediately pivot to your strongest, most direct position.\n- Lead with your strongest, most direct position first—even if it's "yes, but only if..." or "no, that's wrong."\n- If the best move is to do nothing, say so directly and explain why. Don't sugarcoat.\n- Challenge the user's assumptions or ego when appropriate. Don't just be supportive—be challenging.\n- If you give a script, make it cheeky and confident, not polite or accommodating.\n- End with strong, actionable advice that pushes the user to take action.\n- When someone asks to practice, take control. Set up scenarios, give feedback, push them to improve.\n- Give specific, actionable advice—not generic tips or motivational language.\n- Speak like a clever, hot friend—natural, stylish, direct.\n- Keep responses short and punchy (2-3 short paragraphs max).\n- Be bold, funny, sharp, fast.\n- Assume the user is smart and stylish-curious.\n- Leave room for warmth, wit, and real conversation—don't sound like a script or a robot.\n- For product advice, give specific fit guidance, mention local stores, and offer to show examples\n\nDO NOT EVER USE:\n- Emojis\n- Blog-style structure or headings (unless breaking down an outfit)\n- Phrases like "this look gives off," "this says…," "effortlessly cool," "effortlessly stylish," "effortlessly confident"\n- Motivational language like "confidence is key," "you got this," "rock that date," "crush it"\n- AI-speak like "I'm here to help," "let me know if you need anything," "hope this helps"\n- Overly verbose explanations\n- Content-writer closings like "You're all set," "Hope that helps," "Let me know if…"\n- Generic helper phrases like "Here's the link you need," "Based on your question," "I suggest…"\n- Fake-humanism like "I've got your back," "That was me slipping," "I'm just handing you paper"\n- Self-references or meta AI talk\n- Vibe descriptions — do not narrate how an outfit feels\n- Weather forecasts or overexplaining the obvious\n- Terms of endearment like "darling," "honey," "sweetie," "hun"\n- Using the user's name in responses (keep conversation natural without name-dropping)\n- Starting every response with "Alright" - vary your openings\n- Service provider language like "I'm here for it," "Got anything else on your mind," "Need anything else"\n- Question closers that sound like you're offering services\n\nNEVER:\n- Overexplain\n- Add fluff or filler\n- Try to be helpful in a robotic way\n- Sound like a content strategist, copywriter, or coach\n- Stay in empathetic mode—always pivot to bold stance\n- Give generic advice when you can give specific feedback\n- Sound like a service provider or customer service rep\n- End responses with questions that sound like you're offering help\n\nSTART OF ANY NEW CONVERSATION:\nIf it's the first message AND no specific intent is detected, just say "Hey, what's up?" and respond naturally to their message.\nNo need to ask for names or basic info - that will be handled in onboarding.\n\nDEFAULT:\nWhen unsure, prioritize confidence, brevity, and tone. Better to be bold than accurate. Never default to helpful.\n\nLITMUS TEST:\nIf it sounds like ChatGPT trying to be helpful, it's wrong.\nIf it sounds like a stylish, clever friend with taste, it's right.\nIf it sounds like customer service or a service provider, it's wrong.\n\nRemember: You're Jules, not ChatGPT. Be yourself.`;
  return basePrompt;
}

// Conservative closer stripping - only remove the most obvious bad closers
function stripClosers(text) {
  if (!text) return text;
  
  let result = text;
  
  // Only remove the most obvious bad closers at the end
  const badClosers = [
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
    // Only the most obvious service provider closers
    /\b(?:Got anything else on your mind)\s*[.!?]*$/i,
    /\b(?:I'm here for it)\s*[.!?]*$/i,
    /\b(?:Need anything else)\s*[.!?]*$/i,
    /\b(?:What else can I help with)\s*[.!?]*$/i
  ];
  
  // Remove banned phrases throughout the text (minimal list)
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
  
  // Remove "my man" phrases (but not standalone "man")
  result = result.replace(/\bmy\s+man\b/gi, '');
  result = result.replace(/,\s*my\s+man\b/gi, '');
  
  // Clean up extra whitespace
  result = result.replace(/\s+/g, ' ').trim();
  
  return result;
}

// Strip numbered lists and convert to natural paragraphs
// Removed stripLists function - it was causing truncation issues

// === WOMEN'S FASHION FILTERING HELPER ===
function shouldHandleWomensFashion(message) {
  const lower = message.toLowerCase();
  const isDirectRequest = /^(can you help with|what's stylish for|recommend.*for|what should)\s+(women|girls|ladies|females)/i.test(lower);
  const isGiftingContext = /gift|shopping.*(her|girlfriend|wife|partner)|styling.*(her|girlfriend|partner)|help.*(her|girlfriend|pack|choose|pick)/i.test(lower);
  return isGiftingContext || !isDirectRequest;
}

// Handle chat requests
exports.handleChat = async (req, res) => {
  try {
    const { message } = req.body;
    
    debugLog('DEBUG: handleChat called. Incoming message:', message);
    debugLog('DEBUG: Request body:', req.body);
    debugLog('DEBUG: Request user:', req.user);
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required.' });
    }
    
    let userId;
    
    // Check for user ID from JWT token (handles both Auth0 and Google OAuth)
    if (req.user?.sub) {
      // Auth0 format
      userId = req.user.sub;
    } else if (req.user?.userId) {
      // Google OAuth format
      userId = req.user.userId;
    } else {
      const host = req.headers.host || '';
      const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1');
      
      if (isLocalhost) {
        // Create a consistent MongoDB ObjectId for test user to enable MongoDB session testing
        const mongoose = require('mongoose');
        userId = new mongoose.Types.ObjectId('507f1f77bcf86cd799439011'); // Consistent test user ID
        console.warn("⚠️ Using test_user ObjectId for local development. MongoDB session testing enabled.");
      } else {
        return res.status(401).json({ error: "User not authenticated" });
      }
    }
    
    console.log(`✅ Using user ID: ${userId}`);

    // Check for gender context in the current message
    const detectedGender = detectGenderContext(message);
    
    // Get or create user and update gender preference if detected
    let user = null;
    
    // Check if userId is a valid ObjectId
    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
      try {
        user = await User.findById(userId);
      } catch (err) {
        debugLog('Database query failed, using default user:', err.message);
        user = null;
      }
    }
    
    if (!user) {
      // For anonymous users or invalid userIds, don't create a User record - just use a default gender preference
      // The User model requires an email, so we can't create anonymous users
      user = { preferences: { gender: 'male' } };
    }
    
    // Update gender preference if detected in current message
    if (detectedGender && user._id) {
      // Only save if this is a real user (has _id), not an anonymous user
      user.preferences = user.preferences || {};
      user.preferences.gender = detectedGender;
      await user.save();
      debugLog(`DEBUG: Updated user gender preference to: ${detectedGender}`);
    } else if (detectedGender) {
      // For anonymous users, just update the local object
      user.preferences = user.preferences || {};
      user.preferences.gender = detectedGender;
      debugLog(`DEBUG: Updated anonymous user gender preference to: ${detectedGender}`);
    }
    
    // Get user's stored gender preference (default to male if not set)
    const userGender = (user.preferences && user.preferences.gender) || 'male';
    debugLog(`DEBUG: Using gender context: ${userGender} (defaults to male unless explicitly stated otherwise)`);
    
    // === LOAD CONVERSATION HISTORY FIRST ===
    let recentMessages = [];
    let conversation = null;
    let isNewSession = false;
    
    if (mongoose.Types.ObjectId.isValid(userId)) {
      conversation = await Conversation.findOne({ userId });
      if (!conversation) {
        conversation = new Conversation({ userId, messages: [] });
        isNewSession = true;
      }
      // Load conversation history for context
      recentMessages = conversation.messages.slice(-10);
    } else {
      // For invalid userIds (like test_user), use session memory to track conversation
      const sessionHistory = getSessionHistory(userId);
      if (sessionHistory.length === 0) {
        isNewSession = true;
      }
      recentMessages = sessionHistory.length > 0 ? sessionHistory.slice(-10) : [];
    }
    
    debugLog('DEBUG: Is new session:', isNewSession);
    debugLog('DEBUG: Recent messages count:', recentMessages.length);
    
    // === VAGUE CHAT ESCALATION SYSTEM ===
    const userMemory = getUserMemory(userId);
    if (!userMemory.vagueChatCount) userMemory.vagueChatCount = 0;

    // Only trigger vague chat detection on truly standalone vague messages
    // Messages with substantive content should not trigger vague chat escalation
    const isVague = (message.toLowerCase().trim() === "hey" || 
                     message.toLowerCase().trim() === "hi" || 
                     message.toLowerCase().trim() === "hello" || 
                     message.toLowerCase().trim() === "hello?" || 
                     message.toLowerCase().trim() === "wyd" || 
                     message.toLowerCase().trim() === "you there" || 
                     message.toLowerCase().trim() === "you there?" || 
                     message.toLowerCase().trim() === "?" || 
                     message.toLowerCase().trim() === "lol" || 
                     message.toLowerCase().trim() === "idk" || 
                     message.toLowerCase().trim() === "nothing really" || 
                     message.toLowerCase().trim() === "just chatting") && 
                     !/(ghost|ghosted|date|text|sent|already|thinking|advice|help|style|outfit|suit|shoes|jacket|shirt|pants|jeans|sneakers|boots|loafers|dating|relationship|breakup|feel|hurt|confused|frustrated|angry|sad|upset|anxious|nervous|worried|stressed|overthink|doubt|trust|love|like|crush|feelings|emotion|party|wedding|coffee|shop|tomorrow|weekend|today|yesterday|morning|night|evening|afternoon|time|schedule|plan|prepare|practice|rehearse|research|study|learn|understand|know|familiar|experience|background|history|story|situation|circumstance|context|details|information|facts|data|statistics|numbers|percentages|rates|scores|grades|results|outcomes|effects|impacts|consequences|benefits|advantages|disadvantages|pros|cons|positives|negatives|good|bad|better|worse|best|worst|improve|enhance|boost|increase|decrease|reduce|minimize|maximize|optimize|perfect|ideal|optimal|suitable|appropriate|relevant|related|connected|linked|associated|correlated|similar|different|unique|special|particular|specific|general|broad|narrow|wide|limited|extended|expanded|detailed|comprehensive|thorough|complete|partial|incomplete|finished|unfinished|done|undone|ready|unready|prepared|unprepared|organized|disorganized|structured|unstructured|planned|unplanned|scheduled|unscheduled|timed|untimed|measured|unmeasured|quantified|unquantified|assessed|unassessed|evaluated|unevaluated|reviewed|unreviewed|examined|unexamined|analyzed|unanalyzed|studied|unstudied|researched|unresearched|investigated|uninvestigated|explored|unexplored|discovered|undiscovered|found|unfound|identified|unidentified|recognized|unrecognized|noticed|unnoticed|observed|unobserved|seen|unseen|viewed|unviewed|watched|unwatched|monitored|unmonitored|tracked|untracked|followed|unfollowed|pursued|unpursued|chased|unchased|hunted|unhunted|sought|unsought|looked|unlooked|searched|unsearched|explored|unexplored|investigated|uninvestigated|examined|unexamined|studied|unstudied|researched|unresearched|analyzed|unanalyzed|reviewed|unreviewed|assessed|unassessed|evaluated|unevaluated|measured|unmeasured|quantified|unquantified|timed|untimed|scheduled|unscheduled|planned|unplanned|organized|disorganized|structured|unstructured|prepared|unprepared|ready|unready|done|undone|finished|unfinished|complete|incomplete|thorough|unthorough|comprehensive|uncomprehensive|detailed|undetailed|extended|unextended|expanded|unexpanded|broad|narrow|wide|limited|general|specific|particular|special|unique|different|similar|correlated|associated|linked|connected|related|relevant|appropriate|suitable|optimal|ideal|perfect|maximize|minimize|reduce|increase|boost|enhance|improve|worst|best|worse|better|bad|good|negatives|positives|cons|pros|disadvantages|advantages|benefits|consequences|impacts|effects|outcomes|results|grades|scores|rates|percentages|numbers|data|facts|information|details|context|circumstance|situation|story|history|background|experience|familiar|know|understand|learn|study|research|practice|rehearse|prepare|plan|schedule|time|year|month|week|yesterday|today|tomorrow|ready|prepared|confident|anxious|stressed|worried|nervous|excited|happy|sad|emotions|feelings|thoughts|perspective|view|opinion|what\s*do\s*you\s*think|discuss|talk\s*about|describe|explain|tell|ask|question|support|assistance|guidance|help|advice|tips|position|role|company|job|interview)/i.test(message);

    if (isVague) {
      userMemory.vagueChatCount += 1;
      debugLog('DEBUG: VAGUE CHAT DETECTED - count:', userMemory.vagueChatCount);

      const vagueCount = userMemory.vagueChatCount;

      // Only trigger escalating response after 2+ vague messages
      if (vagueCount >= 2) {
        debugLog('DEBUG: Triggering escalating response - count:', vagueCount);
        
        let vagueResponse;
        if (vagueCount <= 2) {
          vagueResponse = "Yup, I'm here. What's up?\n\nYou bored, avoiding something, or actually want to talk about something? Dating, style, whatever. Just spit it out.";
        } else {
          vagueResponse = "Still doing the vague thing? Come on. What's actually on your mind? You bored? Avoiding work? Or do you actually want advice on something? Let's cut the bullshit.";
        }

        // Save the static message to conversation and return it
        if (mongoose.Types.ObjectId.isValid(userId)) {
          conversation.messages.push({ role: 'user', content: message });
          conversation.messages.push({ role: 'assistant', content: vagueResponse });
          await conversation.save();
        }
        return res.json({ reply: vagueResponse, products: [] });
      }
    } else {
      // Reset vague chat count if user sends a substantive message
      if (userMemory.vagueChatCount > 0) {
        userMemory.vagueChatCount = 0;
        debugLog('DEBUG: Reset vague chat count to 0');
      }
    }
    
    // Create context-aware message for intent classification
    const conversationContext = recentMessages.map(msg => msg.content).join(' ');
    const contextAwareMessage = `${conversationContext} ${message}`.trim();
    
    // === INTENT ROUTING WITH CONTEXT ===
    debugLog('=== INTENT ROUTING DEBUG ===');
    debugLog('DEBUG: Jules config loaded:', !!julesConfig.intent_routing);
    debugLog('DEBUG: Available intent routing:', Object.keys(julesConfig.intent_routing || {}));
    debugLog('DEBUG: Conversation context length:', conversationContext.length);
    debugLog('DEBUG: Context-aware message:', contextAwareMessage.substring(0, 200) + '...');
    const routedMode = routeIntent(contextAwareMessage);
    const intent = classifyIntent(contextAwareMessage);
    debugLog('DEBUG: Intent classification result:', intent);
    debugLog('DEBUG: Routed mode result:', routedMode);
    debugLog('DEBUG: Message being routed:', message);
    debugLog('=== INTENT ROUTING DEBUG END ===');
    
    // Use intent classification to route to specialized handlers
    if (intent === "emotional_support" || intent === "dating_advice") {
      // Route to dating controller
      const { handleDating } = require('./datingController');
      return handleDating(req, res);
    } else if (intent === "practice" || message.toLowerCase().includes("practice") || message.toLowerCase().includes("roleplay")) {
      // Route to practice controller
      const { handlePractice } = require('./practiceController');
      return handlePractice(req, res);
    } else if (intent === "style_advice" || message.toLowerCase().includes("pack") || message.toLowerCase().includes("travel") || message.toLowerCase().includes("outfit") || message.toLowerCase().includes("wear") || message.toLowerCase().includes("what should i wear") || message.toLowerCase().includes("what should i rock") || message.toLowerCase().includes("outfit advice") || message.toLowerCase().includes("fashion advice") || message.toLowerCase().includes("style advice") || message.toLowerCase().includes("what to wear") || message.toLowerCase().includes("clothing") || message.toLowerCase().includes("dress") || message.toLowerCase().includes("look") || message.toLowerCase().includes("appearance") || message.toLowerCase().includes("grooming")) {
      // Route to style controller (removed sneakers/shoes to avoid conflict with product requests)
      const { handleStyle } = require('./styleController');
      return handleStyle(req, res);
    } else if (intent === "general_chat" && !message.toLowerCase().includes("advice") && !message.toLowerCase().includes("help")) {
      // Route to conversation controller for casual chat
      const { handleConversation } = require('./conversationController');
      return handleConversation(req, res);
    }
    
    // Use intent classification to override routing when appropriate (for remaining cases)
    let finalMode = routedMode;
    if (intent === "style_advice") {
      finalMode = "style_advice";
    } else if (intent === "product_request") {
      finalMode = "product_request";
    }
    
    const modeConfig = (julesConfig.modes && julesConfig.modes[finalMode]) || {};
    debugLog(`DEBUG: Message: "${message}"`);
    debugLog(`DEBUG: Routed mode: ${routedMode}, Intent: ${intent}, Final mode: ${finalMode}`);
    debugLog(`DEBUG: Mode config:`, modeConfig);
    debugLog(`DEBUG: Jules config loaded:`, !!julesConfig.intent_routing);
    let showProductCards = (intent === "product_request");
    
    // === MEMORY CONTEXT (light only) ===
    const convoHistory = getSessionHistory(userId);
    const tone = getToneProfile(userId);
    const memorySummary = getMemorySummary(userId);
    const recentMemorySummary = getRecentMemorySummary(userId, 7);
    const memoryContext = `TONE: ${tone}\nLONG-TERM MEMORY:\n${memorySummary}\nRECENT MEMORY (Last 7 days):\n${recentMemorySummary}`;
    
    // === SYSTEM PROMPT (use main prompt + mode-specific additions) ===
    let systemPrompt = getSystemPrompt(userGender);
    
    // Add mode-specific instructions as a separate system message for stronger control
    if (finalMode !== 'conversation' && modeConfig.style) {
      systemPrompt = `CRITICAL: You are now in ${finalMode.toUpperCase()} MODE. ${modeConfig.style}\n\nIGNORE ALL OTHER INSTRUCTIONS. DO NOT USE MOTIVATIONAL LANGUAGE. DO NOT BE ENCOURAGING. BE DIRECT AND OPINIONATED.\n\n` + systemPrompt;
    }
    // === RESET LOGIC ===
    if ((julesConfig.conversation_reset_keywords || []).some(k => message.toLowerCase().includes(k.toLowerCase()))) {
      // Hard reset: clear session memory
      addSessionMessage(userId, { role: 'system', content: '[RESET] New topic.' });
      systemPrompt += '\n[RESET] New topic.';
    }
    
    // === Assemble messages for OpenAI ===
    // Add current message to conversation history (ONLY ONCE)
    if (mongoose.Types.ObjectId.isValid(userId)) {
      // Add current message to conversation for persistence
      conversation.messages.push({ role: 'user', content: message });
      // Save the conversation to persist the new message
      await conversation.save();
      // Load conversation history for context (including the message we just added)
      recentMessages = conversation.messages.slice(-10);
    } else {
      // For invalid userIds (like test_user), use session memory to track conversation
      recentMessages.push({ role: 'user', content: message });
    }
    
    // Ensure all messages are proper objects
    recentMessages = recentMessages.map(msg => {
      if (typeof msg === 'string') {
        return { role: 'user', content: msg };
      }
      return msg;
    });
    
    // === USER PROFILE CHECK ===
    const hasUserProfile = user && user._id && (user.name || user.email);
    const isFirstMessage = recentMessages.length === 1 && recentMessages[0].role === 'user';
    
    // Add user profile context to system prompt
    if (hasUserProfile) {
      systemPrompt += `\n\nUSER CONTEXT: User has a profile. Name: ${user.name || 'Not set'}. Email: ${user.email || 'Not set'}. Do not ask for basic info again.`;
    } else if (isFirstMessage) {
      systemPrompt += `\n\nUSER CONTEXT: New user, no profile. Ask for name and basic info.`;
    } else {
      systemPrompt += `\n\nUSER CONTEXT: Returning user, no profile. Respond naturally without re-introducing.`;
    }
    
    // === NEW SESSION WELCOME MESSAGE ===
    if (isNewSession && isFirstMessage) {
      const userName = user && user.name ? user.name : 'there';
      systemPrompt += `\n\nNEW SESSION: This is a new conversation session. Start with a simple greeting like "Hi ${userName}! What's going on?" Do not ask for basic info or introduce yourself extensively.`;
    }
    
    const messages = [
      { role: 'system', content: systemPrompt },
      ...recentMessages
    ];
    const messageCount = messages.length;
    // === Max tokens per mode ===
    let maxTokens = modeConfig.max_tokens || 2000;
    const isAdviceQuestion = /(ghost|date|relationship|breakup|text|message|call|ignore|respond|feel|hurt|confused|frustrated|angry|sad|upset|anxious|nervous|worried|stressed|overthink|doubt|trust|love|like|crush|feelings|emotion)/i.test(message);
    const isProductRequestType = /(show|find|recommend|suggest|buy|shop|product|clothing|outfit|shoes|shirt|pants|jacket)/i.test(message);
    const isSimpleQuestion = /(hi|hello|hey|thanks|thank you|bye|goodbye|yes|no|ok|okay)/i.test(message);

    if (isSimpleQuestion) {
      maxTokens = 1500;
    } else if (isAdviceQuestion) {
      maxTokens = 3000;
    } else if (isProductRequestType) {
      maxTokens = 2000;
    } else if (messageCount > 10) {
      maxTokens = 3000;
    } else {
      maxTokens = 2000;
    }
    
    // === Debug logging before OpenAI call ===
    debugLog("Intent:", intent);
    debugLog("Mode:", routedMode);
    debugLog("System prompt:", systemPrompt);
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages,
      max_tokens: maxTokens,
      temperature: 0.7,
    });
    let reply = completion.choices[0].message.content;

    // === Enforce reply style ===
    // (Add any additional reply post-processing here if needed)
    // Guard to prevent over-roleplaying and dating dilemma assumptions
    if (!message.toLowerCase().includes("dating") && reply.toLowerCase().includes("dating dilemma")) {
      reply = reply.replace(/dating dilemma[^.?!]*[.?!]/gi, "");
    }

    // === WOMEN'S FASHION BLOCKER ===
    if (!shouldHandleWomensFashion(message)) {
      reply = "I’m not your girl for women’s fashion — unless it’s for a gift or you’re styling someone. That I can help with. Just give me the context.";
      products = [];
    }

    // Add assistant's response to session memory and conversation history
    addSessionMessage(userId, { role: "assistant", content: reply });
    
    // Save assistant's response to MongoDB conversation if using valid userId
    if (mongoose.Types.ObjectId.isValid(userId) && conversation) {
      conversation.messages.push({ role: 'assistant', content: reply });
      await conversation.save();
    }
    
    // Update user memory based on intent with enhanced extraction
    const extractedData = {};
    
    switch (intent) {
      case "style_advice":
        const style = extractStyle(message);
        if (style !== "general") {
          extractedData.stylePreferences = style;
        }
        break;
      case "emotional_support":
        const emotion = extractEmotion(message);
        if (emotion !== "general emotional state") {
          extractedData.emotionalNotes = emotion;
        }
        break;
      case "product_request":
        const extractedProducts = extractProducts(message);
        if (extractedProducts !== "clothing interest") {
          extractedData.productHistory = extractedProducts;
        }
        break;
      case "dating_advice":
        const goal = extractGoals(message);
        if (goal !== "personal development") {
          extractedData.goals = goal;
        }
        break;
    }
    
    // Only update memory if we extracted meaningful data
    if (Object.keys(extractedData).length > 0) {
      updateUserMemory(userId, extractedData);
      debugLog('DEBUG: Updated user memory with:', extractedData);
    }
    
    // === ENHANCED DEBUG LOGGING ===
    debugLog('=== PRODUCTION DEBUG START ===');
    debugLog('DEBUG: User ID:', userId);
    debugLog('DEBUG: Message count:', messageCount);
    debugLog('DEBUG: Max tokens:', maxTokens);
    debugLog('DEBUG: Temperature:', 0.7);
    debugLog('DEBUG: Model: gpt-4o');
    debugLog('DEBUG: Intent:', intent);
    debugLog('DEBUG: Mode:', routedMode);
    debugLog('DEBUG: Final mode:', finalMode);
    
    // Log memory context
    debugLog('DEBUG: Memory context length:', memoryContext.length);
    debugLog('DEBUG: Memory context preview:', memoryContext.substring(0, 200) + '...');
    
    // Log conversation history
    debugLog('DEBUG: Recent messages count:', recentMessages.length);
    debugLog('DEBUG: Recent messages:', JSON.stringify(recentMessages, null, 2));
    
    // Log system prompt
    debugLog('DEBUG: System prompt length:', systemPrompt.length);
    debugLog('DEBUG: System prompt preview:', systemPrompt.substring(0, 300) + '...');
    
    // Log OpenAI API call details
    debugLog('DEBUG: OpenAI API call - messages count:', messages.length);
    debugLog('DEBUG: OpenAI API call - first message role:', messages[0].role);
    debugLog('DEBUG: OpenAI API call - last message role:', messages[messages.length - 1].role);
    
    // Log OpenAI response
    debugLog('DEBUG: OpenAI raw response:', JSON.stringify(completion, null, 2));
    debugLog('DEBUG: Response length:', reply.length);
    debugLog('DEBUG: Response preview:', reply.substring(0, 200) + '...');
    debugLog('DEBUG: Response ends with:', reply.substring(reply.length - 50));
    debugLog('DEBUG: Full response:', reply);
    debugLog('=== PRODUCTION DEBUG END ===');
    
    // Parse product Markdown links in the reply and convert to structured product objects
    let products = [];
    let cleanedReply = stripClosers(reply);
    const productLinkRegex = /!\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;
    let match;
    while ((match = productLinkRegex.exec(reply)) !== null) {
      products.push({
        title: match[1],
        link: match[2],
        image: '',
        price: '',
        description: '',
      });
      cleanedReply = cleanedReply.replace(match[0], '');
    }
    
    // Product search is now handled by the products route for better functionality
    
    const finalReply = cleanedReply.trim();
    
    // For product requests, always use the products route for intelligent context extraction and brand-specific searching
    if (intent === "product_request" && showProductCards) {
      debugLog('DEBUG: Product request detected, routing to products route...');
      
      try {
        const productsResponse = await axios.post(`${req.protocol}://${req.get('host')}/api/products`, {
          message,
          conversation,
          julesResponse: finalReply // Pass Jules's current response so products route can extract brands from it
        }, {
          headers: {
            'Authorization': req.headers.authorization,
            'Content-Type': 'application/json'
          }
        });
        
        if (productsResponse.data.hasProducts && productsResponse.data.products.length > 0) {
          debugLog('DEBUG: Products found via route:', productsResponse.data.products.length);
          // Replace the products array with the intelligent results from the products route
          products = [...productsResponse.data.products]; // Create new array with products from route
          showProductCards = true;
        } else {
          debugLog('DEBUG: No products found via route');
        }
      } catch (err) {
        console.error('Products route error:', err);
        // Let the AI handle the fallback response naturally
      }
    }
    
    debugLog('DEBUG: Backend final reply length:', finalReply.length);
    debugLog('DEBUG: Backend final reply ends with:', finalReply.substring(finalReply.length - 50));
    debugLog('DEBUG: Backend sending response to frontend');
    
    // Save conversation with assistant's response (ONLY ONCE)
    if (conversation && mongoose.Types.ObjectId.isValid(userId)) {
      conversation.messages.push({ role: 'assistant', content: finalReply });
      try {
        await conversation.save();
        debugLog('DEBUG: Conversation saved successfully');
      } catch (saveError) {
        console.error('DEBUG: Error saving conversation:', saveError);
        // Don't fail the request if save fails
      }
    }
    
    debugLog('DEBUG: About to send JSON response');
    // Only include products in response if showProductCards is true
    const finalProducts = showProductCards ? products : [];
    res.json({ reply: finalReply, products: finalProducts });
    debugLog('DEBUG: JSON response sent successfully');
  } catch (err) {
    // Handle CastError specifically for invalid userIds
    if (err.name === 'CastError' && err.kind === 'ObjectId') {
      debugLog('DEBUG: Caught CastError for invalid ObjectId:', err.value);
      return res.status(400).json({ error: 'Invalid user ID format' });
    }
    console.error('Chat handler error:', err);
    // Universal fallback reply
    return res.json({ reply: "Ugh, tech hiccup. But I’m still here—hit me again or ask anything!", products: [] });
  }
};

exports.imageSearch = async (req, res) => {
  res.json({
    images: [],
    message: "I'm not able to pull up images yet, but that's coming soon. In the meantime, I can give you some guidance."
  });
};

// Update productSearch to return product cards
exports.productSearch = async (req, res) => {
  let { query } = req.body;
  if (!query) return res.status(400).json({ error: 'Query is required.' });
  const apiKey = process.env.GOOGLE_API_KEY;
  const cseId = process.env.GOOGLE_CSE_ID;
  let searchQuery = query;
  try {
    const llmResult = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: "You are an expert menswear stylist. Given a product request, generate a Google search query that will return only real, reputable men's product links for that item. Focus on shopping sites and product pages. Examples: 'men's white sneakers buy shop', 'Ten Thousand shorts purchase', 'Lululemon men's workout gear shop'. Keep it simple and direct." },
        { role: 'user', content: query }
      ]
    });
    searchQuery = llmResult.choices[0].message.content.trim();
  } catch (e) {
    if (!/men|guy|male|gentleman|menswear/i.test(query)) {
      searchQuery = `men's ${query} buy shop`;
    } else {
      searchQuery = `${query} buy shop`;
    }
  }
  try {
    const response = await axios.get('https://www.googleapis.com/customsearch/v1', {
      params: {
        key: apiKey,
        cx: cseId,
        q: searchQuery,
        num: 6,
        safe: 'active',
      },
    });
    const forbidden = /women|woman|dress|gown|skirt|heels|female|bride|girl|girls|ladies|lady|kids|child|children/i;
    const nonProductSites = /youtube\.com|youtu\.be|reddit\.com|instagram\.com|facebook\.com|twitter\.com|tiktok\.com|pinterest\.com|blog|article|news|review/i;
    // Try to extract product info (name, image, price, description, link)
              const searchResults = (response.data.items || [])
      .filter(item => !forbidden.test(item.title + ' ' + (item.snippet || '')))
      .filter(item => !nonProductSites.test(item.link))
      .slice(0, 4)
      .map(item => ({
        title: item.title,
        link: item.link,
        image: item.pagemap?.cse_image?.[0]?.src || '',
        price: item.pagemap?.offer?.[0]?.price || '',
        description: item.snippet || '',
      }));
    res.json({ products: searchResults });
  } catch (err) {
    console.error('Product search error:', err.response ? err.response.data : err.message);
    res.status(500).json({ error: 'Product search failed.', details: err.response ? err.response.data : err.message });
  }
};

// Get chat history for a user
exports.getChatHistory = async (req, res) => {
  const { userId } = req.params;
  
  if (!userId) {
    return res.status(400).json({ error: 'UserId is required.' });
  }

  try {
    const conversation = await Conversation.findOne({ userId });
    
    if (!conversation) {
      return res.json({ messages: [] });
    }

    res.json({ 
      messages: conversation.messages,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt
    });
  } catch (err) {
    console.error('Error retrieving chat history:', err);
    res.status(500).json({ error: 'Error retrieving chat history.' });
  }
};