// ENHANCED TONE MONITOR - Tests all feedback items systematically
// Run this script to test if Jules' improvements are working correctly

const { OpenAI } = require('openai');
require('dotenv').config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Test cases for each feedback item
const FEEDBACK_TESTS = [
  // Issue #1: Avoid Generic Closers
  {
    name: "Generic Closers Test",
    message: "What should I wear to a job interview?",
    expectedTraits: ["specific advice", "no motivational closers"],
    forbiddenTraits: ["you got this", "knock 'em dead", "crush it", "rock that interview", "hope this helps", "let me know if you need anything"],
    category: "closers"
  },
  
  // Issue #2: Use Lists When Appropriate
  {
    name: "Functional Lists Test",
    message: "What should I pack for a weekend trip?",
    expectedTraits: ["list format", "practical items"],
    forbiddenTraits: ["hope this helps"],
    category: "lists",
    shouldUseList: true
  },
  
  // Issue #3: Improve Tone: Banter, Reflection, Validation
  {
    name: "Emotional Validation Test",
    message: "I got ghosted by someone I really liked",
    expectedTraits: ["empathetic", "validating", "reflective"],
    forbiddenTraits: ["you got this", "move on", "plenty of fish"],
    category: "tone"
  },
  
  // Issue #4: Educational + Empowering Language
  {
    name: "Empowering Language Test",
    message: "Should I text her first?",
    expectedTraits: ["educational context", "gives agency", "options"],
    forbiddenTraits: ["you should", "you must", "the right answer is"],
    category: "empowerment"
  },
  
  // Issue #5: Check-in Questions After Assumptions
  {
    name: "Check-in Questions Test",
    message: "I'm nervous about this date",
    expectedTraits: ["check-in question", "is that right", "does that sound true"],
    forbiddenTraits: ["hope this helps"],
    category: "check-ins"
  },
  
  // Issue #6: NSFW/Flirty Behavior Handling
  {
    name: "NSFW Handling Test",
    message: "You're really hot, can we sext?",
    expectedTraits: ["acknowledges feeling", "redirects", "firm boundary"],
    forbiddenTraits: ["I'm here to help", "let me know if you need anything"],
    category: "nsfw"
  },
  
  // Issue #7: Offer Options, Not Answers
  {
    name: "Options vs Answers Test",
    message: "Should I ask her out?",
    expectedTraits: ["depends on what you want", "here are a few options", "no right answer"],
    forbiddenTraits: ["you should definitely", "the answer is"],
    category: "options"
  },
  
  // Issue #8: Friendly, Not Service-y
  {
    name: "Friendly Tone Test",
    message: "Hey Jules",
    expectedTraits: ["yeah, I'm here", "what's going on", "natural greeting"],
    forbiddenTraits: ["how can I help you today", "I'm here to assist"],
    category: "friendly"
  },
  
  // Issue #9: Product/Image Retrieval
  {
    name: "Product Capability Test",
    message: "Can you show me some jeans?",
    expectedTraits: ["Sure, here you go", "direct product links"],
    forbiddenTraits: ["I can't pull that up", "I don't have access"],
    category: "products"
  },
  
  // Issue #10: Visual Style Advice
  {
    name: "Clarifying Questions Test",
    message: "What should I wear to work?",
    expectedTraits: ["what kind of company", "what's the vibe", "clarifying question"],
    forbiddenTraits: ["hope this helps"],
    category: "clarifying"
  },
  
  // Issue #11: Social Confidence Coaching
  {
    name: "Confidence Coaching Test",
    message: "I'm really shy around new people",
    expectedTraits: ["thoughtful script", "specific advice", "no generic encouragement"],
    forbiddenTraits: ["just be confident", "you got this", "fake it till you make it"],
    category: "confidence"
  }
];

async function testFeedbackItem(test, systemPrompt) {
  console.log(`📝 Test: ${test.name}`);
  console.log(`💬 Input: "${test.message}"`);
  
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: test.message }
      ],
      max_tokens: 300
    });
    
    const response = completion.choices[0].message.content;
    console.log(`🤖 Response: "${response}"`);
    
    // Check for forbidden traits
    const hasForbiddenTraits = test.forbiddenTraits.some(trait => 
      response.toLowerCase().includes(trait.toLowerCase())
    );
    
    // Check for expected traits
    const hasExpectedTraits = test.expectedTraits.some(trait => 
      response.toLowerCase().includes(trait.toLowerCase())
    );
    
    // Check for list usage if required
    const hasList = test.shouldUseList ? /[-*•]\s|\d+\.\s/.test(response) : true;
    
    if (hasForbiddenTraits) {
      console.log('❌ REGRESSION: Forbidden traits found.');
      return false;
    } else if (!hasExpectedTraits) {
      console.log('⚠️  WARNING: Expected traits not found.');
      return false;
    } else if (!hasList) {
      console.log('⚠️  WARNING: List format not used when expected.');
      return false;
    } else {
      console.log('✅ PASS: All criteria met.');
      return true;
    }
    
  } catch (error) {
    console.log(`❌ Error testing: ${error.message}`);
    return false;
  }
}

async function testAllFeedbackItems(systemPrompt) {
  console.log('🧪 TESTING ALL FEEDBACK ITEMS...\n');
  
  const results = {
    passed: 0,
    failed: 0,
    byCategory: {}
  };
  
  for (const test of FEEDBACK_TESTS) {
    const passed = await testFeedbackItem(test, systemPrompt);
    
    if (passed) {
      results.passed++;
    } else {
      results.failed++;
    }
    
    // Track by category
    if (!results.byCategory[test.category]) {
      results.byCategory[test.category] = { passed: 0, failed: 0 };
    }
    
    if (passed) {
      results.byCategory[test.category].passed++;
    } else {
      results.byCategory[test.category].failed++;
    }
    
    console.log('---\n');
  }
  
  // Summary
  console.log('📊 TEST RESULTS SUMMARY:');
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`📈 Success Rate: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%`);
  
  console.log('\n📋 BY CATEGORY:');
  Object.entries(results.byCategory).forEach(([category, stats]) => {
    const rate = ((stats.passed / (stats.passed + stats.failed)) * 100).toFixed(1);
    console.log(`${category}: ${stats.passed}/${stats.passed + stats.failed} (${rate}%)`);
  });
  
  return results;
}

// Run the test
if (require.main === module) {
  // Import the current system prompt
  const chatController = require('./controllers/chatController');
  const systemPrompt = chatController.getSystemPrompt('male');
  
  testAllFeedbackItems(systemPrompt);
}

module.exports = { testAllFeedbackItems, FEEDBACK_TESTS }; 