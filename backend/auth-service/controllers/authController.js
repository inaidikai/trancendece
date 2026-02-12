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
  const state = require('crypto').randomBytes(32).toString('hex');
  
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
  verifyTokenForServices,
  getUserById,
  googleAuthInit,
  googleAuthCallback,
  linkGoogleAccount,
};
