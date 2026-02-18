const { verifyToken } = require('../utils/auth'); // so its like include in c? we take the verify token from auth and use but why const?

// Verify JWT token middleware
const authMiddleware = (req, res, next) => { //authmidel is a function that takes req res and next as parameters?
  const authHeader = req.headers.authorization; //didnt understad

  if (!authHeader || !authHeader.startsWith('Bearer ')) //if the token is empythin or does not start with bearer then we return 401
  {
    return res.status(401).json({ error: 'Authorization token required' }); //whats json iand status
  }

  const token = authHeader.split(' ')[1]; //how they know how to split and why 1
  const decoded = verifyToken(token); //this is decoded token and we evetify token

  if (!decoded)
  {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  req.user = decoded; //didnt undestand
  next(); //how it know to go to next function and what is next function
};

module.exports = authMiddleware; //for exporting the function to be used in other files like authRoutes.js where we use it as a middleware for protected routes
