const express = require('express');
const app = express();

app.use(express.json());

// Simple test endpoint
app.post('/api/test', (req, res) => {
  console.log('Test endpoint called');
  res.json({ message: 'Test successful' });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = 4001;

app.listen(PORT, () => {
  console.log(`Test server running on port ${PORT}`);
  console.log('Try sending a POST request to http://localhost:4001/api/test');
});

// Add error handlers
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', reason);
}); 