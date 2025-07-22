const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const axios = require('axios');

// Helper function to extract product context from conversation
function extractProductContext(conversation, currentMessage, julesResponse = null) {
  let contextText = '';
  
  if (conversation && conversation.messages && conversation.messages.length > 0) {
    // Get the last few messages for context
    const recentMessages = conversation.messages.slice(-6);
    contextText = recentMessages.map(msg => msg.content).join(' ');
  }
  
  // Combine current message with context for better extraction
  let fullContext = `${contextText} ${currentMessage}`;
  
  // If we have Jules's response, add it to the context for brand extraction
  if (julesResponse) {
    fullContext += ` ${julesResponse}`;
  }
  
  // Extract different types of products and brands
  const jewelryKeywords = /necklace|ring|earrings|bracelet|jewelry|pendant|chain/i;
  const clothingKeywords = /shirt|jeans|pants|shoes|jacket|dress|outfit|clothing/i;
  const techKeywords = /phone|watch|headphones|tech|gadget|electronics/i;
  
  // Enhanced brand extraction - look for brands in Jules's recommendations
  console.log('DEBUG: Full context for brand extraction:', fullContext.substring(0, 200) + '...');
  
  // Check for specific denim brands first
  let brandMatch = null;
  if (fullContext.match(/naked.*famous/i)) {
    brandMatch = ['naked & famous'];
  } else if (fullContext.match(/a\.p\.c/i)) {
    brandMatch = ['a.p.c'];
  } else if (fullContext.match(/nudie.*jeans/i)) {
    brandMatch = ['nudie jeans'];
  } else if (fullContext.match(/acne.*studios/i)) {
    brandMatch = ['acne studios'];
  } else if (fullContext.match(/rag.*bone/i)) {
    brandMatch = ['rag & bone'];
  } else {
    // Fallback to general brand matching
    brandMatch = fullContext.match(/(ten thousand|lululemon|nike|adidas|brooks|asics|levi|uniqlo|jcrew|target|amazon|mejuri|gorjana|missoma|catbird|ana luisa|pandora|kendra scott|tiffany|cartier|bellroy|shinola|brooks brothers|nudie|apc|acne.*studios|rag.*bone)/i);
  }
  
  // If no brand found in full context, specifically look in Jules's recent messages
  let extractedBrand = brandMatch ? brandMatch[0] : null;
  console.log('DEBUG: Initial brand extraction:', extractedBrand);
  
  if (!extractedBrand && conversation && conversation.messages && conversation.messages.length > 0) {
    // Look at the last few assistant messages (Jules's responses) for brand recommendations
    const assistantMessages = conversation.messages
      .filter(msg => msg.role === 'assistant')
      .slice(-3); // Last 3 assistant messages
    
    console.log('DEBUG: Checking assistant messages for brands:', assistantMessages.length);
    for (const msg of assistantMessages) {
      console.log('DEBUG: Checking message:', msg.content.substring(0, 100) + '...');
      // Check for specific denim brands first in assistant messages
      let brandInMessage = null;
      if (msg.content.match(/naked.*famous/i)) {
        brandInMessage = ['naked & famous'];
      } else if (msg.content.match(/a\.p\.c/i)) {
        brandInMessage = ['a.p.c'];
      } else if (msg.content.match(/nudie.*jeans/i)) {
        brandInMessage = ['nudie jeans'];
      } else if (msg.content.match(/acne.*studios/i)) {
        brandInMessage = ['acne studios'];
      } else if (msg.content.match(/rag.*bone/i)) {
        brandInMessage = ['rag & bone'];
      } else {
        // Fallback to general brand matching
        brandInMessage = msg.content.match(/(ten thousand|lululemon|nike|adidas|brooks|asics|levi|uniqlo|jcrew|target|amazon|mejuri|gorjana|missoma|catbird|ana luisa|pandora|kendra scott|tiffany|cartier|bellroy|shinola|brooks brothers|nudie|apc|acne.*studios|rag.*bone)/i);
      }
      if (brandInMessage) {
        extractedBrand = brandInMessage[0];
        console.log('DEBUG: Found brand in assistant message:', extractedBrand);
        break;
      }
    }
  }
  
  console.log('DEBUG: Final extracted brand:', extractedBrand);
  const productMatch = fullContext.match(/(shorts|shoes|jacket|shirt|tee|t-shirt|graphic|jeans|pants|sneakers|boots|suit|blazer|tie|belt|watch|accessory|coat|winter|casual|formal|dress|outfit|loafers|vans|necklace|ring|earrings|bracelet|jewelry|pendant|chain)/i);
  
  // Determine product category
  let category = 'clothing';
  if (jewelryKeywords.test(fullContext)) {
    category = 'jewelry';
  } else if (techKeywords.test(fullContext)) {
    category = 'tech';
  }
  
  // Extract budget information
  const budgetMatch = fullContext.match(/\$(\d+)/);
  const budget = budgetMatch ? parseInt(budgetMatch[1]) : null;
  
  // Extract style preferences
  const styleKeywords = {
    minimal: /minimal|simple|clean|basic|dainty|delicate/i,
    bold: /bold|chunky|statement|dramatic/i,
    vintage: /vintage|retro|classic|old-school/i,
    casual: /casual|everyday|comfortable|laid-back/i
  };
  
  let style = 'general';
  for (const [styleType, pattern] of Object.entries(styleKeywords)) {
    if (pattern.test(fullContext)) {
      style = styleType;
      break;
    }
  }
  
  return {
    category,
    brand: extractedBrand,
    product: productMatch ? productMatch[0] : null,
    budget,
    style,
    fullContext,
    isGift: /girlfriend|wife|partner|gift|present|buy.*her/i.test(fullContext)
  };
}

// Helper function to build search query based on context
function buildSearchQuery(context) {
  let searchQuery = '';
  
  if (context.category === 'jewelry') {
    if (context.brand && context.product) {
      searchQuery = `${context.brand} ${context.product} buy shop`;
    } else if (context.brand) {
      searchQuery = `${context.brand} jewelry ${context.style} buy shop`;
    } else if (context.product) {
      searchQuery = `${context.product} ${context.style} jewelry buy shop`;
    } else {
      searchQuery = `${context.style} jewelry buy shop`;
    }
  } else if (context.category === 'tech') {
    if (context.brand && context.product) {
      searchQuery = `${context.brand} ${context.product} buy shop`;
    } else if (context.brand) {
      searchQuery = `${context.brand} tech gadgets buy shop`;
    } else if (context.product) {
      searchQuery = `${context.product} buy shop`;
    } else {
      searchQuery = `tech gadgets buy shop`;
    }
  } else {
    // Default clothing search
    if (context.brand && context.product) {
      searchQuery = `${context.brand} men's ${context.product} buy shop`;
    } else if (context.brand) {
      searchQuery = `${context.brand} men's clothing buy shop`;
    } else if (context.product) {
      searchQuery = `men's ${context.product} buy shop`;
    } else {
      searchQuery = `men's clothing buy shop`;
    }
  }
  
  // Add budget constraint if available
  if (context.budget) {
    searchQuery += ` under $${context.budget}`;
  }
  
  return searchQuery;
}

// POST /api/products - Get product recommendations with conversation context
router.post('/', auth, async (req, res) => {
  try {
    const { message, conversation, julesResponse } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    // Extract product context from conversation and Jules's response
    const context = extractProductContext(conversation, message, julesResponse);
    console.log('DEBUG: Product context extracted:', context);
    
    // Build search query
    const searchQuery = buildSearchQuery(context);
    console.log('DEBUG: Search query:', searchQuery);
    
    // Perform Google Custom Search
    const apiKey = process.env.GOOGLE_API_KEY;
    const cseId = process.env.GOOGLE_CSE_ID;
    
    if (!apiKey || !cseId) {
      console.error('Missing Google API credentials');
      return res.status(500).json({ error: 'Product search not configured' });
    }
    
    const response = await axios.get('https://www.googleapis.com/customsearch/v1', {
      params: {
        key: apiKey,
        cx: cseId,
        q: searchQuery,
        num: 6,
        safe: 'active',
      },
    });
    
    // Filter and process results
    const forbidden = context.isGift 
      ? /kids|child|children/i  // Only filter kids for gifts
      : /women|woman|dress|gown|skirt|heels|female|bride|girl|girls|ladies|lady|kids|child|children/i;
    
    const nonProductSites = /youtube\.com|youtu\.be|reddit\.com|instagram\.com|facebook\.com|twitter\.com|tiktok\.com|pinterest\.com|blog|article|news|review|quora|economist|medium|substack|linkedin|tumblr/i;
    const excludedBrands = /men's\s*wearhouse|mens\s*wearhouse|men\s*wearhouse/i;
    
    const products = (response.data.items || [])
      .filter(item => !forbidden.test(item.title + ' ' + (item.snippet || '')))
      .filter(item => !nonProductSites.test(item.link))
      .filter(item => !excludedBrands.test(item.title + ' ' + (item.snippet || '')))
      .filter(item => /shop|store|buy|product|item|clothing|apparel|fashion|jewelry/i.test(item.title + ' ' + (item.snippet || '')))
      .slice(0, 3)
      .map((item, index) => ({
        title: item.title || `Option ${index + 1}`,
        link: item.link,
        image: item.pagemap?.cse_image?.[0]?.src || '',
        price: item.pagemap?.offer?.[0]?.price || '',
        description: item.snippet || '',
      }));
    
    console.log('DEBUG: Found products:', products.length);
    
    res.json({ 
      products,
      context,
      searchQuery,
      hasProducts: products.length > 0
    });
    
  } catch (error) {
    console.error('Product search error:', error);
    res.status(500).json({ 
      error: 'Product search failed',
      products: [],
      hasProducts: false
    });
  }
});

module.exports = router; 