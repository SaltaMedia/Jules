require('dotenv').config();
const { OpenAI } = require('openai');
const Conversation = require('../models/Conversation');
const axios = require('axios');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Handle chat requests
exports.handleChat = async (req, res) => {
  const { message, userId } = req.body;
  if (!message || !userId) {
    return res.status(400).json({ error: 'Message and userId are required.' });
  }
  // STRONGEST possible regex for any image/example request, including complex/combined sentences
  // Matches: pic, pics, picture, pictures, image, images, visual, visuals, show me, example, examples, look like, can i see, what does it look like, outfit example(s), can you show, anything to show, any to show, any to see, see some, see any, etc.
  const imageRequestRegex = /(pic|pics|picture|pictures|image|images|visual|visuals|show\s*me|example|examples|look\s*like|can\s*i\s*see|what\s*does\s*it\s*look\s*like|outfit\s*examples?|can\s*you\s*show|anything\s*to\s*show|any\s*to\s*show|any\s*to\s*see|see\s*some|see\s*any)/i;
  if (imageRequestRegex.test(message)) {
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
  try {
    let conversation = await Conversation.findOne({ userId });
    if (!conversation) {
      conversation = new Conversation({ userId, messages: [] });
    }
    conversation.messages.push({ role: 'user', content: message });
    const recentMessages = conversation.messages.slice(-10);
    // System prompt: NO images, links, or placeholders. Only text advice. No mention of images in any example.
    const messages = [
      { role: 'system', content: `You are Jules — a confident, stylish, emotionally intelligent AI who helps men level up their dating lives, personal style, social confidence, and communication skills. Speak like a flirty, stylish, brutally honest older sister. Never use emojis. Never sound like a bot, blog, or copywriter. Always be short, punchy, and relevant. If the user asks for images, examples, or visuals, respond: "I'm not able to pull up images yet, but that's coming soon. In the meantime, I can give you some guidance." If the user asks for a specific product, you can return clickable links to products. Otherwise, only return text guidance. Never mention images, image links, or placeholders in your responses.` },
      ...recentMessages
    ];
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages
    });
    const reply = completion.choices[0].message.content;
    // Parse product Markdown links in the reply and convert to structured product objects
    let products = [];
    let cleanedReply = reply;
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
        { role: 'system', content: "You are an expert menswear stylist. Given a product request, generate a Google search query that will return only real, reputable men's product links for that item (e.g., 'men's white sneakers Todd Snyder Buck Mason'). Avoid women's fashion and fake sites. Include price and a short, punchy description if possible." },
        { role: 'user', content: query }
      ]
    });
    searchQuery = llmResult.choices[0].message.content.trim();
  } catch (e) {
    if (!/men|guy|male|gentleman|menswear/i.test(query)) {
      searchQuery = `men's ${query}`;
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
    // Try to extract product info (name, image, price, description, link)
    const products = (response.data.items || [])
      .filter(item => !forbidden.test(item.title + ' ' + (item.snippet || '')))
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