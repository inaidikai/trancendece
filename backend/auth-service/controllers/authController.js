const db = require('../config/database');
const { hashPassword, comparePassword, generateToken, generateId, verifyToken } = require('../utils/auth');
const { sendWelcomeEmail, sendTwoFAEmail } = require('../utils/emailService');

const TWO_FA_CODE_EXPIRY_MS = 10 * 60 * 1000;

const buildPending2FASubject = (userId) => `${userId}_2fa_pending`;

const isValidPending2FAToken = (userId, tempToken) => {
  if (!userId || !tempToken) return false;
  const decoded = verifyToken(tempToken);
  if (!decoded?.userId) return false;
  return String(decoded.userId) === buildPending2FASubject(userId);
};

const issueAndSendTwoFACode = (user, callback) => {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + TWO_FA_CODE_EXPIRY_MS);
  const updateQuery = 'UPDATE users SET two_fa_code = $1, two_fa_code_expires = $2 WHERE id = $3';

  db.run(updateQuery, [code, expiresAt, user.id], async (updateErr) => {
    if (updateErr) {
      callback(updateErr);
      return;
    }

    try {
      const sent = await sendTwoFAEmail(user.email, code, user.full_name || user.username);
      if (!sent) {
        callback(new Error('Failed to send 2FA code email'));
        return;
      }
      callback(null);
    } catch (emailErr) {
      callback(emailErr);
    }
  });
};

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

      // Send welcome email
      sendWelcomeEmail(email, full_name || username).catch((welcomeErr) => {
        console.error('Failed to send welcome email:', welcomeErr);
        // Don't fail registration if email fails
      });

      const token = generateToken(userId);
      res.status(201).json({
        message: 'User registered successfully',
        user: { id: userId, email, username, full_name },
        token,
      });
    });
  }).catch(() => {
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
        issueAndSendTwoFACode(user, (twoFAErr) => {
          if (twoFAErr) {
            console.error('2FA login issue:', twoFAErr);
            return res.status(500).json({ error: 'Failed to send 2FA code' });
          }

          const tempToken = generateToken(buildPending2FASubject(user.id));
          return res.json({
            message: '2FA code sent to your email',
            requires_2fa: true,
            temp_token: tempToken,
            user_id: user.id,
          });
        });
        return;
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
    } catch {
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
  const { user_id, code, temp_token, tempToken } = req.body;
  const pendingToken = temp_token || tempToken;

  if (!user_id || !code || !pendingToken) {
    return res.status(400).json({ error: 'User ID, code, and temp token are required' });
  }

  if (!isValidPending2FAToken(user_id, pendingToken)) {
    return res.status(401).json({ error: 'Invalid 2FA session. Please login again.' });
  }

  const query = 'SELECT two_fa_code, two_fa_code_expires, email, username, full_name, avatar_url FROM users WHERE id = $1 AND is_2fa_enabled = true';

  db.get(query, [user_id], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    if (!user) {
      return res.status(404).json({ error: '2FA not enabled for this user' });
    }

    // Check if code exists and is not expired
    if (!user.two_fa_code || !user.two_fa_code_expires) {
      return res.status(400).json({ error: 'No 2FA code found. Please login again.' });
    }

    if (new Date() > new Date(user.two_fa_code_expires)) {
      return res.status(400).json({ error: '2FA code has expired. Please login again.' });
    }

    // Verify code matches
    if (String(code) !== String(user.two_fa_code)) {
      return res.status(401).json({ error: 'Invalid 2FA code' });
    }

    // Clear the code after successful verification
    const clearQuery = 'UPDATE users SET two_fa_code = NULL, two_fa_code_expires = NULL WHERE id = $1';
    db.run(clearQuery, [user_id], (clearErr) => {
      if (clearErr) console.error('Error clearing 2FA code:', clearErr);
    });

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

// Resend 2FA code during login challenge
const resend2FALogin = (req, res) => {
  const { user_id, temp_token, tempToken } = req.body;
  const pendingToken = temp_token || tempToken;

  if (!user_id || !pendingToken) {
    return res.status(400).json({ error: 'User ID and temp token are required' });
  }

  if (!isValidPending2FAToken(user_id, pendingToken)) {
    return res.status(401).json({ error: 'Invalid 2FA session. Please login again.' });
  }

  const query = 'SELECT id, email, username, full_name, is_2fa_enabled FROM users WHERE id = $1';
  db.get(query, [user_id], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    if (!user || !user.is_2fa_enabled) {
      return res.status(404).json({ error: '2FA not enabled for this user' });
    }

    issueAndSendTwoFACode(user, (twoFAErr) => {
      if (twoFAErr) {
        console.error('Resend 2FA issue:', twoFAErr);
        return res.status(500).json({ error: 'Failed to resend 2FA code' });
      }

      res.json({ message: '2FA code resent to your email' });
    });
  });
};

// Verify token (for other services) - Internal API
const verifyTokenForServices = (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ valid: false, error: 'Token is required' });
  }

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
  resend2FALogin,
  verifyTokenForServices,
  getUserById,
};
