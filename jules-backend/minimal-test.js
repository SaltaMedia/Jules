const express = require('express');
const { OpenAI } = require('openai');
require('dotenv').config();

const app = express();
app.use(express.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Minimal chat endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { message, userId } = req.body;
    console.log('DEBUG: Minimal test - received message:', message, 'userId:', userId);
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'You are Jules, a helpful assistant.' },
        { role: 'user', content: message }
      ],
      max_tokens: 100
    });
    
    const reply = completion.choices[0].message.content;
    console.log('DEBUG: Minimal test - got response:', reply);
    console.log('DEBUG: Minimal test - about to send response');
    
    res.json({ reply });
    
    console.log('DEBUG: Minimal test - response sent successfully');
  } catch (error) {
    console.error('DEBUG: Minimal test - error:', error);
    res.status(500).json({ error: 'Error processing chat.' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = 4000;

// Add error handlers
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', reason);
});

app.listen(PORT, () => {
  console.log(`Minimal test server running on port ${PORT}`);
  console.log('Try sending a POST request to http://localhost:4000/api/chat');
}); 