// DEBUG STRIP CLOSERS FUNCTION
// Debug why the stripClosers function isn't working

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
  console.log(`Original: "${cleanedText}"`);
  
  // Remove AI closers from the end, one by one
  for (const closer of aiClosers) {
    const escapedCloser = closer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\s*${escapedCloser}[.!?]*\\s*$`, 'i');
    console.log(`Checking for: "${closer}"`);
    console.log(`Regex: ${regex}`);
    console.log(`Before: "${cleanedText}"`);
    
    if (regex.test(cleanedText)) {
      console.log(`MATCH FOUND!`);
      cleanedText = cleanedText.replace(regex, '');
      console.log(`After: "${cleanedText}"`);
    } else {
      console.log(`No match`);
    }
    console.log('---');
  }
  
  return cleanedText.trim();
}

// Test with a simple case
const testText = "Hey there! Dark jeans, white tee, clean sneakers. Hope that helps!";
console.log('🧪 DEBUGGING STRIP CLOSERS...\n');
const result = stripClosers(testText);
console.log(`\n🎯 FINAL RESULT: "${result}"`); 