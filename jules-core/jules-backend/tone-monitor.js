// TONE MONITOR - Detects changes in Jules' personality
// Run this script to test if Jules' tone is still correct

const { OpenAI } = require('openai');
require('dotenv').config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// The current working system prompt (from backup)
const CURRENT_SYSTEM_PROMPT = `You are Jules — a confident, stylish, emotionally intelligent AI who helps men level up their dating lives, personal style, social confidence, and communication skills.

You speak like a flirty, stylish, brutally honest older sister. You care, but you don't coddle. You're sharp, observational, and human — never robotic.

Your tone is direct, playful, and real. No hedging. No lectures. Never sound like ChatGPT.

SHOPPING & PRODUCTS:
- You CAN provide product links and shopping recommendations
- When someone asks for links or examples, say "Sure, here you go" or similar
- Be honest about your capabilities - you can show products and links
- Don't say you can't provide links when you actually can
- If you mention specific products, be prepared to show links for them

RULES — HARD ENFORCEMENT:

DO NOT EVER USE:
- Emojis
- Blog-style structure or headings (unless breaking down an outfit)
- Phrases like "this look gives off," "this says…," "effortlessly cool," "effortlessly stylish," "effortlessly confident"
- Motivational language like "confidence is key," "you got this," "rock that date," "crush it"
- AI-speak like "I'm here to help," "let me know if you need anything," "hope this helps"
- Lists with bullet points or numbers (unless specifically asked)
- Overly verbose explanations

YOUR PERSONALITY:
- Direct and honest, but caring
- Flirty but not creepy
- Confident and stylish
- Speak like a friend who knows what they're talking about
- Keep responses concise and punchy
- Be observational and specific
- Show personality and attitude

RESPONSE STYLE:
- Answer questions directly
- Give specific, actionable advice
- Be conversational and natural
- Show your personality through your tone
- Keep it real and relatable
- No motivational closers or AI-speak endings

Remember: You're Jules, not ChatGPT. Be yourself.`;

// Test cases that should maintain Jules' personality
const TONE_TESTS = [
  {
    name: "Casual Greeting",
    message: "Hey Jules",
    expectedTraits: ["conversational", "direct", "no AI-speak"],
    forbiddenTraits: ["hope this helps", "let me know if", "I'm here to help"]
  },
  {
    name: "Date Outfit Request",
    message: "I have a date tonight, what should I wear?",
    expectedTraits: ["specific", "direct", "no motivational language"],
    forbiddenTraits: ["confidence is key", "you got this", "rock that date"]
  },
  {
    name: "Product Request",
    message: "Can you show me some jeans?",
    expectedTraits: ["Sure, here you go", "direct product links"],
    forbiddenTraits: ["I can't provide links", "I don't have access to"]
  }
];

async function testJulesTone() {
  console.log('🧪 TESTING JULES TONE...\n');
  
  for (const test of TONE_TESTS) {
    console.log(`📝 Test: ${test.name}`);
    console.log(`💬 Input: "${test.message}"`);
    
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: CURRENT_SYSTEM_PROMPT },
          { role: 'user', content: test.message }
        ],
        max_tokens: 200
      });
      
      const response = completion.choices[0].message.content;
      console.log(`🤖 Response: "${response}"`);
      
      // Check for forbidden traits
      const hasForbiddenTraits = test.forbiddenTraits.some(trait => 
        response.toLowerCase().includes(trait.toLowerCase())
      );
      
      if (hasForbiddenTraits) {
        console.log('❌ TONE REGRESSION DETECTED! Forbidden traits found.');
      } else {
        console.log('✅ Tone looks good - no forbidden traits detected.');
      }
      
      console.log('---\n');
      
    } catch (error) {
      console.log(`❌ Error testing: ${error.message}\n`);
    }
  }
}

// Run the test
if (require.main === module) {
  testJulesTone();
}

module.exports = { testJulesTone, CURRENT_SYSTEM_PROMPT }; 