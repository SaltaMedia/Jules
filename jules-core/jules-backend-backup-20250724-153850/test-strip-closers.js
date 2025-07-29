// TEST STRIP CLOSERS FUNCTION
// Tests the stripClosers function to ensure it's not being too aggressive

// Copy the stripClosers function from chatController.js
function stripClosers(text) {
  if (!text) return text;
  
  // List of AI closers to remove from the end
  const aiClosers = [
    "You're all set",
    "You got this",
    "Rock it with confidence",
    "Need more tips?",
    "Let me know if",
    "Just ask",
    "Just let me know",
    "Just shoot",
    "Just hit me up",
    "Let's chat",
    "Rock that date",
    "Nailed it",
    "You're good to go",
    "Ready to impress",
    "Hope that helps",
    "I'm here to help"
  ];
  
  let cleanedText = text.trim();
  
  // Remove AI closers from the end, one by one
  for (const closer of aiClosers) {
    const regex = new RegExp(`\\s*${closer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i');
    cleanedText = cleanedText.replace(regex, '');
  }
  
  return cleanedText.trim();
}

// Test cases
const testCases = [
  {
    name: "Normal response (should not change)",
    input: "Hey there! Dark jeans, white tee, clean sneakers. You'll look sharp.",
    expected: "Hey there! Dark jeans, white tee, clean sneakers. You'll look sharp."
  },
  {
    name: "Response with AI closer (should remove closer)",
    input: "Hey there! Dark jeans, white tee, clean sneakers. Hope that helps!",
    expected: "Hey there! Dark jeans, white tee, clean sneakers."
  },
  {
    name: "Response with multiple AI closers (should remove all)",
    input: "Hey there! Dark jeans, white tee, clean sneakers. Hope that helps! Let me know if you need anything!",
    expected: "Hey there! Dark jeans, white tee, clean sneakers."
  },
  {
    name: "Response with 'hope that helps' in middle (should not change)",
    input: "Hey there! I hope that helps you understand. Dark jeans, white tee, clean sneakers.",
    expected: "Hey there! I hope that helps you understand. Dark jeans, white tee, clean sneakers."
  },
  {
    name: "Empty response",
    input: "",
    expected: ""
  },
  {
    name: "Response with only AI closer",
    input: "Hope that helps!",
    expected: ""
  }
];

function testStripClosers() {
  console.log('🧪 TESTING STRIP CLOSERS FUNCTION...\n');
  
  let passed = 0;
  let failed = 0;
  
  for (const testCase of testCases) {
    console.log(`📝 Test: ${testCase.name}`);
    console.log(`💬 Input: "${testCase.input}"`);
    
    const result = stripClosers(testCase.input);
    console.log(`🤖 Output: "${result}"`);
    
    if (result === testCase.expected) {
      console.log('✅ PASSED');
      passed++;
    } else {
      console.log('❌ FAILED');
      console.log(`Expected: "${testCase.expected}"`);
      failed++;
    }
    
    console.log('---\n');
  }
  
  console.log(`📊 RESULTS: ${passed} passed, ${failed} failed`);
  
  if (failed === 0) {
    console.log('🎉 All tests passed! stripClosers function is working correctly.');
  } else {
    console.log('⚠️  Some tests failed. stripClosers function may need adjustment.');
  }
}

// Run the test
testStripClosers(); 