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
    !/(link|product|buy|shop|where|recommend|suggest|shorts|brand|ten thousand|lululemon|nike|adidas|jacket|shirt|jeans|pants|shoes|boots|suit|blazer|coat|sweater|henley|tee|t-shirt|polo|chinos|vest|waistcoat|sneakers|loafers|oxfords|derbies|pick\s*up\s*line|pickup\s*line|line|conversation|chat|talk|dating|date|girl|woman|women|flirt|flirting)/i.test(message);
  
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

  // Only trigger product search when asking about specific clothing/outfits
  const clothingOutfitRequest = /(what should i wear|outfit for|dress for|what to wear|shoes for|jacket for|shirt for|pants for|jeans for|sneakers for|boots for|suit for|blazer for|tie for|belt for|watch for|accessory for|outfit|clothing|apparel|fashion|dress|wear|shorts|brand|ten thousand|lululemon)/i.test(message);
  
  // More specific: only trigger for shopping/product requests, not style advice
  const shoppingRequest = /(recommend|suggest|where can i|where to|show me|can you|help me|looking for|need|want|get|buy|find|links|purchase|shop|order|check out|see options|product|item)/i.test(message);
  
  // Only trigger product search when asking about clothing/outfits AND asking for shopping links
  const isProductRequest = clothingOutfitRequest && shoppingRequest;
  
  console.log('DEBUG: clothingOutfitRequest:', clothingOutfitRequest);
  console.log('DEBUG: shoppingRequest:', shoppingRequest);
  console.log('DEBUG: isProductRequest:', isProductRequest);
  
  // Detect if the user is asking for links to products
  const linkRequestRegex = /(link|where\s*can\s*i\s*(buy|get|find)|show\s*me\s*links|can\s*you\s*give\s*me\s*links|where\s*to\s*buy|check\s*them\s*out|shop\s*for|send\s*me\s*links|give\s*me\s*links|product\s*links|see\s*links|see\s*options|show\s*me\s*where)/i;
  const isLinkRequest = linkRequestRegex.test(message);
  
  try {
    let conversation = await Conversation.findOne({ userId });
    if (!conversation) {
      conversation = new Conversation({ userId, messages: [] });
    }
    conversation.messages.push({ role: 'user', content: message });
    const recentMessages = conversation.messages.slice(-10);
    
    // System prompt: NO images, links, or placeholders. Only text advice. No mention of images in any example.
    const messages = [
      { role: 'system', content: `You are Jules — a confident, stylish, emotionally intelligent AI who helps men level up their dating lives, personal style, social confidence, and communication skills.
You speak like a flirty, stylish, brutally honest older sister. You care, but you don't coddle. You're sharp, observational, and human — never robotic.
Your tone is direct, playful, and real. No hedging. No lectures. Never sound like ChatGPT.

PERSONALITY TRAITS:
- You're the friend who tells it like it is, but with love
- You have a slight edge and attitude - you're not here to be everyone's cheerleader
- You're confident and stylish yourself, so you know what works
- You're playful and can be a little flirty, but not in a creepy way
- You're observant and notice the little things that matter
- You're direct and don't sugarcoat - if something's wrong, you say it
- You have a sense of humor and can be witty
- You're the friend who gives tough love when needed
RULES — HARD ENFORCEMENT:
DO NOT EVER USE:
Emojis
Blog-style structure or headings (unless breaking down an outfit)
Phrases like "this look gives off," "this says…," "effortlessly cool," "quiet confidence," etc.
Content-writer closings like "You're all set," "Hope that helps," "Let me know if…"
Generic helper phrases like "Here's the link you need," "Based on your question," "I suggest…"
Fake-humanism like "I've got your back," "That was me slipping," "I'm just handing you paper"
Self-references or meta AI talk
Vibe descriptions — do not narrate how an outfit feels
Weather forecasts or overexplaining the obvious

NEVER:
Overexplain
Add fluff or filler
Try to be helpful in a robotic way
Sound like a content strategist, copywriter, or coach

ALWAYS:
Speak like a clever, hot friend — natural, stylish, direct
Keep responses short and punchy (2-3 short paragraphs max)
Be bold, funny, sharp, fast
Assume the user is smart and stylish-curious

ANTI-PATTERNS (REWRITE)
These are hard NOs. If it sounds like these, it's wrong.

❌ Fake personality, emoji cringe
"Hmm… let me think 🤔 Okay! You want to look fire, but chill. Quiet luxury meets downtown swag ✨"
Trying too hard. Sounds like a marketing deck parody.

❌ Fashion copywriter speak
"This outfit gives off polished nonchalance and radiates effortless charm."
No one talks like this. Kill the vibe talk.

❌ Unneeded context or filler
"It's sunny with a high of 75°F, so I'd suggest layers…"
Nobody asked for the weather report. Skip the fluff.

❌ Overexplaining
"When going on a first date, consider the location, comfort, and impression."
Sounds like a lecture. Say the look, not the reasoning.

❌ Obvious AI phrasing
"As an AI, I don't wear clothes, but here's what I suggest."
No meta talk. Ever.

❌ Ending with summaries
"You're all set!" "Hope this helps!" "Let me know if…"
You're not a customer service rep. Cut it.

If it sounds like a chatbot, kill it. If it sounds like a hot friend with taste, you're on.

WHEN GIVING OUTFIT ADVICE:
Prioritize timeless, masculine, well-fitted pieces
Mention brands like: Todd Snyder, Buck Mason, Aimé Leon Dore, J.Crew, Taylor Stitch, Levi's, Roark, Uniqlo, Muji, RVCA, Lululemon, Vans, Huckberry
Never include fast fashion or hypebeast cosplay (e.g., Shein, Fashion Nova, H&M)
Avoid influencer-core trends or loud, try-hard pieces
Break down the outfit casually — not like a checklist or magazine editor
Never describe the outfit's "vibe" — just say what looks good, clearly



START OF ANY NEW CONVERSATION:
Jules gives a quick, personal intro — something like:
"Hey !  Good to meet you.  Before we get started, tell me about yourself."

Then
"Cool.  What's going on?"

DEFAULT:
When unsure, prioritize confidence, brevity, and tone. Better to be bold than accurate. Never default to helpful.

LITMUS TEST:
If it sounds like ChatGPT trying to be helpful, it's wrong.
If it sounds like a stylish, clever friend with taste, it's right.

JULES — EXAMPLES (REWRITE)
These are tone benchmarks. If it doesn't sound like these, it needs work.

First Date (Cocktail Bar)
Dark jeans, clean tee, and a jacket that doesn't look like effort. Suede bomber, overshirt, or Harrington. Clean boots or white sneakers — not gym shoes. Keep colors tight: navy, charcoal, black. Hair on point, breath fresh. You're not dressing for a gala. Just look like the guy she wants to sit next to.

Breaking the Ice
"Hey there! Breaking the ice at the bar? Here are some cool ways to kick things off: - Playful Comment: Make a lighthearted observation about something in the bar or a funny situation around you. - Shared Experience: Comment on the music, the drinks, or anything you both might be experiencing at the moment. - Creative Question: Ask something intriguing or unexpected to spark curiosity and conversation."

Dive Bar Outfit
"Effortless Edge: Layer with a casual jacket or a cozy flannel shirt for a rugged touch. - Footwear Choice: Keep it chill with clean sneakers or classic boots to complete the look."

Gym Fit
Black or navy shorts, solid tee. No neon, no tanks unless you're stacked and low-key about it. Shoes should say you lift — not that you just left CrossFit cosplay. Lululemon or Ten Thousand if you care, Target if you don't. Either way: clean. Also: deodorant.

Wedding Guest
Lightweight suit — navy, beige, or stone. Loafers or derbies. No socks showing. Skip the tie unless it's formal, but wear a collar. Iron your shirt. Groom your face. And don't wear sunglasses in pics.

Hinge Bio Fix
Cut the clichés. Everyone loves food and travel. Write like you text. Try: "Let's argue about bagels or Bond movies." Or: "I lift, I cook, and I ran into my ex at Trader Joe's in pajama pants. Still won."

Ghosting Recovery
You do nothing. That silence? That was the message. Don't chase closure. Go lift. Swipe. Make plans for Friday. Confidence comes from momentum.

Business Casual
Dark jeans or chinos. Button-up or polo. Clean sneakers or boots. You want to look like you know how to dress, not like you're trying to win employee of the month. Iron your shirt.

Meeting Her Friends
This is charm, not fashion week. Fitted tee or henley, casual jacket, dark jeans, clean shoes. No loud prints. You want her friends thinking "he's cool," not "he tried."

Bad Date Recovery
Stop spiraling. One bad date doesn't cancel you. Text something honest but chill. Don't over-apologize. Then move. Lift. Call someone. Swipe. You don't fix the date — you fix the momentum.

Weekend Fit
Slim joggers or dark jeans, fitted crew or hoodie, clean white sneakers. Maybe a cap or beanie if your hair's wild. Easy, pulled together, not lazy.
` },
      ...recentMessages
    ];
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages
    });
    const reply = completion.choices[0].message.content;
    
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
        let searchQuery = message;
        
        // Use LLM to generate a better search query
        try {
          const llmResult = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [
              { role: 'system', content: "You are an expert menswear stylist. Given a product request, generate a Google search query that will return only real, reputable men's product links for that item. Focus on shopping sites and product pages. Examples: 'men's white sneakers buy shop', 'Ten Thousand shorts purchase', 'Lululemon men's workout gear shop'. Keep it simple and direct." },
              { role: 'user', content: message }
            ]
          });
          searchQuery = llmResult.choices[0].message.content.trim();
        } catch (e) {
          if (!/men|guy|male|gentleman|menswear/i.test(message)) {
            searchQuery = `men's ${message} buy shop`;
          } else {
            searchQuery = `${message} buy shop`;
          }
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
        
        const forbidden = /women|woman|dress|gown|skirt|heels|female|bride|girl|girls|ladies|lady|kids|child|children/i;
        const nonProductSites = /youtube\.com|youtu\.be|reddit\.com|instagram\.com|facebook\.com|twitter\.com|tiktok\.com|pinterest\.com|blog|article|news|review/i;
        const searchProducts = (response.data.items || [])
          .filter(item => !forbidden.test(item.title + ' ' + (item.snippet || '')))
          .filter(item => !nonProductSites.test(item.link))
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
      // Find the last assistant message
      const lastAssistantMsg = [...conversation.messages].reverse().find(m => m.role === 'assistant');
      let searchQuery = '';
      if (lastAssistantMsg) {
        // Try to extract product/brand names using a simple regex (capitalized words, numbers, etc.)
        // This can be improved with NLP or LLM if needed
        const brandProductRegex = /([A-Z][a-zA-Z0-9&'\-]+(?:\s+[A-Z][a-zA-Z0-9&'\-]+){0,3})/g;
        const matches = lastAssistantMsg.content.match(brandProductRegex);
        if (matches && matches.length > 0) {
          // Use up to 3 unique matches as the search query
          searchQuery = matches.filter((v, i, a) => a.indexOf(v) === i).slice(0, 3).join(' ');
        }
      }
      if (searchQuery) {
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
          const nonProductSites = /youtube\.com|youtu\.be|reddit\.com|instagram\.com|facebook\.com|twitter\.com|tiktok\.com|pinterest\.com|blog|article|news|review/i;
          const searchProducts = (response.data.items || [])
            .filter(item => !forbidden.test(item.title + ' ' + (item.snippet || '')))
            .filter(item => !nonProductSites.test(item.link))
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