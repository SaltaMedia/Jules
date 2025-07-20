require('dotenv').config();
const { OpenAI } = require('openai');
const Conversation = require('../models/Conversation');
const User = require('../models/User');
const axios = require('axios');
const mongoose = require('mongoose');
const { getUserMemory, updateUserMemory, getMemorySummary, getToneProfile, getRecentMemorySummary, addSessionMessage, getSessionHistory } = require('../utils/userMemoryStore');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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
  
  // Vague chat detection moved to main handler for escalating tone
  
  if (msg.includes("ghosted") || msg.includes("rejected") || msg.includes("lonely") || msg.includes("feel like crap")) return "emotional_support";
  if (msg.includes("wear") || msg.includes("outfit") || msg.includes("style")) return "style_advice";
  if (msg.includes("buy") || msg.includes("link") || msg.includes("recommend") || msg.includes("brand") || msg.includes("show me")) return "product_request";
  if (msg.includes("text her") || msg.includes("first date") || msg.includes("should i say")) return "dating_advice";
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
    return foundProducts.join(", ");
  }
  
  // If no specific products found, extract general clothing terms
  const generalTerms = ["clothing", "outfit", "dress", "wear", "fashion"];
  const foundTerms = generalTerms.filter(term => inputLower.includes(term));
  
  return foundTerms.length > 0 ? foundTerms.join(", ") : "clothing interest";
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
  const basePrompt = `You are Jules — a confident, stylish, emotionally intelligent wingwoman who helps MEN with dating, fashion, and social confidence. You're a sharp, hot, flirty, teasing, fun older sister who's direct, observant, and playful. You care deeply but never coddle. When it matters — like after ghosting or rejection — you're emotionally present, not performative.

You sound like a real person having a natural conversation. You're smart and cool, never robotic or cheesy. You don't act like an assistant — you're just Jules, being yourself.

=====================
HOW YOU TALK
=====================

- Sound natural and conversational, like you're texting a friend
- Use casual language: "yeah", "okay", "ugh", "honestly", "seriously"
- Give your opinion directly: "I think...", "honestly...", "personally..."
- Ask real questions: "What's going on there?", "What are you hoping happens?", "What's the real question?"
- Keep responses short and punchy — 2-3 sentences max
- Don't overthink it — just be yourself

- NEVER say "I'm here for you," "I got you," "let me know if," "hope that helps," or anything customer-servicey
- NEVER over-apologize or over-explain
- NEVER use emojis or formal language
- NEVER talk like ChatGPT ("As an AI...", "Based on your question..." etc.)
- NEVER end with summaries or permission-seeking ("Does that help?", "Want me to...?")

=====================
FASHION GUIDANCE
=====================

- ONLY give MEN'S fashion advice.
- Suggest timeless, masculine staples — well-fitted pieces only.
- Prefer brands like: Buck Mason, Todd Snyder, Taylor Stitch, Aimé Leon Dore, Levi's, J.Crew, Uniqlo, Lululemon, Vans, Huckberry.
- NEVER recommend fast fashion (Shein, Fashion Nova) or try-hard influencer trends.
- NEVER describe the outfit's "vibe." Say what works and why.

🛍️ **Product Rules**
- Only show product cards IF the user asks for brands, items, or examples.
- Products MUST match the advice in the conversation.
- When nothing relevant is available, just say: "Nothing perfect right now, but I'll keep looking."

=====================
DATING & CONFIDENCE
=====================

- When ghosting, rejection, or frustration comes up: NO outfit talk, NO jokes, just real empathy.
- When the user's stuck or vague, ask: "What's the real question?" or "What are you hoping happens?"
- When appropriate, suggest taking action: swipe, lift, make plans, etc.
- NEVER lecture. Say the smart, sharp thing a hot friend would.

=====================
YOUR DEFAULT SETTING
=====================

When unsure: prioritize brevity, taste, and boldness. Better to be sharp than neutral. If something sucks, say it sucks. If something's great, say it's great. Be the friend who tells the truth with love.`;

  return basePrompt;
}

// Simple closer stripping - only remove the most obvious bad closers
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
    /\b(?:Enjoy putting together your\s+\w+\s+\w+!?)\s*[.!?]*$/i
  ];
  
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

// Handle chat requests
exports.handleChat = async (req, res) => {
  const { message } = req.body;
  
  console.log('DEBUG: handleChat called. Incoming message:', message);
  
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
      userId = 'test_user';
      console.warn("⚠️ Using test_user for local development. No persistent memory.");
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
    user = await User.findById(userId);
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
    console.log(`DEBUG: Updated user gender preference to: ${detectedGender}`);
  } else if (detectedGender) {
    // For anonymous users, just update the local object
    user.preferences = user.preferences || {};
    user.preferences.gender = detectedGender;
    console.log(`DEBUG: Updated anonymous user gender preference to: ${detectedGender}`);
  }
  
  // Get user's stored gender preference (default to male if not set)
  const userGender = (user.preferences && user.preferences.gender) || 'male';
  console.log(`DEBUG: Using gender context: ${userGender} (defaults to male unless explicitly stated otherwise)`);
  
  // Classify user intent for routing and behavior control
  const intent = classifyIntent(message);
  console.log(`DEBUG: Classified intent: ${intent}`);
  
  // === TRACK VAGUE CHAT COUNT ===
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
    console.log('DEBUG: VAGUE CHAT DETECTED - count:', userMemory.vagueChatCount);
    console.log('DEBUG: Before increment - vagueChatCount:', userMemory.vagueChatCount - 1);
    console.log('DEBUG: After increment - vagueChatCount:', userMemory.vagueChatCount);

    const vagueCount = userMemory.vagueChatCount;

    // Only trigger escalating response after 2+ vague messages
    if (vagueCount >= 2) {
      console.log('DEBUG: Triggering escalating response - count:', vagueCount);
      
      let vagueResponse;
      if (vagueCount <= 2) {
        vagueResponse = "Yup, I'm here. What's up?\n\nYou bored, avoiding something, or actually want to talk about something? Dating, style, whatever. Just spit it out.";
      } else {
        vagueResponse = "Still doing the vague thing? Come on. What's actually on your mind? You bored? Avoiding work? Or do you actually want advice on something? Let's cut the bullshit.";
      }

      // Save the static message to conversation and return it
      let conversation = null;
      if (mongoose.Types.ObjectId.isValid(userId)) {
        conversation = await Conversation.findOne({ userId });
        if (!conversation) {
          conversation = new Conversation({ userId, messages: [] });
        }
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
      console.log('DEBUG: Reset vague chat count to 0');
    }
  }


  
  // Determine if product cards should be shown based on intent
  const showProductCards = (intent === "product_request");
  console.log(`DEBUG: Show product cards: ${showProductCards}`);
  
  // Very specific regex for actual image/visual requests only
  // Matches: pic, pics, picture, pictures, image, images, visual, visuals, what does it look like, outfit examples, etc.
  // But NOT: show me links, show me products, etc.
  const imageRequestRegex = /(pic|pics|picture|pictures|image|images|visual|visuals|what\s*does\s*it\s*look\s*like|outfit\s*examples?|can\s*i\s*see\s*(it|them)|example\s*of|examples\s*of)/i;
  console.log('DEBUG: Incoming message:', message);
  console.log('DEBUG: imageRequestRegex match:', imageRequestRegex.test(message));
  
  // Only trigger image response for actual image requests, not product/link requests
  // Also exclude common non-image phrases that might contain "like"
  const isImageRequest = imageRequestRegex.test(message) && 
    !/(link|product|buy|shop|where|recommend|suggest|shorts|brand|ten thousand|lululemon|nike|adidas|jacket|shirt|jeans|pants|shoes|boots|suit|blazer|coat|sweater|henley|tee|t-shirt|polo|chinos|vest|waistcoat|sneakers|loafers|oxfords|derbies|pick\s*up\s*line|pickup\s*line|line|conversation|chat|talk|dating|date|girl|woman|women|flirt|flirting|interview|job|company|role|position|tips|advice|help|guidance|assistance|support|question|ask|tell|explain|describe|discuss|talk\s*about|what\s*do\s*you\s*think|opinion|view|perspective|thoughts|feelings|emotions|mood|sad|happy|excited|nervous|worried|stressed|anxious|confident|prepared|ready|tomorrow|today|yesterday|week|month|year|time|schedule|plan|prepare|practice|rehearse|research|study|learn|understand|know|familiar|experience|background|history|story|situation|circumstance|context|details|information|facts|data|statistics|numbers|percentages|rates|scores|grades|results|outcomes|effects|impacts|consequences|benefits|advantages|disadvantages|pros|cons|positives|negatives|good|bad|better|worse|best|worst|improve|enhance|boost|increase|decrease|reduce|minimize|maximize|optimize|perfect|ideal|optimal|suitable|appropriate|relevant|related|connected|linked|associated|correlated|similar|different|unique|special|particular|specific|general|broad|narrow|wide|limited|extended|expanded|detailed|comprehensive|thorough|complete|partial|incomplete|finished|unfinished|done|undone|ready|unready|prepared|unprepared|organized|disorganized|structured|unstructured|planned|unplanned|scheduled|unscheduled|timed|untimed|measured|unmeasured|quantified|unquantified|assessed|unassessed|evaluated|unevaluated|reviewed|unreviewed|examined|unexamined|analyzed|unanalyzed|studied|unstudied|researched|unresearched|investigated|uninvestigated|explored|unexplored|discovered|undiscovered|found|unfound|identified|unidentified|recognized|unrecognized|noticed|unnoticed|observed|unobserved|seen|unseen|viewed|unviewed|watched|unwatched|monitored|unmonitored|tracked|untracked|followed|unfollowed|pursued|unpursued|chased|unchased|hunted|unhunted|sought|unsought|looked|unlooked|searched|unsearched|explored|unexplored|investigated|uninvestigated|examined|unexamined|studied|unstudied|researched|unresearched|analyzed|unanalyzed|reviewed|unreviewed|assessed|unassessed|evaluated|unevaluated|measured|unmeasured|quantified|unquantified|timed|untimed|scheduled|unscheduled|planned|unplanned|organized|disorganized|structured|unstructured|prepared|unprepared|ready|unready|done|undone|finished|unfinished|complete|incomplete|thorough|unthorough|comprehensive|uncomprehensive|detailed|undetailed|extended|unextended|expanded|unexpanded|broad|narrow|wide|limited|general|specific|particular|special|unique|different|similar|correlated|associated|linked|connected|related|relevant|appropriate|suitable|optimal|ideal|perfect|maximize|minimize|reduce|increase|boost|enhance|improve|worst|best|worse|better|bad|good|negatives|positives|cons|pros|disadvantages|advantages|benefits|consequences|impacts|effects|outcomes|results|grades|scores|rates|percentages|numbers|data|facts|information|details|context|circumstance|situation|story|history|background|experience|familiar|know|understand|learn|study|research|practice|rehearse|prepare|plan|schedule|time|year|month|week|yesterday|today|tomorrow|ready|prepared|confident|anxious|stressed|worried|nervous|excited|happy|sad|emotions|feelings|thoughts|perspective|view|opinion|what\s*do\s*you\s*think|discuss|talk\s*about|describe|explain|tell|ask|question|support|assistance|guidance|help|advice|tips|position|role|company|job|interview)/i.test(message);
  
  console.log('DEBUG: isImageRequest:', isImageRequest);
  
  if (isImageRequest) {
    // Save the static message to conversation and return it
    let conversation = null;
    if (mongoose.Types.ObjectId.isValid(userId)) {
      conversation = await Conversation.findOne({ userId });
      if (!conversation) {
        conversation = new Conversation({ userId, messages: [] });
      }
      conversation.messages.push({ role: 'user', content: message });
      conversation.messages.push({ role: 'assistant', content: "I'm not able to pull up images yet, but that's coming soon. In the meantime, I can give you some guidance." });
      await conversation.save();
    }
    return res.json({ reply: "I'm not able to pull up images yet, but that's coming soon. In the meantime, I can give you some guidance.", products: [] });
  }

  // More specific product detection - only trigger for explicit shopping requests
  const clothingOutfitRequest = /(shorts|shoes|jacket|shirt|tee|t-shirt|graphic|jeans|pants|sneakers|boots|suit|blazer|tie|belt|watch|accessory|outfit|clothing|apparel|fashion|dress|wear|brand|ten thousand|lululemon|nike|adidas|brooks|asics|levi|uniqlo|jcrew|target|amazon|loafers|vans)/i.test(message);
  
  // Very specific shopping triggers - only when explicitly asking for products/links
  // Exclude "need advice", "need help", "advice", "help" - only shopping-specific requests
  const askingForRecommendations = /(show\s*me|show\s*me\s*some|how\s*about\s*showing|can\s*you\s*show|help\s*me\s*find|looking\s*for|want|get|buy|find|where\s*can\s*i|recommend|suggest|examples?|options?|links?|any\s*examples?|got\s*examples?)/i.test(message) && !/(need\s*advice|need\s*help|advice|help|outfit\s*advice|style\s*advice)/i.test(message);
  
  // Only trigger product search when asking about clothing/outfits AND asking for shopping links
  // AND NOT asking for advice
  // OR when explicitly asking "Show Me" something
  const isProductRequest = (clothingOutfitRequest && askingForRecommendations && !/(advice|help)/i.test(message)) || /show\s*me/i.test(message);
  
  // Check if user is asking for links to products Jules just mentioned
  const isLinkRequest = /(links?|examples?|show\\s*me|can\\s*you\\s*show|where\\s*can\\s*i|any\\s*examples?|got\\s*examples?)/i.test(message) && !isProductRequest;
  
  console.log('DEBUG: clothingOutfitRequest:', clothingOutfitRequest);
  console.log('DEBUG: askingForRecommendations:', askingForRecommendations);
  console.log('DEBUG: isProductRequest:', isProductRequest);
  console.log('DEBUG: isLinkRequest:', isLinkRequest);
  
  try {
    let conversation = null;
    let recentMessages = [];
    
    if (mongoose.Types.ObjectId.isValid(userId)) {
      conversation = await Conversation.findOne({ userId });
      if (!conversation) {
        conversation = new Conversation({ userId, messages: [] });
      }
      conversation.messages.push({ role: 'user', content: message });
      recentMessages = conversation.messages.slice(-10);
    } else {
      // For invalid userIds, just use the current message
      recentMessages = [{ role: 'user', content: message }];
    }
    
    // === SESSION MEMORY SETUP ===
    addSessionMessage(userId, { role: "user", content: message });
    const convoHistory = getSessionHistory(userId);
    
    // Load user memory and create enhanced memory summary with tone profile
    const tone = getToneProfile(userId);
    const memorySummary = getMemorySummary(userId);
    const recentMemorySummary = getRecentMemorySummary(userId, 7); // Last 7 days
    
    const enhancedMemoryContext = `
TONE: ${tone}

LONG-TERM MEMORY:
${memorySummary}

RECENT MEMORY (Last 7 days):
${recentMemorySummary}
`;

    // === SYSTEM PROMPT WITH PERSONALITY AND CONTEXT ===
    let systemPrompt = getSystemPrompt(userGender);
    
    // Add conversation context and memory
    systemPrompt += `

Conversation so far:
${convoHistory}

${enhancedMemoryContext}`;

    if (intent === "emotional_support") {
      // Add additional instruction to focus only on emotional support
      systemPrompt += "\n\nEMOTIONAL SUPPORT MODE: The user is seeking emotional support. Focus ONLY on emotional validation, listening, and support. Do NOT provide any fashion advice, product recommendations, or style tips. Be empathetic and supportive without suggesting any shopping or style solutions.";
    }
    
    const messages = [
      { role: 'system', content: systemPrompt },
      ...recentMessages
    ];
    
    // Dynamic token management based on conversation context
    let maxTokens;
    const messageCount = messages.length;
    const isAdviceQuestion = /(ghost|date|relationship|breakup|text|message|call|ignore|respond|feel|hurt|confused|frustrated|angry|sad|upset|anxious|nervous|worried|stressed|overthink|doubt|trust|love|like|crush|feelings|emotion)/i.test(message);
    const isProductRequestType = /(show|find|recommend|suggest|buy|shop|product|clothing|outfit|shoes|shirt|pants|jacket)/i.test(message);
    const isSimpleQuestion = /(hi|hello|hey|thanks|thank you|bye|goodbye|yes|no|ok|okay)/i.test(message);
    
    if (isSimpleQuestion) {
      maxTokens = 1500; // Increased for simple interactions
    } else if (isAdviceQuestion) {
      maxTokens = 3000; // Reduced for complex advice to stay within limits
    } else if (isProductRequestType) {
      maxTokens = 3000; // Increased to match advice questions for better personality
    } else if (messageCount > 10) {
      maxTokens = 3000; // Reduced for deep conversations
    } else {
      maxTokens = 2000; // Reduced for general conversation
    }
    
    console.log(`DEBUG: Context-aware token limit - Message count: ${messageCount}, Type: ${isAdviceQuestion ? 'advice' : isProductRequestType ? 'product' : isSimpleQuestion ? 'simple' : 'general'}, Max tokens: ${maxTokens}`);
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages,
      max_tokens: maxTokens,
      temperature: 0.1,
    });
    let reply = completion.choices[0].message.content;
    
    // Guard to prevent over-roleplaying and dating dilemma assumptions
    if (!message.toLowerCase().includes("dating") && reply.toLowerCase().includes("dating dilemma")) {
      reply = reply.replace(/dating dilemma[^.?!]*[.?!]/gi, "");
    }
    
    // Add assistant's response to session memory
    addSessionMessage(userId, { role: "assistant", content: reply });
    
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
        const products = extractProducts(message);
        if (products !== "clothing interest") {
          extractedData.productHistory = products;
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
      console.log('DEBUG: Updated user memory with:', extractedData);
    }
    
    // Debug: Log response length to see if it's being truncated
    console.log('DEBUG: Response length:', reply.length);
    console.log('DEBUG: Response preview:', reply.substring(0, 200) + '...');
    console.log('DEBUG: Response ends with:', reply.substring(reply.length - 50));
    console.log('DEBUG: Full response:', reply);
    
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
    
    // === STRUCTURED PRODUCT QUERY LOGIC ===
    let productQuery = null;
    
    // If this is a product request and we don't have products yet, search for them
    // Only search for products if intent is product_request and showProductCards is true
    if (isProductRequest && products.length === 0 && showProductCards) {
      console.log('DEBUG: Product request detected, creating structured product query...');
      
      // Create structured product query object
      const brandMatch = message.match(/(ten thousand|lululemon|nike|adidas|brooks|asics|levi|uniqlo|jcrew|target|amazon|converse|vans|superga|toms)/i);
      const productMatch = message.match(/(shorts|shoes|jacket|shirt|tee|t-shirt|graphic|jeans|pants|sneakers|boots|suit|blazer|tie|belt|watch|accessory|coat|winter|casual|formal|dress|outfit|loafers|vans|canvas)/i);
      
      // Extract specific product type from message for better matching
      const specificProductMatch = message.match(/(loafers?|sneakers?|vans|boots?|shoes?|shorts?|jeans?|pants?|shirt|tee|t-shirt|graphic|jacket|blazer|suit|tie|belt|watch|canvas)/i);
      
      // Create structured product query object
      if (brandMatch || specificProductMatch) {
        productQuery = {
          type: specificProductMatch ? specificProductMatch[0] : "clothing",
          brands: brandMatch ? [brandMatch[0]] : [],
          context: "men's fashion, casual style",
          searchQuery: ""
        };
        
        // Generate search query based on structured data
        if (brandMatch && specificProductMatch) {
          productQuery.searchQuery = `${brandMatch[0]} men's ${specificProductMatch[0]} buy shop`;
        } else if (brandMatch) {
          productQuery.searchQuery = `${brandMatch[0]} men's clothing buy shop`;
        } else if (specificProductMatch) {
          // Handle "graphic t's" specifically
          if (specificProductMatch[0].toLowerCase().includes('graphic')) {
            productQuery.searchQuery = `men's graphic t-shirts buy shop`;
          } else {
            productQuery.searchQuery = `men's ${specificProductMatch[0]} buy shop`;
          }
        }
        
        console.log('DEBUG: Structured product query:', productQuery);
      }
      
      // Only proceed with search if we have a structured query
      if (productQuery && productQuery.searchQuery) {
        try {
          const apiKey = process.env.GOOGLE_API_KEY;
          const cseId = process.env.GOOGLE_CSE_ID;
          console.log('DEBUG: API Key exists:', !!apiKey);
          console.log('DEBUG: CSE ID exists:', !!cseId);
          console.log('DEBUG: Using structured search query:', productQuery.searchQuery);
        
        const response = await axios.get('https://www.googleapis.com/customsearch/v1', {
          params: {
            key: apiKey,
            cx: cseId,
            q: productQuery.searchQuery,
            num: 6,
            safe: 'active',
          },
        });
        
                const forbidden = /women|woman|dress|gown|skirt|heels|female|bride|girl|girls|ladies|lady|kids|child|children/i;
        const nonProductSites = /youtube\.com|youtu\.be|reddit\.com|instagram\.com|facebook\.com|twitter\.com|tiktok\.com|pinterest\.com|blog|article|news|review|quora|economist|medium|substack|linkedin|tumblr/i;
        const excludedBrands = /men's\s*wearhouse|mens\s*wearhouse|men\s*wearhouse/i;
        
        // Extract the specific product type from the search query for better filtering
        const searchProductType = productQuery.searchQuery.match(/(loafers?|sneakers?|vans|boots?|shoes?|shorts?|jeans?|pants?|shirt|tee|t-shirt|graphic|jacket|blazer|suit|tie|belt|watch)/i);
        
        const searchProducts = (response.data.items || [])
          .filter(item => !forbidden.test(item.title + ' ' + (item.snippet || '')))
          .filter(item => !nonProductSites.test(item.link))
          .filter(item => !excludedBrands.test(item.title + ' ' + (item.snippet || ''))) // Exclude Men's Wearhouse
          .filter(item => /shop|store|buy|product|item|clothing|apparel|fashion/i.test(item.title + ' ' + (item.snippet || ''))) // Only shopping/product sites
          .filter(item => {
            // If we have a specific product type, prioritize items that match it
            if (searchProductType) {
              const productType = searchProductType[0].toLowerCase();
              const itemText = (item.title + ' ' + (item.snippet || '')).toLowerCase();
              return itemText.includes(productType);
            }
            return true;
          })
          .slice(0, 3)
          .map((item, index) => ({
            title: item.title || `Option ${index + 1}`,
            link: item.link,
            image: item.pagemap?.cse_image?.[0]?.src || '',
            price: item.pagemap?.offer?.[0]?.price || '',
            description: item.snippet || '',
          }));
        
        if (searchProducts.length > 0) {
          console.log('DEBUG: Found products:', searchProducts.length);
          console.log('DEBUG: Products found:', JSON.stringify(searchProducts, null, 2));
          products = searchProducts;
        } else {
          console.log('DEBUG: No products found in search results');
          console.log('DEBUG: Raw search results:', JSON.stringify(response.data.items || [], null, 2));
        }
      } catch (productError) {
        console.error('Product search error in chat:', productError);
        // Continue without products if search fails
      }
    }
    }
    
    // If user is asking for links, try to extract product/brand names from last assistant message
    // Only process link requests if intent is product_request and showProductCards is true
    if (isLinkRequest && showProductCards) {
      console.log('DEBUG: Link request detected, extracting products from conversation...');
      
      // Check if this is a request for events/meetups rather than products
      const eventKeywords = /(meetup|workshop|class|event|drawing|art|portland)/i;
      if (eventKeywords.test(message)) {
        // For event/meetup requests, don't search for products
        conversation.messages.push({ role: 'assistant', content: `I don't have direct links to those specific events, but you can check out Meetup.com for Portland art groups, or look up PNCA (Pacific Northwest College of Art) for their class schedules. The Portland Art Museum also has events listed on their website.` });
        await conversation.save();
        return res.json({ reply: `I don't have direct links to those specific events, but you can check out Meetup.com for Portland art groups, or look up PNCA (Pacific Northwest College of Art) for their class schedules. The Portland Art Museum also has events listed on their website.`, products: [] });
      }
      
      // Use the user's message directly for search - prioritize current request over conversation context
      let searchQuery = message;
      const brandMatch = message.match(/(ten thousand|lululemon|nike|adidas|brooks|asics|levi|uniqlo|jcrew|target|amazon)/i);
      const productMatch = message.match(/(shorts|shoes|jacket|shirt|tee|t-shirt|graphic|jeans|pants|sneakers|boots|suit|blazer|tie|belt|watch|accessory|coat|winter|casual|formal|dress|outfit|loafers|vans)/i);
      
      // Extract specific product type from message for better matching
      const specificProductMatch = message.match(/(loafers?|sneakers?|vans|boots?|shoes?|shorts?|jeans?|pants?|shirt|tee|t-shirt|graphic|jacket|blazer|suit|tie|belt|watch)/i);
      
      if (brandMatch && specificProductMatch) {
        searchQuery = `${brandMatch[0]} men's ${specificProductMatch[0]} buy shop`;
      } else if (brandMatch) {
        searchQuery = `${brandMatch[0]} men's clothing buy shop`;
      } else if (specificProductMatch) {
        // Handle "graphic t's" specifically
        if (specificProductMatch[0].toLowerCase().includes('graphic')) {
          searchQuery = `men's graphic t-shirts buy shop`;
        } else {
          searchQuery = `men's ${specificProductMatch[0]} buy shop`;
        }
      } else if (productMatch) {
        searchQuery = `men's ${productMatch[0]} buy shop`;
      } else {
        // Use the original message with "men's" prefix for better results
        searchQuery = `men's ${message} buy shop`;
      }
      
      if (searchQuery) {
        console.log('DEBUG: Using search query from user message:', searchQuery);
        // Run product search for the extracted brands/products
        try {
          const apiKey = process.env.GOOGLE_API_KEY;
          const cseId = process.env.GOOGLE_CSE_ID;
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
          const nonProductSites = /youtube\.com|youtu\.be|reddit\.com|instagram\.com|facebook\.com|twitter\.com|tiktok\.com|pinterest\.com|blog|article|news|review|quora|economist|medium|substack|linkedin|tumblr/i;
          const excludedBrands = /men's\s*wearhouse|mens\s*wearhouse|men\s*wearhouse/i;
          
          // Extract the specific product type from the search query for better filtering
          const searchProductType = searchQuery.match(/(loafers?|sneakers?|vans|boots?|shoes?|shorts?|jeans?|pants?|shirt|tee|t-shirt|graphic|jacket|blazer|suit|tie|belt|watch)/i);
          
          const searchProducts = (response.data.items || [])
            .filter(item => !forbidden.test(item.title + ' ' + (item.snippet || '')))
            .filter(item => !nonProductSites.test(item.link))
            .filter(item => !excludedBrands.test(item.title + ' ' + (item.snippet || ''))) // Exclude Men's Wearhouse
            .filter(item => /shop|store|buy|product|item|clothing|apparel|fashion/i.test(item.title + ' ' + (item.snippet || ''))) // Only shopping/product sites
            .filter(item => {
              // If we have a specific product type, prioritize items that match it
              if (searchProductType) {
                const productType = searchProductType[0].toLowerCase();
                const itemText = (item.title + ' ' + (item.snippet || '')).toLowerCase();
                return itemText.includes(productType);
              }
              return true;
            })
            .slice(0, 3)
            .map((item, index) => ({
              title: item.title || `Option ${index + 1}`,
              link: item.link,
              image: item.pagemap?.cse_image?.[0]?.src || '',
              price: item.pagemap?.offer?.[0]?.price || '',
              description: item.snippet || '',
            }));
          if (searchProducts.length > 0) {
            // Save the link request and product results to conversation
            conversation.messages.push({ role: 'assistant', content: `Here are some links to check out the products I mentioned:` });
            await conversation.save();
            return res.json({ reply: `Here are some links to check out the products I mentioned:`, products: searchProducts });
          } else {
            conversation.messages.push({ role: 'assistant', content: `I couldn't find direct links for those products. Want me to try searching for something else?` });
            await conversation.save();
            return res.json({ reply: `I couldn't find direct links for those products. Want me to try searching for something else?`, products: [] });
          }
        } catch (err) {
          console.error('Product search error for link request:', err);
          conversation.messages.push({ role: 'assistant', content: `Sorry, I couldn't pull up links for those right now. Want me to try searching for something else?` });
          await conversation.save();
          return res.json({ reply: `Sorry, I couldn't pull up links for those right now. Want me to try searching for something else?`, products: [] });
        }
      } else {
        // If we can't extract any product/brand names, ask for clarification
        conversation.messages.push({ role: 'assistant', content: `Are you asking where you can buy the products I just mentioned? If so, let me know which one and I'll try to find links!` });
        await conversation.save();
        return res.json({ reply: `Are you asking where you can buy the products I just mentioned? If so, let me know which one and I'll try to find links!`, products: [] });
      }
    }
    
    const finalReply = cleanedReply.trim();
    console.log('DEBUG: Backend final reply length:', finalReply.length);
    console.log('DEBUG: Backend final reply ends with:', finalReply.substring(finalReply.length - 50));
    console.log('DEBUG: Backend sending response to frontend');
    
    // Only try to save conversation if it exists (valid userId)
    if (conversation && mongoose.Types.ObjectId.isValid(userId)) {
      conversation.messages.push({ role: 'assistant', content: finalReply });
      try {
        await conversation.save();
        console.log('DEBUG: Conversation saved successfully');
      } catch (saveError) {
        console.error('DEBUG: Error saving conversation:', saveError);
        // Don't fail the request if save fails
      }
    }
    
    console.log('DEBUG: About to send JSON response');
    // Only include products in response if showProductCards is true
    const responseProducts = showProductCards ? products : [];
    res.json({ reply: finalReply, products: responseProducts });
    console.log('DEBUG: JSON response sent successfully');
  } catch (err) {
    // Handle CastError specifically for invalid userIds
    if (err.name === 'CastError' && err.kind === 'ObjectId') {
      console.log('DEBUG: Caught CastError for invalid ObjectId:', err.value);
      return res.status(400).json({ error: 'Invalid user ID format' });
    }
    console.error('Chat handler error:', err);
    res.status(500).json({ error: 'Internal server error' });
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
      model: 'gpt-3.5-turbo',
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
    const products = (response.data.items || [])
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
    res.json({ products });
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