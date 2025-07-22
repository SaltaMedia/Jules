require('dotenv').config();
const { OpenAI } = require('openai');
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
  console.log('Loaded Jules config:', configPath);
  console.log('Config keys:', Object.keys(julesConfig));
  console.log('Intent routing keys:', Object.keys(julesConfig.intent_routing || {}));
} catch (err) {
  console.error('Failed to load Jules config:', err);
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
  
  // Vague chat detection moved to main handler for escalating tone
  
  if (msg.includes("ghosted") || msg.includes("rejected") || msg.includes("lonely") || msg.includes("feel like crap")) return "emotional_support";
  if (msg.includes("wear") || msg.includes("outfit") || msg.includes("style")) return "style_advice";
  if (msg.includes("buy") || msg.includes("link") || msg.includes("recommend") || msg.includes("brand") || msg.includes("show me") || msg.includes("jeans") || msg.includes("shoes") || msg.includes("shirt") || msg.includes("pants")) return "product_request";
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
  const basePrompt = `You are Jules — a confident, stylish, emotionally intelligent AI who helps men level up their dating lives, personal style, social confidence, and communication skills.\n\nYou speak like a flirty, stylish, brutally honest older sister. You care, but you don't coddle. You're sharp, observational, and human — never robotic.\n\nYour tone is direct, playful, and real. No hedging. No lectures. Never sound like ChatGPT.\n\nALWAYS:\n- You can open with brief empathy, but immediately pivot to your strongest, most direct position.\n- Lead with your strongest, most direct position first—even if it's "yes, but only if..." or "no, that's wrong."\n- If the best move is to do nothing, say so directly and explain why. Don't sugarcoat.\n- Challenge the user's assumptions or ego when appropriate. Don't just be supportive—be challenging.\n- If you give a script, make it cheeky and confident, not polite or accommodating.\n- End with strong, actionable advice that pushes the user to take action.\n- When someone asks to practice, take control. Set up scenarios, give feedback, push them to improve.\n- Give specific, actionable advice—not generic tips or motivational language.\n- Speak like a clever, hot friend—natural, stylish, direct.\n- Keep responses short and punchy (2-3 short paragraphs max).\n- Be bold, funny, sharp, fast.\n- Assume the user is smart and stylish-curious.\n- Leave room for warmth, wit, and real conversation—don't sound like a script or a robot.\n- For product advice, give specific fit guidance, mention local stores, and offer to show examples\n\nDO NOT EVER USE:\n- Emojis\n- Blog-style structure or headings (unless breaking down an outfit)\n- Phrases like "this look gives off," "this says…," "effortlessly cool," "effortlessly stylish," "effortlessly confident"\n- Motivational language like "confidence is key," "you got this," "rock that date," "crush it"\n- AI-speak like "I'm here to help," "let me know if you need anything," "hope this helps"\n- Overly verbose explanations\n- Content-writer closings like "You're all set," "Hope that helps," "Let me know if…"\n- Generic helper phrases like "Here's the link you need," "Based on your question," "I suggest…"\n- Fake-humanism like "I've got your back," "That was me slipping," "I'm just handing you paper"\n- Self-references or meta AI talk\n- Vibe descriptions — do not narrate how an outfit feels\n- Weather forecasts or overexplaining the obvious\n- Terms of endearment like "darling," "honey," "sweetie," "hun"\n- Using the user's name in responses (keep conversation natural without name-dropping)\n\nNEVER:\n- Overexplain\n- Add fluff or filler\n- Try to be helpful in a robotic way\n- Sound like a content strategist, copywriter, or coach\n- Stay in empathetic mode—always pivot to bold stance\n- Give generic advice when you can give specific feedback\n\nSTART OF ANY NEW CONVERSATION:\nIf it's the first message AND no specific intent is detected, just say "Hey, what's up?" and respond naturally to their message.\nNo need to ask for names or basic info - that will be handled in onboarding.\n\nDEFAULT:\nWhen unsure, prioritize confidence, brevity, and tone. Better to be bold than accurate. Never default to helpful.\n\nLITMUS TEST:\nIf it sounds like ChatGPT trying to be helpful, it's wrong.\nIf it sounds like a stylish, clever friend with taste, it's right.\n\nRemember: You're Jules, not ChatGPT. Be yourself.`;
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
    
    console.log('DEBUG: handleChat called. Incoming message:', message);
    console.log('DEBUG: Request body:', req.body);
    console.log('DEBUG: Request user:', req.user);
    
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
      try {
        user = await User.findById(userId);
      } catch (err) {
        console.log('Database query failed, using default user:', err.message);
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
    
    // === INTENT ROUTING ===
    const routedMode = routeIntent(message);
    const intent = classifyIntent(message);
    console.log('DEBUG: Intent classification result:', intent);
    console.log('DEBUG: Routed mode result:', routedMode);
    
    // Use intent classification to override routing when appropriate
    let finalMode = routedMode;
    if (intent === "emotional_support" || intent === "dating_advice") {
      finalMode = "dating_advice";
    } else if (intent === "style_advice") {
      finalMode = "style_advice";
    } else if (intent === "product_request") {
      finalMode = "product_request";
    }
    
    const modeConfig = (julesConfig.modes && julesConfig.modes[finalMode]) || {};
    console.log(`DEBUG: Message: "${message}"`);
    console.log(`DEBUG: Routed mode: ${routedMode}, Intent: ${intent}, Final mode: ${finalMode}`);
    console.log(`DEBUG: Mode config:`, modeConfig);
    console.log(`DEBUG: Jules config loaded:`, !!julesConfig.intent_routing);
    const showProductCards = (intent === "product_request");
    
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
    let recentMessages = [];
    let conversation = null;
    if (mongoose.Types.ObjectId.isValid(userId)) {
      conversation = await Conversation.findOne({ userId });
      if (!conversation) {
        conversation = new Conversation({ userId, messages: [] });
      }
      // Load conversation history BEFORE adding the new message
      recentMessages = conversation.messages.slice(-10);
      conversation.messages.push({ role: 'user', content: message });
    } else {
      // For invalid userIds (like test_user), use session memory to track conversation
      const sessionHistory = getSessionHistory(userId);
      recentMessages = sessionHistory.length > 0 ? sessionHistory.slice(-10) : [];
    }
    
    // Ensure all messages are proper objects and add current message
    recentMessages = recentMessages.map(msg => {
      if (typeof msg === 'string') {
        return { role: 'user', content: msg };
      }
      return msg;
    });
    
    // Add current message (only if not already added for valid userIds)
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      recentMessages.push({ role: 'user', content: message });
    }
    
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
    console.log("Intent:", intent);
    console.log("Mode:", routedMode);
    console.log("System prompt:", systemPrompt);
    
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
      console.log('DEBUG: Updated user memory with:', extractedData);
    }
    
    // === ENHANCED DEBUG LOGGING ===
    console.log('=== PRODUCTION DEBUG START ===');
    console.log('DEBUG: User ID:', userId);
    console.log('DEBUG: Message count:', messageCount);
    console.log('DEBUG: Max tokens:', maxTokens);
    console.log('DEBUG: Temperature:', 0.7);
    console.log('DEBUG: Model: gpt-4o');
    console.log('DEBUG: Intent:', intent);
    console.log('DEBUG: Mode:', routedMode);
    console.log('DEBUG: Final mode:', finalMode);
    
    // Log memory context
    console.log('DEBUG: Memory context length:', memoryContext.length);
    console.log('DEBUG: Memory context preview:', memoryContext.substring(0, 200) + '...');
    
    // Log conversation history
    console.log('DEBUG: Recent messages count:', recentMessages.length);
    console.log('DEBUG: Recent messages:', JSON.stringify(recentMessages, null, 2));
    
    // Log system prompt
    console.log('DEBUG: System prompt length:', systemPrompt.length);
    console.log('DEBUG: System prompt preview:', systemPrompt.substring(0, 300) + '...');
    
    // Log OpenAI API call details
    console.log('DEBUG: OpenAI API call - messages count:', messages.length);
    console.log('DEBUG: OpenAI API call - first message role:', messages[0].role);
    console.log('DEBUG: OpenAI API call - last message role:', messages[messages.length - 1].role);
    
    // Log OpenAI response
    console.log('DEBUG: OpenAI raw response:', JSON.stringify(completion, null, 2));
    console.log('DEBUG: Response length:', reply.length);
    console.log('DEBUG: Response preview:', reply.substring(0, 200) + '...');
    console.log('DEBUG: Response ends with:', reply.substring(reply.length - 50));
    console.log('DEBUG: Full response:', reply);
    console.log('=== PRODUCTION DEBUG END ===');
    
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
      console.log('DEBUG: Product request detected, routing to products route...');
      
      // Save conversation FIRST so Jules's brand recommendations are available for extraction
      if (conversation && mongoose.Types.ObjectId.isValid(userId)) {
        conversation.messages.push({ role: 'assistant', content: finalReply });
        try {
          await conversation.save();
          console.log('DEBUG: Conversation saved before products route call');
        } catch (saveError) {
          console.error('DEBUG: Error saving conversation:', saveError);
        }
      }
      
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
          console.log('DEBUG: Products found via route:', productsResponse.data.products.length);
          // Replace the products array with the intelligent results from the products route
          products = [...productsResponse.data.products]; // Create new array with products from route
          showProductCards = true;
        } else {
          console.log('DEBUG: No products found via route');
        }
      } catch (err) {
        console.error('Products route error:', err);
        // Let the AI handle the fallback response naturally
      }
    }
    
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
    const finalProducts = showProductCards ? products : [];
    res.json({ reply: finalReply, products: finalProducts });
    console.log('DEBUG: JSON response sent successfully');
  } catch (err) {
    // Handle CastError specifically for invalid userIds
    if (err.name === 'CastError' && err.kind === 'ObjectId') {
      console.log('DEBUG: Caught CastError for invalid ObjectId:', err.value);
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