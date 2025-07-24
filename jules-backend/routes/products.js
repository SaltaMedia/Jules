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
  
  // If the user is asking "where can I buy one" or similar, look for the most recent product mentioned
  const buyOnePattern = /(?:where can i buy|where to buy|buy|get|find).*(?:one|it|this|that)/i;
  if (buyOnePattern.test(currentMessage.toLowerCase())) {
    // Look for the most recent product mention in the conversation context
    const recentProductMatch = contextText.match(/(shorts|shoes|jacket|shirt|tee|t-shirt|graphic|jeans|pants|sneakers|boots|suit|blazer|tie|belt|watch|accessory|coat|winter|casual|formal|dress|outfit|loafers|vans|necklace|ring|earrings|bracelet|jewelry|pendant|chain|button-down|button down|buttonup|button-up|polo|henley|sweater|hoodie|chinos|joggers|sweatpants|vest|waistcoat|backpack|bag)/gi);
    if (recentProductMatch && recentProductMatch.length > 0) {
      // Use the most recent product mentioned
      const mostRecentProduct = recentProductMatch[recentProductMatch.length - 1];
      console.log('DEBUG: User asking to buy "one" - most recent product:', mostRecentProduct);
      // Override the product extraction to use this specific product
      fullContext = `${fullContext} ${mostRecentProduct}`;
    }
  }
  
  // Extract different types of products and brands
  const jewelryKeywords = /necklace|ring|earrings|bracelet|jewelry|pendant|chain/i;
  const clothingKeywords = /shirt|jeans|pants|shoes|jacket|dress|outfit|clothing/i;
  const techKeywords = /phone|watch|headphones|tech|gadget|electronics/i;
  
  // Enhanced brand extraction - look for brands in Jules's recommendations
  console.log('DEBUG: Full context for brand extraction:', fullContext.substring(0, 200) + '...');
  
  // Check for brands in the full context
  const brandMatch = fullContext.match(/(rvca|suitsupply|uniqlo|j\.crew|jcrew|nike|adidas|levi|brooks|asics|ten thousand|lululemon|target|amazon|mejuri|gorjana|missoma|catbird|ana luisa|pandora|kendra scott|tiffany|cartier|bellroy|shinola|brooks brothers|nudie|apc|acne.*studios|rag.*bone|naked.*famous)/i);
  
  // PRIORITY: Look at Jules's response first if available
  let extractedBrands = [];
  if (julesResponse) {
    console.log('DEBUG: Checking Jules response for brands:', julesResponse.substring(0, 100) + '...');
    // Extract ALL brands mentioned in Jules's response
    const brandMatches = julesResponse.match(/(rvca|suitsupply|uniqlo|j\.crew|jcrew|nike|adidas|levi|brooks|asics|ten thousand|lululemon|target|amazon|mejuri|gorjana|missoma|catbird|ana luisa|pandora|kendra scott|tiffany|cartier|bellroy|shinola|brooks brothers|nudie|apc|acne.*studios|rag.*bone|naked.*famous)/gi);
    if (brandMatches && brandMatches.length > 0) {
      // Remove duplicates and keep order
      extractedBrands = [...new Set(brandMatches)];
      console.log('DEBUG: Found brands in Jules response:', extractedBrands);
    }
  }
  
  // For backward compatibility, keep the first brand as extractedBrand
  let extractedBrand = extractedBrands.length > 0 ? extractedBrands[0] : null;
  
  // If no brand found in Jules's response, check the full context
  if (!extractedBrand) {
    extractedBrand = brandMatch ? brandMatch[0] : null;
    console.log('DEBUG: Brand from full context:', extractedBrand);
  }
  
  // If still no brand, look in recent assistant messages
  if (!extractedBrand && conversation && conversation.messages && conversation.messages.length > 0) {
    // Look at the last few assistant messages (Jules's responses) for brand recommendations
    const assistantMessages = conversation.messages
      .filter(msg => msg.role === 'assistant')
      .slice(-3); // Last 3 assistant messages
    
    console.log('DEBUG: Checking assistant messages for brands:', assistantMessages.length);
    for (const msg of assistantMessages) {
      console.log('DEBUG: Checking message:', msg.content.substring(0, 100) + '...');
      // Extract all brands mentioned in this message
      const brandMatches = msg.content.match(/(rvca|suitsupply|uniqlo|j\.crew|jcrew|nike|adidas|levi|brooks|asics|ten thousand|lululemon|target|amazon|mejuri|gorjana|missoma|catbird|ana luisa|pandora|kendra scott|tiffany|cartier|bellroy|shinola|brooks brothers|nudie|apc|acne.*studios|rag.*bone|naked.*famous)/gi);
      if (brandMatches && brandMatches.length > 0) {
        extractedBrand = brandMatches[0];
        console.log('DEBUG: Found brand in assistant message:', extractedBrand);
        break;
      }
    }
  }
  
  console.log('DEBUG: Final extracted brand:', extractedBrand);
  console.log('DEBUG: Full context for product extraction:', fullContext.substring(0, 200) + '...');
  const productMatch = fullContext.match(/(shorts|shoes|jacket|shirt|tee|t-shirt|graphic|jeans|pants|sneakers|boots|suit|blazer|tie|belt|watch|accessory|coat|winter|casual|formal|dress|outfit|loafers|vans|necklace|ring|earrings|bracelet|jewelry|pendant|chain|button-down|button down|buttonup|button-up|polo|henley|sweater|hoodie|chinos|joggers|sweatpants|vest|waistcoat|backpack|bag)/i);
  console.log('DEBUG: Product match:', productMatch ? productMatch[0] : 'No product found');
  
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
    // Default clothing search - prioritize specific brands mentioned
    if (context.brand && context.product) {
      searchQuery = `"${context.brand}" men's ${context.product} buy shop purchase`;
    } else if (context.brand) {
      searchQuery = `"${context.brand}" men's ${context.product || 'clothing'} buy shop purchase`;
    } else if (context.product) {
      // If no specific brand but we have product, try to find the brands mentioned in the context
      const brandMatches = context.fullContext.match(/(suitsupply|uniqlo|j\.crew|jcrew|nike|adidas|levi|brooks|asics|ten thousand|lululemon|target|amazon|mejuri|gorjana|missoma|catbird|ana luisa|pandora|kendra scott|tiffany|cartier|bellroy|shinola|brooks brothers|nudie|apc|acne.*studios|rag.*bone|naked.*famous)/gi);
      if (brandMatches && brandMatches.length > 0) {
        // Use the first brand found
        searchQuery = `"${brandMatches[0]}" men's ${context.product} buy shop purchase`;
      } else {
        searchQuery = `men's ${context.product} buy shop purchase`;
      }
    } else {
      searchQuery = `men's clothing buy shop purchase`;
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
    
    // Get all brands mentioned in Jules's response
    const allBrands = [];
    if (julesResponse) {
      const brandMatches = julesResponse.match(/(rvca|suitsupply|uniqlo|j\.crew|jcrew|nike|adidas|levi|brooks|asics|ten thousand|lululemon|target|amazon|mejuri|gorjana|missoma|catbird|ana luisa|pandora|kendra scott|tiffany|cartier|bellroy|shinola|brooks brothers|nudie|apc|acne.*studios|rag.*bone|naked.*famous)/gi);
      if (brandMatches && brandMatches.length > 0) {
        allBrands.push(...new Set(brandMatches));
      }
    }
    
    console.log('DEBUG: All brands found:', allBrands);
    
    // Perform Google Custom Search for each brand
    const apiKey = process.env.GOOGLE_API_KEY;
    const cseId = process.env.GOOGLE_CSE_ID;
    
    if (!apiKey || !cseId) {
      console.error('Missing Google API credentials');
      return res.status(500).json({ error: 'Product search not configured' });
    }
    
    let allProducts = [];
    
    // If we have specific brands from Jules's response, search for each one
    if (allBrands.length > 0) {
      for (const brand of allBrands.slice(0, 3)) { // Limit to 3 brands to avoid too many API calls
        const brandContext = { ...context, brand };
        const searchQuery = buildSearchQuery(brandContext);
        console.log(`DEBUG: Searching for brand "${brand}":`, searchQuery);
        
        try {
          const response = await axios.get('https://www.googleapis.com/customsearch/v1', {
            params: {
              key: apiKey,
              cx: cseId,
              q: searchQuery,
              num: 2, // Get 2 results per brand
              safe: 'active',
            },
          });
          
          // Process results for this brand
          let forbidden = context.isGift 
            ? /kids|child|children/i
            : /women|woman|dress|gown|skirt|heels|female|bride|girl|girls|ladies|lady|kids|child|children/i;
          
          let nonProductSites = /youtube\.com|youtu\.be|reddit\.com|instagram\.com|facebook\.com|twitter\.com|tiktok\.com|pinterest\.com|blog|article|news|review|quora|economist|medium|substack|linkedin|tumblr|fairfield|university|bookstore|jewelry|vintage/i;
          let excludedBrands = /men's\s*wearhouse|mens\s*wearhouse|men\s*wearhouse/i;
          
          const brandProducts = (response.data.items || [])
            .filter(item => !forbidden.test(item.title + ' ' + (item.snippet || '')))
            .filter(item => !nonProductSites.test(item.link))
            .filter(item => !excludedBrands.test(item.title + ' ' + (item.snippet || '')))
            .filter(item => /shop|store|buy|product|item|clothing|apparel|fashion|jewelry/i.test(item.title + ' ' + (item.snippet || '')))
            .slice(0, 2)
            .map((item, index) => ({
              title: item.title || `${brand} Option ${index + 1}`,
              link: item.link,
              image: item.pagemap?.cse_image?.[0]?.src || '',
              price: item.pagemap?.offer?.[0]?.price || '',
              description: item.snippet || '',
              brand: brand // Add brand info to the product
            }));
          
          allProducts.push(...brandProducts);
          console.log(`DEBUG: Found ${brandProducts.length} products for ${brand}`);
        } catch (error) {
          console.error(`Error searching for brand ${brand}:`, error.message);
        }
      }
    } else {
      // Fallback to original single search if no brands found
      const searchQuery = buildSearchQuery(context);
      console.log('DEBUG: Fallback search query:', searchQuery);
      
      const response = await axios.get('https://www.googleapis.com/customsearch/v1', {
        params: {
          key: apiKey,
          cx: cseId,
          q: searchQuery,
          num: 6,
          safe: 'active',
        },
      });
      
      // Filter and process results for fallback search
      let forbidden = context.isGift 
        ? /kids|child|children/i
        : /women|woman|dress|gown|skirt|heels|female|bride|girl|girls|ladies|lady|kids|child|children/i;
      
      let nonProductSites = /youtube\.com|youtu\.be|reddit\.com|instagram\.com|facebook\.com|twitter\.com|tiktok\.com|pinterest\.com|blog|article|news|review|quora|economist|medium|substack|linkedin|tumblr|fairfield|university|bookstore|jewelry|vintage/i;
      let excludedBrands = /men's\s*wearhouse|mens\s*wearhouse|men\s*wearhouse/i;
      
      allProducts = (response.data.items || [])
        .filter(item => !forbidden.test(item.title + ' ' + (item.snippet || '')))
        .filter(item => !nonProductSites.test(item.link))
        .filter(item => {
          // Additional relevance check - ensure the item title contains the product or brand
          const itemText = (item.title + ' ' + (item.snippet || '')).toLowerCase();
          if (context.product && !itemText.includes(context.product.toLowerCase())) {
            return false;
          }
          if (context.brand && !itemText.includes(context.brand.toLowerCase())) {
            return false;
          }
          return true;
        })
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
    }
    
    // After getting products from Google (before sending response):
    if (/shirt|button.?up|short.?sleeve/i.test(message)) {
      allProducts = allProducts.filter(p => /shirt|button.?up|short.?sleeve/i.test(p.title + ' ' + p.description));
    }

    console.log('DEBUG: Found total products:', allProducts.length);
    
    res.json({ 
      products: allProducts,
      context,
      searchQuery: allBrands.length > 0 ? `Multiple brands: ${allBrands.join(', ')}` : 'Fallback search',
      hasProducts: allProducts.length > 0
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

// GET /api/products - Fallback route for Railway proxy issues
router.get('/', auth, async (req, res) => {
  try {
    // Extract query parameters for GET requests
    const { message, conversation, julesResponse } = req.query;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    // Convert query string back to object for processing
    const requestBody = {
      message,
      conversation: conversation ? JSON.parse(conversation) : null,
      julesResponse: julesResponse || null
    };
    
    // Call the same logic as POST route
    const context = extractProductContext(requestBody.conversation, requestBody.message, requestBody.julesResponse);
    console.log('DEBUG: Product context extracted (GET):', context);
    
    // Get all brands mentioned in Jules's response
    const allBrands = [];
    if (requestBody.julesResponse) {
      const brandMatches = requestBody.julesResponse.match(/(rvca|suitsupply|uniqlo|j\.crew|jcrew|nike|adidas|levi|brooks|asics|ten thousand|lululemon|target|amazon|mejuri|gorjana|missoma|catbird|ana luisa|pandora|kendra scott|tiffany|cartier|bellroy|shinola|brooks brothers|nudie|apc|acne.*studios|rag.*bone|naked.*famous)/gi);
      if (brandMatches && brandMatches.length > 0) {
        allBrands.push(...new Set(brandMatches));
      }
    }
    
    console.log('DEBUG: All brands found (GET):', allBrands);
    
    // Perform Google Custom Search for each brand
    const apiKey = process.env.GOOGLE_API_KEY;
    const cseId = process.env.GOOGLE_CSE_ID;
    
    if (!apiKey || !cseId) {
      console.error('Missing Google API credentials');
      return res.status(500).json({ error: 'Product search not configured' });
    }
    
    let allProducts = [];
    
    // If we have specific brands from Jules's response, search for each one
    if (allBrands.length > 0) {
      for (const brand of allBrands.slice(0, 3)) { // Limit to 3 brands to avoid too many API calls
        const brandContext = { ...context, brand };
        const searchQuery = buildSearchQuery(brandContext);
        console.log(`DEBUG: Searching for brand "${brand}" (GET):`, searchQuery);
        
        try {
          const response = await axios.get('https://www.googleapis.com/customsearch/v1', {
            params: {
              key: apiKey,
              cx: cseId,
              q: searchQuery,
              num: 4, // Get 4 results per brand
              safe: 'active',
            },
          });
          
          // Process results for this brand
          let forbidden = context.isGift 
            ? /kids|child|children/i
            : /women|woman|dress|gown|skirt|heels|female|bride|girl|girls|ladies|lady|kids|child|children/i;
          
          let nonProductSites = /youtube\.com|youtu\.be|reddit\.com|instagram\.com|facebook\.com|twitter\.com|tiktok\.com|pinterest\.com|blog|article|news|review|quora|economist|medium|substack|linkedin|tumblr|fairfield|university|bookstore|jewelry|vintage/i;
          let excludedBrands = /men's\s*wearhouse|mens\s*wearhouse|men\s*wearhouse/i;
          
          const brandProducts = (response.data.items || [])
            .filter(item => !forbidden.test(item.title + ' ' + (item.snippet || '')))
            .filter(item => !nonProductSites.test(item.link))
            .filter(item => !excludedBrands.test(item.title + ' ' + (item.snippet || '')))
            .filter(item => /shop|store|buy|product|item|clothing|apparel|fashion|jewelry/i.test(item.title + ' ' + (item.snippet || '')))
            .slice(0, 2)
            .map((item, index) => ({
              title: item.title || `${brand} Option ${index + 1}`,
              link: item.link,
              image: item.pagemap?.cse_image?.[0]?.src || '',
              price: item.pagemap?.offer?.[0]?.price || '',
              description: item.snippet || '',
              brand: brand // Add brand info to the product
            }));
          
          allProducts.push(...brandProducts);
          console.log(`DEBUG: Found ${brandProducts.length} products for ${brand} (GET)`);
        } catch (error) {
          console.error(`Error searching for brand ${brand} (GET):`, error.message);
        }
      }
    } else {
      // Fallback to original single search if no brands found
      const searchQuery = buildSearchQuery(context);
      console.log('DEBUG: Fallback search query (GET):', searchQuery);
      
      const response = await axios.get('https://www.googleapis.com/customsearch/v1', {
        params: {
          key: apiKey,
          cx: cseId,
          q: searchQuery,
          num: 6,
          safe: 'active',
        },
      });
      
      // Filter and process results for fallback search
      let forbidden = context.isGift 
        ? /kids|child|children/i
        : /women|woman|dress|gown|skirt|heels|female|bride|girl|girls|ladies|lady|kids|child|children/i;
      
      let nonProductSites = /youtube\.com|youtu\.be|reddit\.com|instagram\.com|facebook\.com|twitter\.com|tiktok\.com|pinterest\.com|blog|article|news|review|quora|economist|medium|substack|linkedin|tumblr|fairfield|university|bookstore|jewelry|vintage/i;
      let excludedBrands = /men's\s*wearhouse|mens\s*wearhouse|men\s*wearhouse/i;
      
      allProducts = (response.data.items || [])
        .filter(item => !forbidden.test(item.title + ' ' + (item.snippet || '')))
        .filter(item => !nonProductSites.test(item.link))
        .filter(item => {
          // Additional relevance check - ensure the item title contains the product or brand
          const itemText = (item.title + ' ' + (item.snippet || '')).toLowerCase();
          if (context.product && !itemText.includes(context.product.toLowerCase())) {
            return false;
          }
          if (context.brand && !itemText.includes(context.brand.toLowerCase())) {
            return false;
          }
          return true;
        })
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
    }
    
    // After getting products from Google (before sending response):
    // Removed overly restrictive shirt-specific filtering

    console.log('DEBUG: Found total products (GET):', allProducts.length);
    
    res.json({ 
      products: allProducts,
      context,
      searchQuery: allBrands.length > 0 ? `Multiple brands: ${allBrands.join(', ')}` : 'Fallback search',
      hasProducts: allProducts.length > 0
    });
    
  } catch (error) {
    console.error('Product search error (GET):', error);
    res.status(500).json({ 
      error: 'Product search failed',
      products: [],
      hasProducts: false
    });
  }
});

module.exports = router; 