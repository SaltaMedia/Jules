const axios = require('axios');

const BASE_URL = 'http://localhost:4000/api';

// Test messages for each route
const testMessages = {
  dating: "I have a second date coming up. How should I approach it?",
  practice: "Can we practice some conversation starters?",
  style: "What should I wear to a job interview?",
  conversation: "Hey, how's your day going?",
  packing: "Packing for a trip to Europe. What should I bring?",
  style_rock: "What should I rock to this party tonight?"
};

async function testRoute(route, message) {
  try {
    console.log(`\n🧪 Testing ${route.toUpperCase()} route:`);
    console.log(`📝 Message: "${message}"`);
    
    const response = await axios.post(`${BASE_URL}/${route}`, {
      message: message
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`✅ Response: "${response.data.reply}"`);
    console.log(`📏 Length: ${response.data.reply.length} characters`);
    
    // Check for common closers
    const commonClosers = [
      "You're all set",
      "Hope that helps",
      "Let me know if",
      "You got this",
      "Rock that",
      "Crush it",
      "Keep it simple, keep it stylish",
      "Now go make Europe your runway",
      "You're set",
      "You're good to go"
    ];
    
    const hasCloser = commonClosers.some(closer => 
      response.data.reply.toLowerCase().includes(closer.toLowerCase())
    );
    
    if (hasCloser) {
      console.log(`❌ WARNING: Response contains a common closer!`);
    } else {
      console.log(`✅ No common closers detected`);
    }
    
  } catch (error) {
    console.log(`❌ Error testing ${route}:`, error.response?.data || error.message);
  }
}

async function runTests() {
  console.log('🚀 Starting route tests...\n');
  
  // Wait for server to start
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Test each route
  await testRoute('dating', testMessages.dating);
  await testRoute('practice', testMessages.practice);
  await testRoute('style', testMessages.style);
  await testRoute('conversation', testMessages.conversation);
  await testRoute('style', testMessages.packing);
  await testRoute('style', testMessages.style_rock);
  
  console.log('\n🎉 All tests completed!');
}

runTests().catch(console.error); 