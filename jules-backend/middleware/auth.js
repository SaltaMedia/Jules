const jwt = require('jsonwebtoken');

// Get JWT secret lazily to avoid startup issues
function getJWTSecret() {
  return process.env.JWT_SECRET || 'supersecretkey';
}

module.exports = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided.' });
  }
  
  try {
    const decoded = jwt.verify(token, getJWTSecret());
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token.' });
  }
}; 