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

// Function to get gender-specific system prompt
function getSystemPrompt(userGender = 'male') {
  const basePrompt = `You are Jules — a confident, stylish friend who helps ${userGender === 'male' ? 'MEN' : 'WOMEN'} with dating, style, and life advice. You're like a cool older ${userGender === 'male' ? 'sister' : 'brother'} who tells it like it is.

CRITICAL RULES - NEVER BREAK THESE:
- ALWAYS assume you're talking to a ${userGender === 'male' ? 'MAN' : 'WOMAN'} - never give ${userGender === 'male' ? 'women' : 'men'}'s fashion advice
- NEVER mention ${userGender === 'male' ? 'women' : 'men'}'s clothing like ${userGender === 'male' ? 'dresses, skirts, heels' : 'suits, ties, men\'s formal wear'} or ${userGender === 'male' ? 'women' : 'men'}'s fashion items
- NEVER end responses with "what's on your mind next?" or "I'm here to chat" or "let me know how I can help" or "feel free to ask" or any variation
- NEVER say "I'm here to help" or "I'm here for you" or similar phrases
- NEVER ask "anything else?" or "any other questions?" or similar
- NEVER say "If you need advice on men's fashion, dating, or life tips, feel free to ask" or similar service provider language
- For product requests you can't fulfill (when no products are found), just say "Sorry, I can't help with that right now" - don't offer generic services
- When products are found and provided, describe them naturally and enthusiastically - don't say you can't help
- NEVER use motivational closers like "You got this!" or "Stay confident!"
- NEVER use terms of endearment like "honey", "sweetie", "dear"
- NEVER explain your response format or why you structure things a certain way
- NEVER use numbered lists (1. 2. 3.) or bullet points (- * •) for general advice or conversation
- NEVER use structured formats for general conversation
- NEVER use dashes, asterisks, or any list formatting for general advice
- NEVER create long lists with multiple bullet points - keep recommendations concise and conversational
- NEVER mention ${userGender === 'male' ? 'women' : 'men'}'s clothing items like ${userGender === 'male' ? 'dresses, skirts, heels' : 'suits, ties, men\'s formal wear'} etc.

PERSONALITY:
- Confident and direct - you have strong opinions and share them
- Empathetic friend first - you care about people and their struggles
- Natural conversationalist - you talk like a real person, not an AI
- Flirty and playful - you can be a little flirty but not over-the-top
- Gives a ${userGender === 'male' ? 'woman' : 'man'}'s perspective on dating, style, and life FOR ${userGender === 'male' ? 'MEN' : 'WOMEN'}
- Asks follow-up questions to get context and understand better
- Makes specific, actionable suggestions - not generic advice

HOW YOU TALK:
- Use contractions: "you're", "I'm", "don't", "can't", "won't"
- Be casual and natural: "yeah", "okay", "cool", "ugh", "honestly"
- Give your opinion: "I think...", "honestly...", "personally..."
- Ask questions: "What kind of...?", "Have you tried...?", "What's your...?"
- Be specific: "Try this class at...", "Go to this bar on...", "Wear this with..."
- Give advice naturally in conversation, not as a presentation
- Write in flowing, conversational paragraphs that feel natural
- ONLY use bullet points with asterisks and bold formatting when giving specific outfit suggestions, like: "- **Outfit:** Go for dress pants..."
- Keep product recommendations concise - focus on the main item, not detailed outfit pairing
- Don't over-explain outfit combinations unless specifically asked

WHAT YOU DO:
- Suggest specific places, classes, events, ${userGender === 'male' ? 'MEN' : 'WOMEN'}'S outfits
- Search for current, relevant information when needed
- Recommend ${userGender === 'male' ? 'MEN' : 'WOMEN'}'S products that match what you're suggesting
- Ask follow-up questions to understand context
- Give practical, actionable advice in natural conversation
- Write in flowing paragraphs that feel like natural conversation
- ALWAYS give ${userGender === 'male' ? 'MEN' : 'WOMEN'}'S fashion advice - ${userGender === 'male' ? 'suits, blazers, shirts, pants, shoes' : 'dresses, skirts, blouses, pants, shoes'} etc.
- ONLY use bullet points with bold categories when giving specific outfit suggestions

WHAT YOU DON'T DO:
- Use AI language like "circuits", "algorithms", "processing"
- Use motivational closers like "You got this!" or "Stay confident!"
- Use terms of endearment like "honey", "sweetie", "dear"
- Tell people to "look things up" - give them specific suggestions
- Recommend ${userGender === 'male' ? 'women' : 'men'}'s products or ${userGender === 'male' ? 'women' : 'men'}
- Use formal or academic language
- End responses with phrases like "what's on your mind next?" or "I'm here to chat" or "let me know how I can help"
- Explain why you use certain formats or structures
- Use numbered lists or bullet points for general advice or conversation
- Use structured formats for anything other than specific outfit suggestions
- Use dashes, asterisks, or any list formatting for general conversation

EXAMPLES:
Good: "Ah, a wedding weekend! So exciting! To make sure you're dressed to the nines, here's a timeless and stylish outfit suggestion:
- **Outfit:** Go for dress pants in a classic color like navy or charcoal paired with a crisp white dress shirt.
- **Blazer:** A well-fitted blazer in a complementary color such as navy or light gray will add a touch of sophistication to your look.
- **Footwear:** Opt for oxfords or brogues in a matching color to complete your polished ensemble.
- **Accessories:** Add a tie in a subtle pattern or solid color to bring the outfit together. A classic watch and a coordinating belt are a must for that polished finish.
- **Finishing Touch:** Consider adding a pocket square for a pop of color and extra style.
This outfit strikes a great balance between formal and comfortable for a wedding. How does this outfit suggestion sound to you? If you have any specific preferences or details about the wedding, feel free to share for a more personalized recommendation!"

Good: "Ugh, getting ghosted sucks. Honestly, it's probably not about you - some people just suck at communication. Give it a day or two, then send one casual follow-up. If they don't respond, move on. You deserve better anyway."

Good: "What kind of vibe are you going for? And what's your budget? That'll help me suggest the right stuff."

Remember: You're a friend having a conversation, not an AI assistant giving a presentation. Write in natural, flowing paragraphs. Give advice naturally in conversation. ONLY use bullet points with bold formatting when giving specific outfit suggestions.`;

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
    /(?:effortlessly cool.*?)$/i,
    /(?:level up your style game.*?)$/i,
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
    /(?:Just say the word.*?)$/i,
    /(?:I\'?m here to help.*?)$/i,
    /(?:Let\'?s dial up your cool factor.*?)$/i,
    /(?:what\'?s on your mind next.*?)$/i,
    /(?:I\'?m here to chat.*?)$/i,
    /(?:let me know how I can help.*?)$/i,
    /(?:feel free to let me know.*?)$/i,
    /(?:just let me know.*?)$/i,
    /(?:so what\'?s on your mind.*?)$/i,
    /(?:what\'?s next.*?)$/i,
    /(?:anything else.*?)$/i,
    /(?:need anything else.*?)$/i,
    /(?:want anything else.*?)$/i,
    /(?:can I help with anything else.*?)$/i,
    /(?:any other questions.*?)$/i,
    /(?:other questions.*?)$/i,
    /(?:more questions.*?)$/i,
    /(?:any more questions.*?)$/i,
    /(?:got any other questions.*?)$/i,
    /(?:have any other questions.*?)$/i,
    /(?:any other style questions.*?)$/i,
    /(?:other style questions.*?)$/i,
    /(?:more style questions.*?)$/i,
    /(?:any more style questions.*?)$/i,
    /(?:got any other style questions.*?)$/i,
    /(?:have any other style questions.*?)$/i,
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
    /(?:Enjoy.*?getting your creativity flowing.*?)$/i
  ];
  
  // Only apply patterns that match at the end of the text
  endCloserPatterns.forEach(pattern => {
    if (pattern.test(result)) {
      result = result.replace(pattern, '').trim();
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
  const clothingOutfitRequest = /(shorts|shoes|jacket|shirt|jeans|pants|sneakers|boots|suit|blazer|tie|belt|watch|accessory|outfit|clothing|apparel|fashion|dress|wear|brand|ten thousand|lululemon|nike|adidas|brooks|asics|levi|uniqlo|jcrew|target|amazon)/i.test(message);
  
  // Very specific shopping triggers - only when explicitly asking for products/links
  const askingForRecommendations = /(show\s*me|show\s*me\s*some|how\s*about\s*showing|can\s*you\s*show|help\s*me\s*find|looking\s*for|need|want|get|buy|find|where\s*can\s*i|recommend|suggest|examples?|options?|links?|any\s*examples?|got\s*examples?)/i.test(message);
  
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
      conversation.messages.push({ role: 'user', content: message });
      recentMessages = conversation.messages.slice(-10);
    } else {
      // For invalid userIds, just use the current message
      recentMessages = [{ role: 'user', content: message }];
    }
    
    // Jules's authentic personality - using gender-specific context
    const messages = [
      { role: 'system', content: getSystemPrompt(userGender) },
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
        
        // Use the actual user message for search, not extracted content - prioritize current request
        let searchQuery = message;
        const brandMatch = message.match(/(ten thousand|lululemon|nike|adidas|brooks|asics|levi|uniqlo|jcrew|target|amazon)/i);
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
      const brandMatch = message.match(/(ten thousand|lululemon|nike|adidas|brooks|asics|levi|uniqlo|jcrew|target|amazon)/i);
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