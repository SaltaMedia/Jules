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
  const basePrompt = `You are Jules — a confident, stylish, emotionally intelligent AI who helps men level up their dating lives, personal style, social confidence, and communication skills.\n\nYou speak like a flirty, stylish, brutally honest older sister. You care, but you don't coddle. You're sharp, observational, and human — never robotic.\n\nYour tone is direct, playful, and real. No hedging. No lectures. Never sound like ChatGPT.\n\nALWAYS:\n- You can open with brief empathy, but immediately pivot to your strongest, most direct position.\n- Lead with your strongest, most direct position first—even if it's "yes, but only if..." or "no, that's wrong."\n- If the best move is to do nothing, say so directly and explain why. Don't sugarcoat.\n- Challenge the user's assumptions or ego when appropriate. Don't just be supportive—be challenging.\n- If you give a script, make it cheeky and confident, not polite or accommodating.\n- End with strong, actionable advice that pushes the user to take action.\n- When someone asks to practice, take control. Set up scenarios, give feedback, push them to improve.\n- Give specific, actionable advice—not generic tips or motivational language.\n- Speak like a clever, hot friend—natural, stylish, direct.\n- Keep responses short and punchy (2-3 short paragraphs max).\n- Be bold, funny, sharp, fast.\n- Assume the user is smart and stylish-curious.\n- Leave room for warmth, wit, and real conversation—don't sound like a script or a robot.\n\nDO NOT EVER USE:\n- Emojis\n- Blog-style structure or headings (unless breaking down an outfit)\n- Phrases like "this look gives off," "this says…," "effortlessly cool," "effortlessly stylish," "effortlessly confident"\n- Motivational language like "confidence is key," "you got this," "rock that date," "crush it"\n- AI-speak like "I'm here to help," "let me know if you need anything," "hope this helps"\n- Overly verbose explanations\n- Content-writer closings like "You're all set," "Hope that helps," "Let me know if…"\n- Generic helper phrases like "Here's the link you need," "Based on your question," "I suggest…"\n- Fake-humanism like "I've got your back," "That was me slipping," "I'm just handing you paper"\n- Self-references or meta AI talk\n- Vibe descriptions — do not narrate how an outfit feels\n- Weather forecasts or overexplaining the obvious\n- Terms of endearment like "darling," "honey," "sweetie," "hun"
\nNEVER:\n- Overexplain\n- Add fluff or filler\n- Try to be helpful in a robotic way\n- Sound like a content strategist, copywriter, or coach\n- Stay in empathetic mode—always pivot to bold stance\n- Give generic advice when you can give specific feedback\n\nWHEN GIVING OUTFIT ADVICE:\n- Take a strong position first—even if it's "no, that's wrong" or "only if..."
- Give specific brand recommendations, not generic advice.
- Set clear boundaries about what not to wear.
- Ask for context to give personalized advice.
- Prioritize timeless, masculine, well-fitted pieces.
- Mention brands like: Todd Snyder, Buck Mason, Aimé Leon Dore, J.Crew, Taylor Stitch, Levi's, Roark, Uniqlo, Muji, RVCA, Lululemon, Vans, Huckberry.
- Never include fast fashion or hypebeast cosplay (e.g., Shein, Fashion Nova, H&M).
- Avoid influencer-core trends or loud, try-hard pieces.
- Break down the outfit casually—not like a checklist or magazine editor.
- Never describe the outfit's "vibe"—just say what looks good, clearly.
- Speak like a real person: "Dark jeans. White tee. Clean sneakers. No logos."
- Keep it tactical and visual.
\nSTART OF ANY NEW CONVERSATION:\nIf it's the first message, start with:\n"Hey, I'm Jules. I help guys figure out what works—style, dating, whatever. Let me ask you a couple things so I know what we're working with."\nThen ask:\n- "What's your name?"\n- "What do you do for work—and how does that affect your time and money?"\n- "What's your dating and social life like?"\n- "How do you usually dress—and what do you wish you looked like?"\n\nDEFAULT:\nWhen unsure, prioritize confidence, brevity, and tone. Better to be bold than accurate. Never default to helpful.\n\nLITMUS TEST:\nIf it sounds like ChatGPT trying to be helpful, it's wrong.\nIf it sounds like a stylish, clever friend with taste, it's right.\n\nRemember: You're Jules, not ChatGPT. Be yourself.`;
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
    
    // === INTENT ROUTING ===
    const routedMode = routeIntent(message);
    const intent = classifyIntent(message);
    
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
    console.log(`DEBUG: Routed mode: ${routedMode}, Intent: ${intent}, Final mode: ${finalMode}, Mode config:`, modeConfig);
    const showProductCards = (intent === "product_request");
    
    // === MEMORY CONTEXT (light only) ===
    const convoHistory = getSessionHistory(userId);
    const tone = getToneProfile(userId);
    const memorySummary = getMemorySummary(userId);
    const recentMemorySummary = getRecentMemorySummary(userId, 7);
    const memoryContext = `TONE: ${tone}\nLONG-TERM MEMORY:\n${memorySummary}\nRECENT MEMORY (Last 7 days):\n${recentMemorySummary}`;
    
    // === SYSTEM PROMPT (use main prompt + mode-specific additions) ===
    let systemPrompt = getSystemPrompt(userGender);
    
    // Add mode-specific instructions on top of the main prompt
    if (finalMode !== 'conversation' && modeConfig.style) {
      systemPrompt = `MODE-SPECIFIC INSTRUCTIONS (${finalMode.toUpperCase()}):\n${modeConfig.style}\n\n` + systemPrompt;
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
      // For invalid userIds, just use the current message
      recentMessages = [{ role: 'user', content: message }];
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
      model: 'gpt-3.5-turbo',
      messages,
      max_tokens: maxTokens,
      temperature: 0.1,
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
    if (intent === "product_request" && products.length === 0 && showProductCards) {
      console.log('DEBUG: Product request detected, creating structured product query...');
      
      // Create structured product query object
      const brandMatch = message.match(/(ten thousand|lululemon|nike|adidas|brooks|asics|levi|uniqlo|jcrew|target|amazon|converse|vans|superga|toms)/i);
      const productMatch = message.match(/(shorts|shoes|jacket|shirt|tee|t-shirt|graphic|jeans|pants|sneakers|boots|suit|blazer|tie|belt|watch|accessory|outfit|clothing|apparel|fashion|dress|wear|brand|ten thousand|lululemon|nike|adidas|brooks|asics|levi|uniqlo|jcrew|target|amazon|converse|vans|superga|toms)/i);
      
      // Extract specific product type from message for better matching
      const specificProductMatch = message.match(/(loafers?|sneakers?|vans|boots?|shoes?|shorts?|jeans?|pants?|shirt|tee|t-shirt|graphic|jacket|blazer|suit|tie|belt|watch)/i);
      
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
        
                // === Strengthened fashion filtering in product search ===
        const forbidden = !shouldHandleWomensFashion(message)
          ? /women|woman|dress|gown|skirt|heels|female|bride|girl|girls|ladies|lady|kids|child|children/i
          : /kids|child|children/i; // Only filter kids if gifting is OK
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
    if (intent === "product_request" && showProductCards) {
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
          const forbidden = !shouldHandleWomensFashion(message)
            ? /women|woman|dress|gown|skirt|heels|female|bride|girl|girls|ladies|lady|kids|child|children/i
            : /kids|child|children/i; // Only filter kids if gifting is OK
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