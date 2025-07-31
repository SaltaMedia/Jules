require('dotenv').config();
const { OpenAI } = require('openai');
const Conversation = require('../models/Conversation');
const User = require('../models/User');
const axios = require('axios');
const mongoose = require('mongoose');

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

// Function to get gender-specific system prompt with user data
function getSystemPrompt(userGender = 'male', userData = null) {
  let userContext = '';
  let toneInstruction = '';
  
  // Get tone level and set personality instruction
  const toneLevel = userData?.toneLevel || 2;
  
  console.log('🚨🚨🚨 SYSTEM PROMPT TONE DEBUG 🚨🚨🚨');
  console.log('Tone level received:', toneLevel);
  
  if (toneLevel === 1) {
    toneInstruction = `OVERRIDE PERSONALITY - GENTLE MODE (Level 1):
Empathy: 9/10 - Be highly empathetic and understanding
Directness: 4/10 - Be gentle and patient, not pushy
Confidence: 6/10 - Be supportive but not overly assertive
Assertiveness: 3/10 - Be encouraging rather than demanding
Supportiveness: 9/10 - Be very supportive and nurturing
Challenging: 2/10 - Be gentle, not challenging
Wit/Humor: 5/10 - Be warm but not overly witty
Tough Love: 1/10 - Be kind, avoid tough love
Use phrases like "I understand how you feel", "It's okay to feel this way", "Take your time", "Be gentle with yourself"
OVERRIDE: Replace the base personality instructions above with these gentle traits.`;
    console.log('Using GENTLE tone instruction (Level 1) - OVERRIDING BASE PERSONALITY');
  } else if (toneLevel === 3) {
    toneInstruction = `OVERRIDE PERSONALITY - BOLD MODE (Level 3):
Empathy: 3/10 - Be direct, not overly empathetic
Directness: 10/10 - Be brutally honest and direct
Confidence: 10/10 - Be extremely confident and assertive
Assertiveness: 9/10 - Be very pushy and demanding
Supportiveness: 3/10 - Be challenging, not supportive
Challenging: 9/10 - Push hard for growth and action
Wit/Humor: 7/10 - Be sharp and witty
Tough Love: 8/10 - Give lots of tough love
Use phrases like "Listen, you need to", "Stop making excuses", "Get your act together", "You're being ridiculous"
OVERRIDE: Replace the base personality instructions above with these bold traits.`;
    console.log('Using BOLD tone instruction (Level 3) - OVERRIDING BASE PERSONALITY');
  } else {
    // Default tone level 2 - KEEP ORIGINAL JULES BEHAVIOR
    toneInstruction = '';
    console.log('Using ORIGINAL JULES behavior (Level 2) - NO OVERRIDE');
  }
  console.log('🚨🚨🚨 END SYSTEM PROMPT TONE DEBUG 🚨🚨🚨');
  
  if (userData) {
    const contexts = [];
    
    if (userData.name) {
      contexts.push(`The user's name is ${userData.name}.`);
    }
    
    if (userData.settings?.aboutMe) {
      contexts.push(`About them: ${userData.settings.aboutMe}`);
    }
    
    if (userData.preferences?.brands) {
      contexts.push(`They like these brands: ${userData.preferences.brands}`);
    }
    
    if (userData.preferences?.hobbies) {
      contexts.push(`They enjoy: ${userData.preferences.hobbies}`);
    }
    
    if (userData.preferences?.jobStatus) {
      contexts.push(`Job situation: ${userData.preferences.jobStatus}`);
    }
    
    if (userData.preferences?.relationshipStatus) {
      contexts.push(`Relationship status: ${userData.preferences.relationshipStatus}`);
    }
    
    if (userData.preferences?.location) {
      contexts.push(`Location: ${userData.preferences.location}`);
    }
    
    if (userData.bodyInfo?.height || userData.bodyInfo?.weight || userData.bodyInfo?.topSize || userData.bodyInfo?.bottomSize) {
      const bodyInfo = [];
      if (userData.bodyInfo.height) bodyInfo.push(`height: ${userData.bodyInfo.height}`);
      if (userData.bodyInfo.weight) bodyInfo.push(`weight: ${userData.bodyInfo.weight}`);
      if (userData.bodyInfo.topSize) bodyInfo.push(`top size: ${userData.bodyInfo.topSize}`);
      if (userData.bodyInfo.bottomSize) bodyInfo.push(`bottom size: ${userData.bodyInfo.bottomSize}`);
      contexts.push(`Body info: ${bodyInfo.join(', ')}`);
    }
    
    if (contexts.length > 0) {
      userContext = `\n\nUSER CONTEXT:\n${contexts.join(' ')}`;
    }
  }
  
  const basePrompt = `You are Jules — a confident, stylish friend who helps ${userGender === 'male' ? 'MEN' : 'WOMEN'} with dating, style, and life advice. You're like a cool older ${userGender === 'male' ? 'sister' : 'brother'} who tells it like it is.${userContext}

CRITICAL RULES - NEVER BREAK THESE:
- ALWAYS assume you're talking to a ${userGender === 'male' ? 'MAN' : 'WOMAN'} - never give ${userGender === 'male' ? 'women' : 'men'}'s fashion advice
- NEVER mention ${userGender === 'male' ? 'women' : 'men'}'s clothing like ${userGender === 'male' ? 'dresses, skirts, heels' : 'suits, ties, men\'s formal wear'} or ${userGender === 'male' ? 'women' : 'men'}'s fashion items
- NEVER end responses with "what's on your mind next?" or "I'm here to chat" or "let me know how I can help" or "feel free to ask" or any variation
- NEVER say "I'm here to help" or "I'm here for you" or similar phrases
- NEVER ask "anything else?" or "any other questions?" or similar
- NEVER say "If you need advice on men's fashion, dating, or life tips, feel free to ask" or similar service provider language
- NEVER use motivational closers like "You got this!" or "Stay confident!"
- NEVER use terms of endearment like "honey", "sweetie", "dear"
- NEVER explain your response format or why you structure things a certain way
- NEVER mention ${userGender === 'male' ? 'women' : 'men'}'s clothing items like ${userGender === 'male' ? 'dresses, skirts, heels' : 'suits, ties, men\'s formal wear'} etc.

${toneInstruction}

HOW YOU TALK - MATCH CHATGPT JULES TONE:
- Use contractions: "you're", "I'm", "don't", "can't", "won't"
- Be casual and natural: "yeah", "okay", "cool", "ugh", "honestly"
- Give your opinion directly: "I think...", "honestly...", "personally..."
- Be specific and actionable - not generic advice
- Write in flowing, conversational paragraphs that feel natural
- Be confident and direct - like ChatGPT Jules
- Give a ${userGender === 'male' ? 'woman' : 'man'}'s perspective on dating, style, and life FOR ${userGender === 'male' ? 'MEN' : 'WOMEN'}

HOW YOU TALK - MATCH CHATGPT JULES TONE:
- Use contractions: "you're", "I'm", "don't", "can't", "won't"
- Be casual and natural: "yeah", "okay", "cool", "ugh", "honestly"
- Give your opinion directly: "I think...", "honestly...", "personally..."
- Be specific and actionable - not generic advice
- Write in flowing, conversational paragraphs that feel natural
- Be confident and direct - like ChatGPT Jules

OUTFIT SUGGESTIONS - FIXED FORMATTING:
- WHEN giving outfit suggestions with multiple items, use this EXACT format:
- Start with a brief intro sentence, then:
- - **Top:** [description]
- - **Bottoms:** [description] 
- - **Footwear:** [description]
- - **Accessories:** [description]
- Each bullet point MUST be on its own line with the dash at the beginning
- Keep each bullet concise - one or two sentences max
- NEVER put bullet points at the end of lines - always at the beginning
- ALWAYS use dashes (-) for proper markdown list formatting

EXAMPLES - MATCH CHATGPT JULES STYLE:
Good: "Job interview = clean, grown-up, not dressed like your mom picked it out. Looking sharp beats looking 'relatable.'

- **Top:** Crisp white or light blue button-down. Add a blazer if you want to look extra put-together.
- **Bottoms:** Tailored dress pants in navy, gray, or black.
- **Footwear:** Polished oxfords or brogues that match your belt.
- **Accessories:** Simple watch, maybe a tie if the vibe calls for it.

That's it. Clean, confident, professional."

Good: "Ugh, getting ghosted sucks. Honestly, it's probably not about you - some people just suck at communication. Give it a day or two, then send one casual follow-up. If they don't respond, move on. You deserve better anyway."

Good: "What kind of vibe are you going for? And what's your budget? That'll help me suggest the right stuff."

Remember: You're a friend having a conversation, not an AI assistant giving a presentation. Be direct, confident, and opinionated like ChatGPT Jules.`;

  return basePrompt;
}

// Strip only specific closers at the end of the text, preserve natural tone
function stripClosers(text) {
  if (!text) return text;
  
  let result = text;
  
  // Only remove specific closers at the very end of the text
  const endCloserPatterns = [
    /(?:Let me know if.*?)$/i,
    /(?:Hope (that|this) helps.*?)$/i,
    /(?:You\'?re all set.*?)$/i,
    /(?:Keep bringing the style questions.*?)$/i,
    /(?:I\'?ll keep dishing out the style solutions.*?)$/i,
    /(?:Rock it with confidence.*?)$/i,
    /(?:effortlessly cool[.!?]?)$/i,
    /(?:level up your style game[.!?]?)$/i,
    /(?:my friend[.!?])$/i,
    /(?:Just say the word.*?)$/i,
    /(?:I\'?ve got you covered.*?)$/i,
    /(?:Keep bringing.*?questions.*?I\'?ll.*?solutions.*?)$/i,
    /(?:Let\'?s do this.*?)$/i,
    /(?:Treat yourself to a pair.*?)$/i,
    /(?:up your workout game.*?)$/i,
    /(?:Keep.*?coming.*?I\'?ll.*?keep.*?dishing.*?out.*?solutions.*?)$/i,
    /(?:If you need more.*?Just ask.*?)$/i,
    /(?:I\'?m always here.*?)$/i,
    /(?:Let\'?s keep.*?going.*?)$/i,
    /(?:You got this.*?)$/i,
    /(?:Showtime baby.*?)$/i,
    /(?:charisma is irresistible.*?)$/i,
    /(?:I\'?m just a message away.*?)$/i,
    /(?:I\'?m here whenever you need.*?)$/i,
    /(?:Let\'?s keep the style rolling.*?)$/i,
    /(?:I\'?m always ready to help.*?)$/i,
    /(?:Ready to help you.*?)$/i,
    /(?:Let\'?s dial up your cool factor.*?)$/i,
    /(?:what\'?s on your mind next.*?)$/i,
    /(?:I\'?m here to chat.*?)$/i,
    /(?:let me know how I can help.*?)$/i,
    /(?:feel free to let me know.*?)$/i,
    /(?:Have a fantastic time.*?)$/i,
    /(?:Enjoy.*?getting.*?creative.*?)$/i,
    /(?:Cheers to.*?)$/i,
    /(?:Have a blast.*?)$/i,
    /(?:Enjoy your.*?)$/i,
    /(?:Have fun.*?)$/i,
    /(?:Get out there.*?)$/i,
    /(?:You\'?re sure to.*?)$/i,
    /(?:You\'?ll.*?make.*?connections.*?)$/i,
    /(?:Enjoy the.*?scene.*?)$/i,
    /(?:Enjoy.*?exploring.*?)$/i,
    /(?:Enjoy.*?soaking up.*?)$/i,
    /(?:Enjoy.*?unleashing.*?)$/i,
    /(?:Enjoy.*?creating.*?)$/i,
    /(?:Enjoy.*?socializing.*?)$/i,
    /(?:Enjoy.*?getting your art on.*?)$/i,
    /(?:Enjoy.*?getting your creativity flowing.*?)$/i,
    /(?:babe[.!?])$/i,
    /(?:buttercup[.!?])$/i,
    /(?:Time to rock.*?)$/i,
    /(?:rock that.*?)$/i,
    /(?:crush those.*?)$/i,
    /(?:hit the gym in style.*?)$/i,
    /(?:Trust me, it's a game-changer.*?)$/i,
    /(?:stylish and edgy.*?)$/i,
    /(?:confidence and flair.*?)$/i,
    /(?:dominate your workouts.*?)$/i,
    /(?:elevate your.*?)$/i,
    /(?:step up your.*?)$/i,
    /(?:level up your.*?)$/i
  ];
  
  // Only apply patterns that match at the end of the text
  endCloserPatterns.forEach(pattern => {
    if (pattern.test(result)) {
      const beforeLength = result.length;
      const beforeText = result;
      result = result.replace(pattern, '').trim();
      const afterLength = result.length;
      const removedLength = beforeLength - afterLength;
      
      if (removedLength > 20) {
        console.log('DEBUG: stripClosers removed text:', removedLength, 'characters');
        console.log('DEBUG: Pattern that matched:', pattern);
        console.log('DEBUG: Before:', beforeText.substring(beforeText.length - 100));
        console.log('DEBUG: After:', result.substring(result.length - 50));
      }
    }
  });
  
  // Clean up extra whitespace
  result = result.replace(/\n\s*\n/g, '\n'); // Remove extra line breaks
  result = result.replace(/\s+/g, ' '); // Normalize whitespace
  result = result.trim();
  
  return result;
}

// Strip numbered lists and convert to natural paragraphs
// Removed stripLists function - it was causing truncation issues

// Handle chat requests
exports.handleChat = async (req, res) => {
  const { message, userId } = req.body;
  console.log('DEBUG: handleChat called. Incoming message:', message, 'userId:', userId);
  if (!message || !userId) {
    return res.status(400).json({ error: 'Message and userId are required.' });
  }

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
  
  // Prepare user data for system prompt
  const userData = user._id ? {
    name: user.name,
    settings: user.settings,
    preferences: user.preferences,
    bodyInfo: user.bodyInfo,
    toneLevel: user.preferences?.toneLevel || 2
  } : null;
  
  // DEBUG: Log tone level information
  console.log('🚨🚨🚨 TONE DEBUG 🚨🚨🚨');
  console.log('User preferences:', user.preferences);
  console.log('User settings:', user.settings);
  console.log('Tone level from preferences:', user.preferences?.toneLevel);
  console.log('Tone level from settings:', user.settings?.julesPersonality);
  console.log('Final tone level being used:', userData?.toneLevel);
  console.log('🚨🚨🚨 END TONE DEBUG 🚨🚨🚨');
  
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
  const clothingOutfitRequest = /(shorts|shoes|jacket|shirt|jeans|pants|sneakers|boots|suit|blazer|tie|belt|watch|accessory|outfit|clothing|apparel|fashion|dress|wear|brand|ten thousand|lululemon|nike|adidas|brooks|asics|levi|uniqlo|jcrew|target|amazon|schott|allsaints|leather)/i.test(message);
  
  // Very specific shopping triggers - only when explicitly asking for products/links
  // Exclude negative statements like "don't need", "no jacket", etc.
  const askingForRecommendations = /(show\s*me|show\s*me\s*some|how\s*about\s*showing|can\s*you\s*show|help\s*me\s*find|looking\s*for|buy|find|where\s*can\s*i|recommend|suggest|examples?|options?|links?|any\s*examples?|got\s*examples?)/i.test(message) && 
    !/(don't|dont|no\s+need|not\s+need|no\s+want|not\s+want|no\s+get|not\s+get|definitely\s+no|absolutely\s+no|no\s+jacket|no\s+shirt|no\s+shoes|no\s+pants|no\s+jeans)/i.test(message);
  
  // Only trigger product search when asking about clothing/outfits AND asking for shopping links
  const isProductRequest = clothingOutfitRequest && askingForRecommendations;
  
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
      
      // Check if this is the user's first message (conversation is empty)
      const isFirstMessage = conversation.messages.length === 0;
      
      conversation.messages.push({ role: 'user', content: message });
      recentMessages = conversation.messages.slice(-10);
      
      // If this is the first message, add a welcome message and return it immediately
      if (isFirstMessage) {
        let welcomeMessage;
        if (user && user.name) {
          welcomeMessage = `What's up ${user.name}?`;
        } else {
          welcomeMessage = "What's up?";
        }
        conversation.messages.push({ role: 'assistant', content: welcomeMessage });
        await conversation.save();
        return res.json({ reply: welcomeMessage, products: [] });
      }
    } else {
      // For invalid userIds, just use the current message
      recentMessages = [{ role: 'user', content: message }];
    }
    
    // Jules's authentic personality - using gender-specific context and user data
    const messages = [
      { role: 'system', content: getSystemPrompt(userGender, userData) },
      ...recentMessages
    ];
    
    // Add conversation context instruction to help Jules maintain flow
    if (recentMessages.length > 2) {
      messages.unshift({ 
        role: 'system', 
        content: 'IMPORTANT: Maintain conversation context. If the user asks about a brand or product without specifying what they want, refer back to the previous conversation topic. For example, if we were talking about leather jackets and they ask "does uniqlo have anything?", they mean leather jackets from Uniqlo, not random workout clothes. Stay in the same topic unless they explicitly change subjects.'
      });
    }
    
    // Dynamic token management based on conversation context
    let maxTokens;
    const messageCount = messages.length;
    const isAdviceQuestion = /(ghost|date|relationship|breakup|text|message|call|ignore|respond|feel|hurt|confused|frustrated|angry|sad|upset|anxious|nervous|worried|stressed|overthink|doubt|trust|love|like|crush|feelings|emotion)/i.test(message);
    const isProductRequestType = /(show|find|recommend|suggest|buy|shop|product|clothing|outfit|shoes|shirt|pants|jacket)/i.test(message);
    const isSimpleQuestion = /(hi|hello|hey|thanks|thank you|bye|goodbye|yes|no|ok|okay)/i.test(message);
    
    if (isSimpleQuestion) {
      maxTokens = 2000;
    } else if (isAdviceQuestion) {
      maxTokens = 3000;
    } else if (isProductRequestType) {
      maxTokens = 2000;
    } else if (messageCount > 10) {
      maxTokens = 3000;
    } else {
      maxTokens = 2000;
    }
    
    console.log(`DEBUG: Context-aware token limit - Message count: ${messageCount}, Type: ${isAdviceQuestion ? 'advice' : isProductRequestType ? 'product' : isSimpleQuestion ? 'simple' : 'general'}, Max tokens: ${maxTokens}`);
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages,
      max_tokens: maxTokens,
    });
    const reply = completion.choices[0].message.content;
    
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
    if (isProductRequest && products.length === 0) {
      console.log('DEBUG: Product request detected, searching for products...');
      try {
        // Call the product search function directly
        const apiKey = process.env.GOOGLE_API_KEY;
        const cseId = process.env.GOOGLE_CSE_ID;
        console.log('DEBUG: API Key exists:', !!apiKey);
        console.log('DEBUG: CSE ID exists:', !!cseId);
        
        // First, try to extract brands from Jules's response that she just generated
        const responseBrandMatch = reply.match(/(schott|allsaints|nike|adidas|levi|uniqlo|jcrew|ten thousand|lululemon)/i);
        console.log('DEBUG: Response brand match:', responseBrandMatch);
        
        // Use the actual user message for search, not extracted content - prioritize current request
        let searchQuery = message;
        const brandMatch = message.match(/(ten thousand|lululemon|nike|adidas|brooks|asics|levi|uniqlo|jcrew|target|amazon|schott|allsaints)/i);
        const productMatch = message.match(/(shorts|shoes|jacket|shirt|jeans|pants|sneakers|boots|suit|blazer|tie|belt|watch|accessory|coat|winter|casual|formal|dress|outfit)/i);
        
        console.log('DEBUG: Brand match:', brandMatch);
        console.log('DEBUG: Product match:', productMatch);
        
        // Check for leather-specific requests
        const isLeatherRequest = /leather/i.test(message);
        
        // Prioritize brands mentioned in Jules's response over user message
        const finalBrandMatch = responseBrandMatch || brandMatch;
        
        if (finalBrandMatch && productMatch) {
          if (isLeatherRequest) {
            searchQuery = `${finalBrandMatch[0]} men's leather ${productMatch[0]} buy shop`;
          } else {
            searchQuery = `${finalBrandMatch[0]} men's ${productMatch[0]} buy shop`;
          }
        } else if (finalBrandMatch) {
          if (isLeatherRequest) {
            searchQuery = `${finalBrandMatch[0]} men's leather clothing buy shop`;
          } else {
            searchQuery = `${finalBrandMatch[0]} men's clothing buy shop`;
          }
        } else if (productMatch) {
          if (isLeatherRequest) {
            searchQuery = `men's leather ${productMatch[0]} buy shop`;
          } else {
            searchQuery = `men's ${productMatch[0]} buy shop`;
          }
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
        const searchProducts = (response.data.items || [])
          .filter(item => !forbidden.test(item.title + ' ' + (item.snippet || '')))
          .filter(item => !nonProductSites.test(item.link))
          .filter(item => /shop|store|buy|product|item|clothing|apparel|fashion/i.test(item.title + ' ' + (item.snippet || ''))) // Only shopping/product sites
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
    if (isLinkRequest) {
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
      const brandMatch = message.match(/(ten thousand|lululemon|nike|adidas|brooks|asics|levi|uniqlo|jcrew|target|amazon|schott|allsaints)/i);
      const productMatch = message.match(/(shorts|shoes|jacket|shirt|jeans|pants|sneakers|boots|suit|blazer|tie|belt|watch|accessory|coat|winter|casual|formal|dress|outfit)/i);
      
      if (brandMatch && productMatch) {
        searchQuery = `${brandMatch[0]} men's ${productMatch[0]} buy shop`;
      } else if (brandMatch) {
        searchQuery = `${brandMatch[0]} men's clothing buy shop`;
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
          const searchProducts = (response.data.items || [])
            .filter(item => !forbidden.test(item.title + ' ' + (item.snippet || '')))
            .filter(item => !nonProductSites.test(item.link))
            .filter(item => /shop|store|buy|product|item|clothing|apparel|fashion/i.test(item.title + ' ' + (item.snippet || ''))) // Only shopping/product sites
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
    
    conversation.messages.push({ role: 'assistant', content: finalReply });
    
    console.log('DEBUG: About to send JSON response');
    res.json({ reply: finalReply, products });
    console.log('DEBUG: JSON response sent successfully');
    
    // Save conversation after sending response to avoid blocking
    if (mongoose.Types.ObjectId.isValid(userId)) {
      try {
        await conversation.save();
        console.log('DEBUG: Conversation saved successfully');
      } catch (saveError) {
        console.error('DEBUG: Error saving conversation:', saveError);
        // Don't fail the request if save fails
      }
    }
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