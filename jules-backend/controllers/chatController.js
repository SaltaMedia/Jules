require('dotenv').config();
const { OpenAI } = require('openai');
const Conversation = require('../models/Conversation');
const axios = require('axios');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Aggressively strip canned closers, hype, and content-writer endings
function stripClosers(text) {
  if (!text) return text;
  // Remove common closers and hype phrases
  const closerPatterns = [
    /(?:Let me know if.*?)([.!?])?$/i,
    /(?:Hope (that|this) helps.*?)([.!?])?$/i,
    /(?:You\'?re all set.*?)([.!?])?$/i,
    /(?:Keep bringing the style questions.*?)([.!?])?$/i,
    /(?:I\'?ll keep dishing out the style solutions.*?)([.!?])?$/i,
    /(?:Rock it with confidence.*?)([.!?])?$/i,
    /(?:effortlessly cool.*?)([.!?])?$/i,
    /(?:level up your style game.*?)([.!?])?$/i,
    /(?:my friend[.!?])$/i,
    /(?:Just say the word.*?)([.!?])?$/i,
    /(?:I\'?ve got you covered.*?)([.!?])?$/i,
    /(?:Keep bringing.*?questions.*?I\'?ll.*?solutions.*?)([.!?])?$/i,
    /(?:Let\'?s do this.*?)([.!?])?$/i,
    /(?:Treat yourself to a pair.*?)([.!?])?$/i,
    /(?:up your workout game.*?)([.!?])?$/i,
    /(?:Keep.*?coming.*?I\'?ll.*?keep.*?dishing.*?out.*?solutions.*?)([.!?])?$/i,
    /(?:If you need more.*?Just ask.*?)([.!?])?$/i,
    /(?:I\'?m always here.*?)([.!?])?$/i,
    /(?:Let\'?s keep.*?going.*?)([.!?])?$/i,
    /(?:You got this.*?)([.!?])?$/i,
    /(?:Showtime baby.*?)([.!?])?$/i,
    /(?:charisma is irresistible.*?)([.!?])?$/i,
    /(?:I\'?m just a message away.*?)([.!?])?$/i,
    /(?:I\'?m here whenever you need.*?)([.!?])?$/i,
    /(?:Let\'?s keep the style rolling.*?)([.!?])?$/i,
    /(?:I\'?m always ready to help.*?)([.!?])?$/i,
    /(?:Ready to help you.*?)([.!?])?$/i,
    /(?:Just say the word.*?)([.!?])?$/i,
    /(?:I\'?m here to help.*?)([.!?])?$/i,
    /(?:Let\'?s keep.*?going.*?)([.!?])?$/i,
    /(?:Let\'?s dial up your cool factor.*?)([.!?])?$/i,
    /(?:Let\'?s.*?get started.*?)([.!?])?$/i,
    /(?:Let\'?s.*?level up.*?)([.!?])?$/i,
    /(?:Let\'?s.*?shop.*?)([.!?])?$/i,
    /(?:Let\'?s.*?argue.*?)([.!?])?$/i,
    /(?:Let\'?s.*?fix.*?)([.!?])?$/i,
    /(?:Let\'?s.*?move.*?)([.!?])?$/i,
    /(?:Let\'?s.*?win.*?)([.!?])?$/i,
    /(?:Let\'?s.*?keep.*?)([.!?])?$/i,
    /(?:Let\'?s.*?roll.*?)([.!?])?$/i,
    /(?:Let\'?s.*?rock.*?)([.!?])?$/i,
    /(?:Let\'?s.*?go.*?)([.!?])?$/i,
    /(?:Let\'?s.*?do.*?)([.!?])?$/i,
    /(?:Let\'?s.*?see.*?)([.!?])?$/i,
    /(?:Let\'?s.*?find.*?)([.!?])?$/i,
    /(?:Let\'?s.*?make.*?)([.!?])?$/i,
    /(?:Let\'?s.*?try.*?)([.!?])?$/i,
    /(?:Let\'?s.*?talk.*?)([.!?])?$/i,
    /(?:Let\'?s.*?chat.*?)([.!?])?$/i,
    /(?:Let\'?s.*?work.*?)([.!?])?$/i,
    /(?:Let\'?s.*?plan.*?)([.!?])?$/i,
    /(?:Let\'?s.*?start.*?)([.!?])?$/i,
    /(?:Let\'?s.*?begin.*?)([.!?])?$/i,
    /(?:Let\'?s.*?move.*?)([.!?])?$/i,
    /(?:Let\'?s.*?fix.*?)([.!?])?$/i,
    /(?:Let\'?s.*?argue.*?)([.!?])?$/i,
    /(?:Let\'?s.*?win.*?)([.!?])?$/i,
    /(?:Let\'?s.*?keep.*?)([.!?])?$/i,
    /(?:Let\'?s.*?roll.*?)([.!?])?$/i,
    /(?:Let\'?s.*?rock.*?)([.!?])?$/i,
    /(?:Let\'?s.*?go.*?)([.!?])?$/i,
    /(?:Let\'?s.*?do.*?)([.!?])?$/i,
    /(?:Let\'?s.*?see.*?)([.!?])?$/i,
    /(?:Let\'?s.*?find.*?)([.!?])?$/i,
    /(?:Let\'?s.*?make.*?)([.!?])?$/i,
    /(?:Let\'?s.*?try.*?)([.!?])?$/i,
    /(?:Let\'?s.*?talk.*?)([.!?])?$/i,
    /(?:Let\'?s.*?chat.*?)([.!?])?$/i,
    /(?:Let\'?s.*?work.*?)([.!?])?$/i,
    /(?:Let\'?s.*?plan.*?)([.!?])?$/i,
    /(?:Let\'?s.*?start.*?)([.!?])?$/i,
    /(?:Let\'?s.*?begin.*?)([.!?])?$/i,
    /(?:Is there anything else.*?)([.!?])?$/i,
    /(?:Anything else.*?)([.!?])?$/i,
    /(?:What else.*?)([.!?])?$/i,
    /(?:Need anything else.*?)([.!?])?$/i,
    /(?:Want anything else.*?)([.!?])?$/i,
    /(?:Can I help with anything else.*?)([.!?])?$/i,
    /(?:Any other questions.*?)([.!?])?$/i,
    /(?:Other questions.*?)([.!?])?$/i,
    /(?:More questions.*?)([.!?])?$/i,
    /(?:Any more questions.*?)([.!?])?$/i,
    /(?:Got any other questions.*?)([.!?])?$/i,
    /(?:Have any other questions.*?)([.!?])?$/i,
    /(?:Any other style questions.*?)([.!?])?$/i,
    /(?:Other style questions.*?)([.!?])?$/i,
    /(?:More style questions.*?)([.!?])?$/i,
    /(?:Any more style questions.*?)([.!?])?$/i,
    /(?:Got any other style questions.*?)([.!?])?$/i,
    /(?:Have any other style questions.*?)([.!?])?$/i,
    /(?:Stay comfortable.*?)([.!?])?$/i,
    /(?:Stay stylish.*?)([.!?])?$/i,
    /(?:enjoy the views.*?)([.!?])?$/i,
    /(?:with confidence.*?)([.!?])?$/i,
    /(?:Stay.*?comfortable.*?)([.!?])?$/i,
    /(?:Stay.*?stylish.*?)([.!?])?$/i,
    /(?:enjoy.*?views.*?)([.!?])?$/i,
    /(?:with.*?confidence.*?)([.!?])?$/i,
    /(?:comfortable.*?stylish.*?)([.!?])?$/i,
    /(?:stylish.*?confidence.*?)([.!?])?$/i,
    /(?:comfortable.*?confidence.*?)([.!?])?$/i,
    /(?:enjoy.*?confidence.*?)([.!?])?$/i,
    /(?:views.*?confidence.*?)([.!?])?$/i,
    /(?:Stay.*?enjoy.*?)([.!?])?$/i,
    /(?:Stay.*?views.*?)([.!?])?$/i,
    /(?:Stay.*?confidence.*?)([.!?])?$/i,
    /(?:comfortable.*?enjoy.*?)([.!?])?$/i,
    /(?:comfortable.*?views.*?)([.!?])?$/i,
    /(?:stylish.*?enjoy.*?)([.!?])?$/i,
    /(?:stylish.*?views.*?)([.!?])?$/i,
    /(?:confidence.*?enjoy.*?)([.!?])?$/i,
    /(?:confidence.*?views.*?)([.!?])?$/i,
    /(?:comfortable.*?stylish.*?confidence.*?)([.!?])?$/i,
    /(?:Stay.*?comfortable.*?stylish.*?)([.!?])?$/i,
    /(?:Stay.*?comfortable.*?confidence.*?)([.!?])?$/i,
    /(?:Stay.*?stylish.*?confidence.*?)([.!?])?$/i,
    /(?:comfortable.*?stylish.*?enjoy.*?)([.!?])?$/i,
    /(?:comfortable.*?stylish.*?views.*?)([.!?])?$/i,
    /(?:stylish.*?enjoy.*?confidence.*?)([.!?])?$/i,
    /(?:enjoy.*?views.*?confidence.*?)([.!?])?$/i,
    /(?:Stay.*?comfortable.*?stylish.*?enjoy.*?)([.!?])?$/i,
    /(?:Stay.*?comfortable.*?stylish.*?views.*?)([.!?])?$/i,
    /(?:Stay.*?comfortable.*?stylish.*?confidence.*?)([.!?])?$/i,
    /(?:Stay.*?comfortable.*?enjoy.*?confidence.*?)([.!?])?$/i,
    /(?:Stay.*?stylish.*?enjoy.*?confidence.*?)([.!?])?$/i,
    /(?:comfortable.*?stylish.*?enjoy.*?confidence.*?)([.!?])?$/i,
    /(?:Stay.*?comfortable.*?stylish.*?enjoy.*?confidence.*?)([.!?])?$/i,
    /(?:Keep it.*?)([.!?])?$/i,
    /(?:own the.*?)([.!?])?$/i,
    /(?:Keep.*?it.*?)([.!?])?$/i,
    /(?:own.*?the.*?)([.!?])?$/i,
    /(?:Keep it.*?effortless.*?)([.!?])?$/i,
    /(?:Keep it.*?stylish.*?)([.!?])?$/i,
    /(?:Keep it.*?confident.*?)([.!?])?$/i,
    /(?:own the.*?scene.*?)([.!?])?$/i,
    /(?:own the.*?vibe.*?)([.!?])?$/i,
    /(?:effortless.*?stylish.*?)([.!?])?$/i,
    /(?:stylish.*?confident.*?)([.!?])?$/i,
    /(?:effortless.*?confident.*?)([.!?])?$/i,
    /(?:scene.*?vibe.*?)([.!?])?$/i,
    /(?:scene.*?confident.*?)([.!?])?$/i,
    /(?:vibe.*?confident.*?)([.!?])?$/i,
    /(?:Keep.*?effortless.*?)([.!?])?$/i,
    /(?:Keep.*?stylish.*?)([.!?])?$/i,
    /(?:Keep.*?confident.*?)([.!?])?$/i,
    /(?:own.*?scene.*?)([.!?])?$/i,
    /(?:own.*?vibe.*?)([.!?])?$/i,
    /(?:it.*?effortless.*?)([.!?])?$/i,
    /(?:it.*?stylish.*?)([.!?])?$/i,
    /(?:it.*?confident.*?)([.!?])?$/i,
    /(?:the.*?scene.*?)([.!?])?$/i,
    /(?:the.*?vibe.*?)([.!?])?$/i,
    /(?:Keep it.*?effortless.*?stylish.*?)([.!?])?$/i,
    /(?:Keep it.*?effortless.*?confident.*?)([.!?])?$/i,
    /(?:Keep it.*?stylish.*?confident.*?)([.!?])?$/i,
    /(?:own the.*?scene.*?vibe.*?)([.!?])?$/i,
    /(?:own the.*?scene.*?confident.*?)([.!?])?$/i,
    /(?:own the.*?vibe.*?confident.*?)([.!?])?$/i,
    /(?:effortless.*?stylish.*?confident.*?)([.!?])?$/i,
    /(?:scene.*?vibe.*?confident.*?)([.!?])?$/i,
    /(?:Keep it.*?effortless.*?stylish.*?confident.*?)([.!?])?$/i,
    /(?:own the.*?scene.*?vibe.*?confident.*?)([.!?])?$/i,
    /(?:Keep it.*?effortless.*?stylish.*?own the.*?)([.!?])?$/i,
    /(?:Keep it.*?effortless.*?stylish.*?scene.*?)([.!?])?$/i,
    /(?:Keep it.*?effortless.*?stylish.*?vibe.*?)([.!?])?$/i,
    /(?:Keep it.*?effortless.*?stylish.*?scene.*?vibe.*?)([.!?])?$/i,
    /(?:Keep it.*?effortless.*?stylish.*?scene.*?vibe.*?confident.*?)([.!?])?$/i
  ];
  let result = text;
  closerPatterns.forEach(pattern => {
    result = result.replace(pattern, '').trim();
  });
  // Remove trailing hype/closer sentences (e.g., "You're all set!", "Hope that helps!", etc.)
  result = result.replace(/([.!?])\s+([A-Z][^.!?]{0,40}(all set|let me know|hope this helps|keep bringing|keep dishing|rock it|effortlessly cool|level up|my friend|just say the word|got you covered|keep bringing|keep dishing|let's do this|treat yourself|up your workout game|showtime baby|charisma is irresistible|just a message away|here whenever you need|keep the style rolling|always ready to help|ready to help you|just say the word|here to help|let's keep going|let's dial up your cool factor|let's get started|let's level up|let's shop|let's argue|let's fix|let's move|let's win|let's keep|let's roll|let's rock|let's go|let's do|let's see|let's find|let's make|let's try|let's talk|let's chat|let's work|let's plan|let's start|let's begin|let's move|let's fix|let's argue|let's win|let's keep|let's roll|let's rock|let's go|let's do|let's see|let's find|let's make|let's try|let's talk|let's chat|let's work|let's plan|let's start|let's begin|stay comfortable|stay stylish|enjoy the views|with confidence|comfortable|stylish|enjoy|views|confidence|keep it|own the|effortless|scene|vibe)[^.!?]{0,40}[.!?])/gi, '$1');
  return result;
}

// Handle chat requests
exports.handleChat = async (req, res) => {
  const { message, userId } = req.body;
  console.log('DEBUG: handleChat called. Incoming message:', message, 'userId:', userId);
  if (!message || !userId) {
    return res.status(400).json({ error: 'Message and userId are required.' });
  }
  
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
    let conversation = await Conversation.findOne({ userId });
    if (!conversation) {
      conversation = new Conversation({ userId, messages: [] });
    }
    conversation.messages.push({ role: 'user', content: message });
    conversation.messages.push({ role: 'assistant', content: "I'm not able to pull up images yet, but that's coming soon. In the meantime, I can give you some guidance." });
    await conversation.save();
    return res.json({ reply: "I'm not able to pull up images yet, but that's coming soon. In the meantime, I can give you some guidance.", products: [] });
  }

  // More specific product detection - only trigger for explicit shopping requests
  const clothingOutfitRequest = /(shorts|shoes|jacket|shirt|jeans|pants|sneakers|boots|suit|blazer|tie|belt|watch|accessory|outfit|clothing|apparel|fashion|dress|wear|brand|ten thousand|lululemon|nike|adidas|brooks|asics|levi|uniqlo|jcrew|target|amazon)/i.test(message);
  
  // Very specific shopping triggers - only when explicitly asking for products/links
  const askingForRecommendations = /(show\\s*me|can\\s*you\\s*show|help\\s*me\\s*find|looking\\s*for|need|want|get|buy|find|where\\s*can\\s*i|recommend|suggest|examples?|options?|links?|any\\s*examples?|got\\s*examples?)/i.test(message);
  
  // Only trigger product search when asking about clothing/outfits AND asking for shopping links
  const isProductRequest = clothingOutfitRequest && askingForRecommendations;
  
  // Check if user is asking for links to products Jules just mentioned
  const isLinkRequest = /(links?|examples?|show\\s*me|can\\s*you\\s*show|where\\s*can\\s*i|any\\s*examples?|got\\s*examples?)/i.test(message) && !isProductRequest;
  
  console.log('DEBUG: clothingOutfitRequest:', clothingOutfitRequest);
  console.log('DEBUG: askingForRecommendations:', askingForRecommendations);
  console.log('DEBUG: isProductRequest:', isProductRequest);
  console.log('DEBUG: isLinkRequest:', isLinkRequest);
  
  try {
    let conversation = await Conversation.findOne({ userId });
    if (!conversation) {
      conversation = new Conversation({ userId, messages: [] });
    }
    conversation.messages.push({ role: 'user', content: message });
    const recentMessages = conversation.messages.slice(-10);
    
    // Enhanced system prompt with Jules's authentic personality
    const messages = [
      { role: 'system', content: `You are Jules — a confident, stylish friend who tells it like it is. You're opinionated, natural, and don't sugarcoat things.

PERSONALITY:
- Confident and direct - you have strong opinions and share them
- Natural conversationalist - you talk like a real person, not an AI
- Opinionated about fashion and style - you know what looks good and what doesn't
- Empathetic but not overly emotional - you care but you're not mushy
- You have a sense of humor and can be playful
- You're observant and notice details about people and situations
- You give practical, actionable advice, not generic platitudes

HOW YOU TALK:
- Use contractions (you're, I'm, don't, can't, etc.)
- Be conversational and natural, like talking to a friend
- Share your actual opinions, not neutral information
- Ask follow-up questions when you need more context
- Be direct and honest - if something looks bad, say so
- Use casual language, not formal or academic tone
- Keep responses focused and to the point - don't ramble or give unnecessary details

FASHION & STYLE:
- You have strong opinions about what looks good
- You know brands and can recommend specific ones
- You understand fit, quality, and style
- You can spot trends but prefer timeless pieces
- You're honest about what works and what doesn't

DATING & RELATIONSHIPS:
- You give practical, real-world advice
- You understand social dynamics and human behavior
- You're supportive but also realistic
- You can be flirty and playful when appropriate

LIFE ADVICE:
- You give practical, actionable advice
- You're honest about challenges and realities
- You focus on what actually works, not idealistic platitudes

CRITICAL RULES:
NEVER USE:
- AI language like "circuits," "algorithms," "processing"
- Terms of endearment like "honey," "sweetie," "dear"
- Generic motivational closers or slogans
- Overly formal or academic language
- Long, rambling responses that turn into listicles
- Neutral, ChatGPT-style information dumps

ALWAYS:
- Be yourself - confident, opinionated, and natural
- Give specific, actionable advice
- Ask follow-up questions when you need more context
- Keep responses focused and conversational
- Share your actual opinions and preferences
- Be direct and honest about what you think

EXAMPLES OF GOOD RESPONSES:
- "Ugh, fast fashion is such a mess. It's cheap but it falls apart after two washes and looks terrible. I'd rather spend a bit more on something that actually lasts."
- "That outfit sounds perfect for a first date - shows you care without trying too hard. Just make sure the fit is right."
- "Those shoes are way too formal for that event. You'll look like you're going to a funeral. Go with something more casual."

EXAMPLES OF BAD RESPONSES:
- "Here are the pros and cons of fast fashion..." (too neutral, listicle)
- "Remember to be confident and stay true to yourself!" (generic closer)
- "Fast fashion encompasses various aspects including affordability, accessibility, and environmental considerations..." (ChatGPT-style)

When someone asks for your opinion, give it directly and honestly. When someone asks for advice, be specific and practical. When someone needs support, be empathetic but real.` },
      ...recentMessages
    ];
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages,
      max_tokens: 4096, // Maximum allowed for GPT-3.5-turbo
    });
    const reply = completion.choices[0].message.content;
    
    // Debug: Log response length to see if it's being truncated
    console.log('DEBUG: Response length:', reply.length);
    console.log('DEBUG: Response preview:', reply.substring(0, 200) + '...');
    console.log('DEBUG: Response ends with:', reply.substring(reply.length - 50));
    
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
        
        // Use the actual user message for search, not extracted content
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
      // Use the user's message directly for search instead of extracting from Jules's response
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
    
    conversation.messages.push({ role: 'assistant', content: cleanedReply.trim() });
    await conversation.save();
    res.json({ reply: cleanedReply.trim(), products });
  } catch (err) {
    console.error('OpenAI error:', err);
    res.status(500).json({ error: 'Error processing chat.' });
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