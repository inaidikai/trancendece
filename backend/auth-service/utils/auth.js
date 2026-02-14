const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-super-secret-change-me';
const JWT_EXPIRE = process.env.JWT_EXPIRE || '7d';

// Hash password
const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

// Compare password
const comparePassword = async (password, hash) => {
  return bcrypt.compare(password, hash);
};

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRE });
};

// Verify JWT token
const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
};

// Generate random ID
const generateId = () => {
  return uuidv4();
};

const validatePasswordPolicy = (password) => {
  const value = String(password || '');
  const errors = [];

  if (value.length < 8) errors.push('Be at least 8 characters');
  if (!/[A-Z]/.test(value)) errors.push('Have at least 1 uppercase letter (A-Z)');
  if (!/[a-z]/.test(value)) errors.push('Have at least 1 lowercase letter (a-z)');
  if (!/[0-9]/.test(value)) errors.push('Have at least 1 number (0-9)');
  if (!/[!@#$%^&*()_+\-=[\]{};:'",.<>/?\\|`~]/.test(value)) {
    errors.push('Have at least 1 special character (!@#$%^&*()_+-=[]{}etc)');
  }

  return { valid: errors.length === 0, errors };
};

module.exports = {
  hashPassword,
  comparePassword,
  generateToken,
  verifyToken,
  generateId,
  validatePasswordPolicy,
};
