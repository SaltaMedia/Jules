const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey';

module.exports = (req, res, next) => {
  const host = req.headers.host || '';
  const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1');
  
  // Allow localhost requests to pass through without token
  if (isLocalhost) {
    return next();
  }
  
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'No token provided.' });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token.' });
  }
}; 