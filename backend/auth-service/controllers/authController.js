const db = require('../config/database');
const { hashPassword, comparePassword, generateToken, generateId } = require('../utils/auth');
const speakeasy = require('speakeasy');

// Register new user
const register = (req, res) => {
  const { email, username, password, full_name } = req.body;

  // Validation
  if (!email || !username || !password) {
    return res.status(400).json({ error: 'Email, username, and password are required' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const userId = generateId();

  hashPassword(password).then((hashedPassword) => {
    const query = `
      INSERT INTO users (id, email, username, password_hash, full_name)
      VALUES ($1, $2, $3, $4, $5)
    `;

    db.run(query, [userId, email.toLowerCase(), username, hashedPassword, full_name || null], function (err) {
      if (err) {
        console.error('Registration error:', err.message);
        if (err.message.includes('UNIQUE')) {
          return res.status(409).json({ error: 'Email or username already exists' });
        }
        return res.status(500).json({ error: 'Database error', details: err.message });
      }

      const token = generateToken(userId);
      res.status(201).json({
        message: 'User registered successfully',
        user: { id: userId, email, username, full_name },
        token,
      });
    });
  }).catch((err) => {
    res.status(500).json({ error: 'Error hashing password' });
  });
};

// Login user
const login = (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const query = 'SELECT * FROM users WHERE email = $1';

  db.get(query, [email.toLowerCase()], async (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    try {
      const passwordMatch = await comparePassword(password, user.password_hash);

      if (!passwordMatch) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      // Check if 2FA is enabled
      if (user.is_2fa_enabled) {
        // Return a temporary token for 2FA verification
        const tempToken = generateToken(user.id + '_2fa_pending');
        return res.json({
          message: '2FA required',
          requires_2fa: true,
          temp_token: tempToken,
          user_id: user.id,
        });
      }

      const token = generateToken(user.id);
      res.json({
        message: 'Login successful',
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          full_name: user.full_name,
          avatar_url: user.avatar_url,
        },
        token,
      });
    } catch (err) {
      res.status(500).json({ error: 'Error during login' });
    }
  });
};

// Get current user (me endpoint)
const getMe = (req, res) => {
  const userId = req.user.userId;

  const query = 'SELECT id, email, username, full_name, avatar_url, bio, is_2fa_enabled, created_at, updated_at FROM users WHERE id = $1';

  db.get(query, [userId], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  });
};

// Logout (for session-based)
const logout = (req, res) => {
  const userId = req.user.userId;
  const token = req.headers.authorization?.split(' ')[1];

  if (token) {
    const query = 'DELETE FROM sessions WHERE user_id = $1 AND token = $2';
      db.run(query, [userId, token], (err) => {
      if (err) console.error(err);
    });
  }

  res.json({ message: 'Logout successful' });
};

// Verify 2FA during login
const verify2FALogin = (req, res) => {
  const { user_id, code } = req.body;

  if (!user_id || !code) {
    return res.status(400).json({ error: 'User ID and code are required' });
  }

  const query = 'SELECT two_fa_secret, email, username, full_name, avatar_url FROM users WHERE id = $1 AND is_2fa_enabled = true';

  db.get(query, [user_id], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    if (!user || !user.two_fa_secret) {
      return res.status(404).json({ error: '2FA not enabled for this user' });
    }

    // Verify TOTP token
    const verified = speakeasy.totp.verify({
      secret: user.two_fa_secret,
      encoding: 'base32',
      token: code,
      window: 2,
    });

    if (!verified) {
      return res.status(401).json({ error: 'Invalid or expired 2FA code' });
    }

    // Generate token after successful 2FA
    const token = generateToken(user_id);
    res.json({
      message: 'Login successful',
      user: {
        id: user_id,
        email: user.email,
        username: user.username,
        full_name: user.full_name,
        avatar_url: user.avatar_url,
      },
      token,
    });
  });
};

// Verify token (for other services) - Internal API
const verifyTokenForServices = (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ valid: false, error: 'Token is required' });
  }

  const { verifyToken } = require('../utils/auth');
  const decoded = verifyToken(token);

  if (!decoded) {
    return res.status(401).json({ valid: false, error: 'Invalid or expired token' });
  }

  // Get user info
  const query = 'SELECT id, email, username, full_name, avatar_url FROM users WHERE id = $1';
  db.get(query, [decoded.userId], (err, user) => {
    if (err) {
      return res.status(500).json({ valid: false, error: 'Database error' });
    }

    if (!user) {
      return res.status(404).json({ valid: false, error: 'User not found' });
    }

    res.json({
      valid: true,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        full_name: user.full_name,
        avatar_url: user.avatar_url,
      },
    });
  });
};

// Get user by ID (for other services) - Internal API
const getUserById = (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  const query = 'SELECT id, email, username, full_name, avatar_url, bio, created_at FROM users WHERE id = $1';
  db.get(query, [id], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  });
};

module.exports = {
  register,
  login,
  getMe,
  logout,
  verify2FALogin,
  verifyTokenForServices,
  getUserById,
};
