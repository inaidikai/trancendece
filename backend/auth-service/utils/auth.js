const bcrypt = require('bcryptjs'); //importing bcryptjs library for hashing and comparing passwords
const jwt = require('jsonwebtoken'); //importing jsonwebtoken library for generating and verifying JWT tokens
const { v4: uuidv4 } = require('uuid'); //whats this line

const JWT_SECRET = process.env.JWT_SECRET || 'fallback'; //what is process.env
const JWT_EXPIRE = process.env.JWT_EXPIRE || '7d';

// Hash password
const hashPassword = async (password) => { //whats asynsc  and password  from where
  const salt = await bcrypt.genSalt(10); //what is await and is genSalt a function from bcrypt and what does 10 mean
  return bcrypt.hash(password, salt); //whats hppng here 
};

// Compare password
const comparePassword = async (password, hash) => { //we camping the currecnt passwored with hashed?, but wont it salt first?
  return bcrypt.compare(password, hash);
};

// Generate JWT token
const generateToken = (userId) => { //what is userID
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRE }); //what is jwt.sign and what are the parameters we are passing here
};

// Verify JWT token
const verifyToken = (token) => { //EXPLAIN this line and how it works
  try 
  {
    return jwt.verify(token, JWT_SECRET); //expl
  } 
  catch (err) 
  {
    return null;
  }
};

// Generate random ID
const generateId = () => { //explain this fucntion
  return uuidv4();
};

const validatePasswordPolicy = (password) => {
  const value = String(password || ''); //expla
  const errors = []; //expl

  if (value.length < 8) errors.push('Be at least 8 characters');
  if (!/[A-Z]/.test(value)) errors.push('Have at least 1 uppercase letter (A-Z)'); //what is test and push 
  if (!/[a-z]/.test(value)) errors.push('Have at least 1 lowercase letter (a-z)');
  if (!/[0-9]/.test(value)) errors.push('Have at least 1 number (0-9)');
  if (!/[!@#$%^&*()_+\-=[\]{};:'",.<>/?\\|`~]/.test(value)) {
    errors.push('Have at least 1 special character (!@#$%^&*()_+-=[]{}etc)');
  }

  return { valid: errors.length === 0, errors }; //cant underta
};

module.exports = {
  hashPassword,
  comparePassword,
  generateToken,
  verifyToken,
  generateId,
  validatePasswordPolicy,
};
