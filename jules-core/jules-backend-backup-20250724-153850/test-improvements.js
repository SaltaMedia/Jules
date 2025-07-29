// Quick test to verify improvements
require('dotenv').config();
const { OpenAI } = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Get the updated system prompt
const fs = require('fs');
const path = require('path');

// Read the chatController file to extract the system prompt
const chatControllerPath = path.join(__dirname, 'controllers', 'chatController.js');
const chatControllerContent = fs.readFileSync(chatControllerPath, 'utf8');

// Extract the system prompt using regex
const promptMatch = chatControllerContent.match(/function getSystemPrompt\(userGender = 'male'\) \{[\s\S]*?const basePrompt = `([\s\S]*?)`;[\s\S]*?return basePrompt;[\s\S]*?\}/);
if (!promptMatch) {
  console.error('Could not extract system prompt');
  process.exit(1);
}

const systemPrompt = promptMatch[1].replace(/\${userGender === 'male' \? 'men' : 'women'}/g, 'men')
                                   .replace(/\${userGender === 'male' \? 'sister' : 'brother'}/g, 'sister')
                                   .replace(/\${userGender === 'male' \? 'guys' : 'girls'}/g, 'guys');

async function testImprovements() {
  console.log('🧪 Testing Jules Improvements...\n');
  
  const testCases = [
    {
      name: "Ghosted Response Test",
      message: "i just got ghosted by someone i really liked. it sucks",
      shouldContain: ["ghosted", "sucks", "pits", "disappointing"],
      shouldNotContain: ["You've got this", "That stings", "Keep your chin up", "Hang in there"]
    },
    {
      name: "Date Outfit Clarifying Question Test", 
      message: "I need outfit advice for a date",
      shouldContain: ["where", "what kind", "vibe", "dinner", "coffee"],
      shouldNotContain: ["Absolutely, I'm here to help", "I'm here to help"]
    }
  ];

  for (const test of testCases) {
    console.log(`📝 Testing: ${test.name}`);
    console.log(`Message: "${test.message}"`);
    
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: test.message }
        ],
        max_tokens: 200
      });
      
      const reply = response.choices[0].message.content;
      console.log(`Response: "${reply}"`);
      
      // Check for required phrases
      const hasRequired = test.shouldContain.some(phrase => 
        reply.toLowerCase().includes(phrase.toLowerCase())
      );
      
      // Check for forbidden phrases
      const hasForbidden = test.shouldNotContain.some(phrase => 
        reply.toLowerCase().includes(phrase.toLowerCase())
      );
      
      if (hasRequired && !hasForbidden) {
        console.log('✅ PASSED\n');
      } else {
        console.log('❌ FAILED');
        if (!hasRequired) console.log('   Missing required phrases');
        if (hasForbidden) console.log('   Contains forbidden phrases');
        console.log('');
      }
      
    } catch (error) {
      console.log(`❌ Error: ${error.message}\n`);
    }
  }
}

if (require.main === module) {
  testImprovements();
} 