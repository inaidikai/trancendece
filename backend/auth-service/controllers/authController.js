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

// ==================== GOOGLE OAUTH FUNCTIONS ====================

/**
 * Initiates Google OAuth flow - returns Google authorization URL
 * Frontend redirects user to this URL
 */
const googleAuthInit = (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:8081/auth/google/callback';
  
  if (!clientId) {
    return res.status(500).json({ error: 'Google OAuth not configured' });
  }

  // Generate state token for CSRF protection
  const crypto = require('crypto');
  const state = crypto.randomBytes(32).toString('hex');
  
  // Store state in session/cache (you can use Redis or memory cache)
  // For now, we'll return it to frontend to send back
  const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  googleAuthUrl.searchParams.append('client_id', clientId);
  googleAuthUrl.searchParams.append('redirect_uri', redirectUri);
  googleAuthUrl.searchParams.append('response_type', 'code');
  googleAuthUrl.searchParams.append('scope', 'openid email profile');
  googleAuthUrl.searchParams.append('state', state);
  googleAuthUrl.searchParams.append('access_type', 'offline');
  googleAuthUrl.searchParams.append('prompt', 'consent');

  res.json({
    message: 'Google OAuth URL generated',
    authUrl: googleAuthUrl.toString(),
    state: state
  });
};

/**
 * Google OAuth callback - exchanges authorization code for user info
 * Called after user grants permission on Google's servers
 */
const googleAuthCallback = async (req, res) => {
  const { code, state } = req.body;
  
  if (!code || !state) {
    return res.status(400).json({ error: 'Missing code or state parameter' });
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:8081/auth/google/callback';

  if (!clientId || !clientSecret) {
    return res.status(500).json({ error: 'Google OAuth not configured' });
  }

  try {
    const axios = require('axios');

    // Step 1: Exchange authorization code for tokens
    const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
      client_id: clientId,
      client_secret: clientSecret,
      code: code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri
    });

    const { access_token, id_token } = tokenResponse.data;

    // Step 2: Get user info from Google
    const userInfoResponse = await axios.get('https://www.googleapis.com/oauth2/v1/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` }
    });

    const googleUser = userInfoResponse.data;
    const { email, name, picture, sub: googleId } = googleUser;

    if (!email) {
      return res.status(400).json({ error: 'Unable to retrieve email from Google' });
    }

    // Step 3: Check if user exists in our database
    const query = 'SELECT * FROM users WHERE email = $1 OR google_id = $2';
    db.get(query, [email.toLowerCase(), googleId], async (err, user) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      // Step 4a: User exists - update OAuth info and login
      if (user) {
        // Update Google OAuth info
        const updateQuery = `
          UPDATE users 
          SET google_id = $1, oauth_provider = 'google', updated_at = NOW()
          WHERE id = $2
        `;
        db.run(updateQuery, [googleId, user.id], (updateErr) => {
          if (updateErr) {
            console.error('Update error:', updateErr.message);
            return res.status(500).json({ error: 'Database error during update' });
          }

          // Generate JWT token
          const token = generateToken(user.id);
          res.json({
            message: 'Login successful via Google',
            user: {
              id: user.id,
              email: user.email,
              username: user.username,
              full_name: user.full_name,
              avatar_url: user.avatar_url || picture,
            },
            token,
            isNewUser: false
          });
        });
        return;
      }

      // Step 4b: New user - create account
      const userId = generateId();
      const username = email.split('@')[0] + '_' + Math.random().toString(36).substr(2, 5);

      const insertQuery = `
        INSERT INTO users (id, email, username, full_name, avatar_url, google_id, oauth_provider, password_hash, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      `;

      // Google OAuth users don't have passwords initially
      db.run(insertQuery, [userId, email.toLowerCase(), username, name, picture, googleId, 'google', null], (insertErr) => {
        if (insertErr) {
          console.error('Insert error:', insertErr.message);
          if (insertErr.message.includes('UNIQUE')) {
            return res.status(409).json({ error: 'Email or username already exists' });
          }
          return res.status(500).json({ error: 'Database error during user creation' });
        }

        // Generate JWT token
        const token = generateToken(userId);
        res.status(201).json({
          message: 'User created and logged in successfully via Google',
          user: {
            id: userId,
            email: email.toLowerCase(),
            username: username,
            full_name: name,
            avatar_url: picture,
          },
          token,
          isNewUser: true
        });
      });
    });

  } catch (error) {
    console.error('Google OAuth error:', error.message);
    res.status(500).json({ 
      error: 'Google authentication failed',
      details: error.message 
    });
  }
};

/**
 * Google OAuth redirect handler (GET)
 * Redirects browser to frontend callback route with code/state
 */
const googleAuthRedirect = (req, res) => {
  const { code, state } = req.query || {};
  const frontendBase = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/+$/, '');
  const redirectUrl = new URL('/auth/google/callback', frontendBase);

  if (code) redirectUrl.searchParams.set('code', code);
  if (state) redirectUrl.searchParams.set('state', state);

  return res.redirect(redirectUrl.toString());
};

/**
 * Link Google account to existing user
 * For authenticated users wanting to add Google login
 */
const linkGoogleAccount = (req, res) => {
  const userId = req.user.userId;
  const { googleId } = req.body;

  if (!googleId) {
    return res.status(400).json({ error: 'Google ID is required' });
  }

  const query = `
    UPDATE users 
    SET google_id = $1, oauth_provider = 'google'
    WHERE id = $2
  `;

  db.run(query, [googleId, userId], (err) => {
    if (err) {
      console.error('Link error:', err.message);
      return res.status(500).json({ error: 'Failed to link Google account' });
    }

    res.json({ message: 'Google account linked successfully' });
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
  googleAuthInit,
  googleAuthCallback,
  googleAuthRedirect,
  linkGoogleAccount,
};
