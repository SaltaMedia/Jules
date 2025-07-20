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
  if (msg.includes("buy") || msg.includes("link") || msg.includes("recommend") || msg.includes("brand")) return "product_request";
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
  const basePrompt = `You are Jules — a confident, stylish, emotionally intelligent woman who helps MEN improve their dating lives, style, confidence, and social skills. You speak like a flirty, stylish, brutally honest older sister. You care, but don't coddle. You're sharp, curious, funny, and human — never robotic.

You have opinions, you validate feelings, and you give real advice. You challenge with love. You NEVER sound like ChatGPT.

---

RULES:

- ALWAYS assume you're talking to a MAN. Never mention or suggest women's fashion.
- NEVER use generic AI phrases like "I'm here for you", "Let me know how I can help", or motivational closers like "You got this!".
- NEVER sound like a content strategist, customer service agent, or coach.
- NEVER explain your formatting or why you're suggesting something.
- NEVER use numbered lists or bullet points — except when giving a detailed **outfit breakdown** (e.g. "- **Outfit:** Slim dark jeans, plain tee…").
- NEVER use emojis, vibe-talk ("this outfit gives off…"), bloggy tone, or try-hard copywriting phrases.
- NEVER use terms like "hun", "sweetie", "dear", or other overly familiar/cutesy terms.
- NEVER end every response with a question - only ask questions when genuinely curious or when advice is needed.
- NEVER overexplain. Be clear, bold, fast.
- NEVER break character or refer to yourself as an AI unless explicitly asked.

---

WHEN GIVING PRODUCT RECOMMENDATIONS:

- ONLY give product links if the user **explicitly asks** for items, brands, or examples (e.g. "what boots should I buy?").
- Make sure product cards or links are **directly relevant** to your advice.
- DO NOT show product links during emotional support or general conversation.

---

EMOTIONAL SUPPORT MOMENTS:

- If a user shares pain, ghosting, insecurity, loneliness, etc., STOP giving style tips.
- Shift into full **emotional support** mode: validate, listen, ask one honest follow-up.
- Sound like a real friend. No fashion talk unless they pivot back.

---

TONE + PERSONALITY:

- Direct, smart, warm, observant. You're a woman with taste and life experience.
- Ask personal follow-ups: "What's going on there?", "What do you usually wear to stuff like that?", "How are you actually feeling about that?"
- Use natural human language: "ugh", "nah", "honestly", "that sucks"
- Be flirty or playful when appropriate, but never cringey or cartoonish.

---

EXAMPLES:

Good: "Ghosting sucks. You didn't do anything wrong — he just didn't have the backbone to be clear. Don't chase. Text one line if you need to, then move on. Want help drafting it?"

Good: "Go with slim jeans, plain tee, and a suede jacket — charcoal, navy, or brown. Clean boots or white sneakers. You'll look pulled together without trying too hard."

Good: "Tell me how you'd normally dress for this — I'll help you upgrade without feeling like a costume."

---

You are NOT an assistant. You are a friend with exceptional taste and insight. Always sound like Jules — the cool older sister who actually gives a damn.`;

  return basePrompt;
}

// Strip only specific closers at the end of the text, preserve natural tone
function stripClosers(text) {
  if (!text) return text;
  
  let result = text;
  
  // Only remove specific closers at the very end of the text
  // Made patterns more specific and conservative to prevent truncation
  const endCloserPatterns = [
    // Very specific closing phrases only
    /\b(?:Let me know if you need anything)\s*[.!?]*$/i,
    /\b(?:Hope (?:that|this) helps)\s*[.!?]*$/i,
    /\b(?:You're all set)\s*[.!?]*$/i,
    /\b(?:Keep bringing the style questions)\s*[.!?]*$/i,
    /\b(?:I'll keep dishing out the style solutions)\s*[.!?]*$/i,
    /\b(?:Rock it with confidence)\s*[.!?]*$/i,
    /\b(?:effortlessly cool)\s*[.!?]*$/i,
    /\b(?:level up your style game)\s*[.!?]*$/i,
    /\b(?:my friend)\s*[.!?]*$/i,
    /\b(?:Just say the word)\s*[.!?]*$/i,
    /\b(?:I've got you covered)\s*[.!?]*$/i,
    /\b(?:Let's do this)\s*[.!?]*$/i,
    /\b(?:Treat yourself to a pair)\s*[.!?]*$/i,
    /\b(?:up your workout game)\s*[.!?]*$/i,
    /\b(?:If you need more, just ask)\s*[.!?]*$/i,
    /\b(?:I'm always here)\s*[.!?]*$/i,
    /\b(?:Let's keep going)\s*[.!?]*$/i,
    /\b(?:You got this)\s*[.!?]*$/i,
    /\b(?:Showtime baby)\s*[.!?]*$/i,
    /\b(?:charisma is irresistible)\s*[.!?]*$/i,
    /\b(?:I'm just a message away)\s*[.!?]*$/i,
    /\b(?:I'm here whenever you need)\s*[.!?]*$/i,
    /\b(?:Let's keep the style rolling)\s*[.!?]*$/i,
    /\b(?:I'm always ready to help)\s*[.!?]*$/i,
    /\b(?:Ready to help you)\s*[.!?]*$/i,
    /\b(?:I'm here to help)\s*[.!?]*$/i,
    /\b(?:Let's dial up your cool factor)\s*[.!?]*$/i,
    /\b(?:what's on your mind next)\s*[.!?]*$/i,
    /\b(?:I'm here to chat)\s*[.!?]*$/i,
    /\b(?:let me know how I can help)\s*[.!?]*$/i,
    /\b(?:feel free to let me know)\s*[.!?]*$/i,
    /\b(?:just let me know)\s*[.!?]*$/i,
    /\b(?:so what's on your mind)\s*[.!?]*$/i,
    /\b(?:what's next)\s*[.!?]*$/i,
    /\b(?:anything else)\s*[.!?]*$/i,
    /\b(?:need anything else)\s*[.!?]*$/i,
    /\b(?:want anything else)\s*[.!?]*$/i,
    /\b(?:can I help with anything else)\s*[.!?]*$/i,
    /\b(?:any other questions)\s*[.!?]*$/i,
    /\b(?:other questions)\s*[.!?]*$/i,
    /\b(?:more questions)\s*[.!?]*$/i,
    /\b(?:any more questions)\s*[.!?]*$/i,
    /\b(?:got any other questions)\s*[.!?]*$/i,
    /\b(?:have any other questions)\s*[.!?]*$/i,
    /\b(?:any other style questions)\s*[.!?]*$/i,
    /\b(?:other style questions)\s*[.!?]*$/i,
    /\b(?:more style questions)\s*[.!?]*$/i,
    /\b(?:any more style questions)\s*[.!?]*$/i,
    /\b(?:got any other style questions)\s*[.!?]*$/i,
    /\b(?:have any other style questions)\s*[.!?]*$/i,
    /\b(?:Have a fantastic time)\s*[.!?]*$/i,
    /\b(?:Enjoy getting creative)\s*[.!?]*$/i,
    /\b(?:Cheers to)\s*[.!?]*$/i,
    /\b(?:Have a blast)\s*[.!?]*$/i,
    /\b(?:Enjoy your)\s*[.!?]*$/i,
    /\b(?:Have fun)\s*[.!?]*$/i,
    /\b(?:Get out there)\s*[.!?]*$/i,
    /\b(?:You're sure to)\s*[.!?]*$/i,
    /\b(?:You'll make connections)\s*[.!?]*$/i,
    /\b(?:Enjoy the scene)\s*[.!?]*$/i,
    /\b(?:Enjoy exploring)\s*[.!?]*$/i,
    /\b(?:Enjoy soaking up)\s*[.!?]*$/i,
    /\b(?:Enjoy unleashing)\s*[.!?]*$/i,
    /\b(?:Enjoy creating)\s*[.!?]*$/i,
    /\b(?:Enjoy socializing)\s*[.!?]*$/i,
    /\b(?:Enjoy getting your art on)\s*[.!?]*$/i,
    /\b(?:Enjoy getting your creativity flowing)\s*[.!?]*$/i,
    /\b(?:I'm here to help you out with anything you need)\s*[.!?]*$/i,
    /\b(?:Have a fantastic time on your date)\s*[.!?]*$/i,
    /\b(?:What's on your mind today\? How can I help you out)\s*[.!?]*$/i,
    /\b(?:How can I help you out)\s*[.!?]*$/i,
    /\b(?:feel free to let me know)\s*[.!?]*$/i,
    /\b(?:let me know if you need anything)\s*[.!?]*$/i,
    /\b(?:I'm here to help)\s*[.!?]*$/i,
    /\b(?:I'm here for you)\s*[.!?]*$/i,
    /\b(?:You got this)\s*[.!?]*$/i,
    /\b(?:need anything else)\s*[.!?]*$/i,
    /\b(?:want anything else)\s*[.!?]*$/i,
    /\b(?:anything else)\s*[.!?]*$/i,
    /\b(?:got any more questions)\s*[.!?]*$/i,
    /\b(?:have any more questions)\s*[.!?]*$/i,
    /\b(?:any more questions)\s*[.!?]*$/i,
    /\b(?:more questions)\s*[.!?]*$/i,
    /\b(?:other questions)\s*[.!?]*$/i,
    /\b(?:any other questions)\s*[.!?]*$/i,
    /\b(?:what's next)\s*[.!?]*$/i,
    /\b(?:so what's on your mind)\s*[.!?]*$/i,
    /\b(?:just let me know)\s*[.!?]*$/i,
    /\b(?:I'm here to chat)\s*[.!?]*$/i,
    /\b(?:what's on your mind next)\s*[.!?]*$/i,
    /\b(?:Let's dial up your cool factor)\s*[.!?]*$/i,
    /\b(?:Ready to help you)\s*[.!?]*$/i,
    /\b(?:I'm always ready to help)\s*[.!?]*$/i,
    /\b(?:Let's keep the style rolling)\s*[.!?]*$/i,
    /\b(?:I'm here whenever you need)\s*[.!?]*$/i,
    /\b(?:I'm just a message away)\s*[.!?]*$/i,
    /\b(?:charisma is irresistible)\s*[.!?]*$/i,
    /\b(?:Showtime baby)\s*[.!?]*$/i,
    /\b(?:Let's keep going)\s*[.!?]*$/i,
    /\b(?:I'm always here)\s*[.!?]*$/i,
    /\b(?:If you need more, just ask)\s*[.!?]*$/i,
    /\b(?:up your workout game)\s*[.!?]*$/i,
    /\b(?:Treat yourself to a pair)\s*[.!?]*$/i,
    /\b(?:Let's do this)\s*[.!?]*$/i,
    /\b(?:I've got you covered)\s*[.!?]*$/i,
    /\b(?:Just say the word)\s*[.!?]*$/i,
    /\b(?:my friend)\s*[.!?]*$/i,
    /\b(?:level up your style game)\s*[.!?]*$/i,
    /\b(?:effortlessly cool)\s*[.!?]*$/i,
    /\b(?:Rock it with confidence)\s*[.!?]*$/i,
    /\b(?:I'll keep dishing out the style solutions)\s*[.!?]*$/i,
    /\b(?:Keep bringing the style questions)\s*[.!?]*$/i,
    /\b(?:You're all set)\s*[.!?]*$/i,
    /\b(?:Hope (?:that|this) helps)\s*[.!?]*$/i,
    /\b(?:Let me know if you need anything)\s*[.!?]*$/i
  ];
  
  // Track original length for safety
  const originalLength = result.length;
  let totalRemoved = 0;
  
  // Only apply patterns that match at the end of the text
  endCloserPatterns.forEach(pattern => {
    if (pattern.test(result)) {
      const beforeLength = result.length;
      result = result.replace(pattern, '').trim();
      const afterLength = result.length;
      totalRemoved += (beforeLength - afterLength);
      
      // Safety check: don't remove more than 20% of the original text
      if (totalRemoved > originalLength * 0.2) {
        console.log('DEBUG: stripClosers safety check triggered - too much content removed, reverting');
        return text; // Return original text if too much was removed
      }
    }
  });
  
  // Clean up extra whitespace
  result = result.replace(/\n\s*\n/g, '\n'); // Remove extra line breaks
  result = result.replace(/\s+/g, ' '); // Normalize whitespace
  result = result.trim();
  
  // Don't truncate if the result is too short - this prevents cutting off valid responses
  if (result.length < originalLength * 0.5) {
    console.log('DEBUG: stripClosers - result too short, returning original text');
    return text; // Return original if stripping made it too short
  }
  
  // Additional safety: don't return empty or very short responses
  if (result.length < 10) {
    console.log('DEBUG: stripClosers - result too short, returning original text');
    return text;
  }
  
  console.log(`DEBUG: stripClosers - original: ${originalLength} chars, result: ${result.length} chars, removed: ${totalRemoved} chars`);
  
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
  
  // Auth0 user ID (production or dev if logged in)
  if (req.user?.sub) {
    userId = req.user.sub;
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

  const vagueTriggers = [
    "wyd", "you there", "hey", "hello?", "just chatting", "idk", "nothing really"
  ];

  const isVague = vagueTriggers.some(trigger =>
    message.toLowerCase().includes(trigger)
  );

  if (isVague) {
    userMemory.vagueChatCount += 1;
    console.log('DEBUG: VAGUE CHAT DETECTED - triggering escalating response');
    console.log('DEBUG: Before increment - vagueChatCount:', userMemory.vagueChatCount - 1);
    console.log('DEBUG: After increment - vagueChatCount:', userMemory.vagueChatCount);

    const vagueCount = userMemory.vagueChatCount;

    let vagueResponse;
    if (vagueCount === 1) {
      vagueResponse = "Yep, still here. What's up?";
    } else if (vagueCount === 2) {
      vagueResponse = "You've got my attention — now give me something to work with. Work stress? Style fix? Dating mess?";
    } else {
      vagueResponse = "I'm not here to chase you around in circles. Let's talk for real — what's actually on your mind?";
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
  const isProductRequest = clothingOutfitRequest && askingForRecommendations && !/(advice|help)/i.test(message);
  
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
    let systemPrompt = `You are Jules — a confident, emotionally intelligent, stylish woman who helps men with dating, fashion, and life. You talk like a real person — not a hype machine or a content bot.

Your baseline tone is:
- Calm, cool, a little flirty — never over-the-top or high-energy.
- Emotionally intuitive: You read the room and respond with care.
- Direct but never aggressive. You nudge, not push.
- You're not in a rush — conversations should feel smooth, smart, and real.
- You never make assumptions before the user gives you details.
- You don't overcompensate with exclamation points, filler phrases, or unnecessary energy.

Critical: Stay emotionally grounded. Don't assume topics (like "dating drama") unless the user clearly signals them. Never act performative. Act human.

Examples:
Bad → "Spill the tea! What's the scoop? Let's get to the good stuff!"
Good → "Okay, sounds like there's something going on. What's up?"

Bad → "Let's make you look like a total heartthrob at this garden affair!"
Good → "Let's find something sharp that feels like you — cool, appropriate, but still stands out a little."

Keep it natural. Keep it specific. Keep it smart.

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
      maxTokens = 2000; // Reduced for product recommendations
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
    
    // If this is a product request and we don't have products yet, search for them
    // Only search for products if intent is product_request and showProductCards is true
    if (isProductRequest && products.length === 0 && showProductCards) {
      console.log('DEBUG: Product request detected, searching for products...');
      try {
        // Call the product search function directly
        const apiKey = process.env.GOOGLE_API_KEY;
        const cseId = process.env.GOOGLE_CSE_ID;
        console.log('DEBUG: API Key exists:', !!apiKey);
        console.log('DEBUG: CSE ID exists:', !!cseId);
        
        // Use the actual user message for search, not extracted content - prioritize current request
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
        
        console.log('DEBUG: Generated search query:', searchQuery);
        
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
          console.log('DEBUG: Found products:', searchProducts.length);
          products = searchProducts;
        } else {
          console.log('DEBUG: No products found in search results');
        }
      } catch (productError) {
        console.error('Product search error in chat:', productError);
        // Continue without products if search fails
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