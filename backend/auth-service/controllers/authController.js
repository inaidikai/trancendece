const db = require('../config/database');
const {hashPassword, comparePassword, generateToken, generateId, verifyToken, validatePasswordPolicy,} = require('../utils/auth');
const { sendWelcomeEmail, sendTwoFAEmail } = require('../utils/emailService');
const { loadVaultSecrets } = require('../../shared/vault');

const TWO_FA_CODE_EXPIRY_MS = 2 * 60 * 1000;
const OAUTH_STATE_TTL_MS = Number(process.env.OAUTH_STATE_TTL_MS || 10 * 60 * 1000);

const ensureGoogleOAuthSecrets = async () => {
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) return; 
  try 
  {
    await loadVaultSecrets({ logger: console });
  } 
  catch (error) 
  {
    console.error('Vault reload for Google OAuth failed:', error?.message || error);
  }
};

const buildPending2FASubject = (userId) => `${userId}_2fa_pending`;
const isValidPending2FAToken = (userId, tempToken) => {
  if (!userId || !tempToken) return false;
  const decoded = verifyToken(tempToken);
  if (!decoded?.userId) return false;
  return String(decoded.userId) === buildPending2FASubject(userId);
};

const issueAndSendTwoFACode = async (user) => {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + TWO_FA_CODE_EXPIRY_MS);
  const updateQuery = 'UPDATE users SET two_fa_code = $1, two_fa_code_expires = $2 WHERE id = $3';

  await db.run(updateQuery, [code, expiresAt, user.id]);
  const sent = await sendTwoFAEmail(user.email, code, user.full_name || user.username);
  if (!sent) 
  {
    throw new Error('Failed to send 2FA code email');
  }
};

const consumeRecoveryCode = async (userId, code) => {
  const entries = await db.all(
    'SELECT id, code_hash FROM twofa_recovery_codes WHERE user_id = $1 AND used_at IS NULL',
    [userId]
  );

  for (const entry of entries) {
    const match = await comparePassword(code, entry.code_hash);
    if (match) {
      await db.run('UPDATE twofa_recovery_codes SET used_at = NOW() WHERE id = $1', [entry.id]);
      return true;
    }
  }

  return false;
};

const register = async (req, res) => { // Register new user
  const { email, username, password, full_name } = req.body;


  if (!email || !username || !password)  // Validation
  {
    return res.status(400).json({ error: 'Email, username, and password are required' });
  }

  const policy = validatePasswordPolicy(password);
  if (!policy.valid) {
    return res.status(400).json({
      error: 'Password policy failed',
      details: policy.errors,
    });
  }

  const userId = generateId();

  try {
    const hashedPassword = await hashPassword(password);
    const query = `
      INSERT INTO users (id, email, username, password_hash, full_name)
      VALUES ($1, $2, $3, $4, $5)
    `;

    await db.run(query, [userId, email.toLowerCase(), username, hashedPassword, full_name || null]);

    // Send welcome email
    sendWelcomeEmail(email, full_name || username).catch((welcomeErr) => {
      console.error('Failed to send welcome email:', welcomeErr);
      // Don't fail registration if email fails
    });

    const token = generateToken(userId);
    return res.status(201).json({
      message: 'User registered successfully',
      user: { id: userId, email, username, full_name },
      token,
    });
  } catch (err) {
    if (err?.message) {
      console.error('Registration error:', err.message);
      const errMsg = err.message.toLowerCase();
      if (errMsg.includes('unique') && errMsg.includes('email')) {
        return res.status(409).json({ error: 'Email already in use' });
      }
      if (errMsg.includes('unique') && errMsg.includes('username')) {
        return res.status(409).json({ error: 'Username already in use' });
      }
      if (errMsg.includes('unique')) {
        return res.status(409).json({ error: 'Email or username already exists' });
      }
    }
    return res.status(500).json({ error: 'Database error', details: err?.message || 'Unknown error' });
  }
};

// Login user
const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const query = 'SELECT * FROM users WHERE email = $1';

  try {
    const user = await db.get(query, [email.toLowerCase()]);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const passwordMatch = await comparePassword(password, user.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Check if 2FA is enabled
    if (user.is_2fa_enabled) { //
      try {
        await issueAndSendTwoFACode(user);
      } catch (twoFAErr) {
        console.error('2FA login issue:', twoFAErr);
        return res.status(500).json({ error: 'Failed to send 2FA code' });
      }

      const tempToken = generateToken(buildPending2FASubject(user.id));//
      return res.json({
        message: '2FA code sent to your email',
        requires_2fa: true,
        temp_token: tempToken,
        user_id: user.id,
      });
    }

    const token = generateToken(user.id);
    return res.json({
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
    return res.status(500).json({ error: 'Error during login' });
  }
};

const getMe = async (req, res) => {
  const userId = req.user.userId;

  const query = 'SELECT id, email, username, full_name, avatar_url, bio, is_2fa_enabled, created_at, updated_at FROM users WHERE id = $1';

  try {
    const user = await db.get(query, [userId]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    return res.json(user);
  } catch {
    return res.status(500).json({ error: 'Database error' });
  }
};


const logout = (req, res) => {
  res.json({ message: 'Logout successful' });
};


const verify2FALogin = async (req, res) => { // Verify 2FA during login
  const { user_id, code, temp_token, tempToken } = req.body;
  const pendingToken = temp_token || tempToken;

  if (!user_id || !code || !pendingToken) {
    return res.status(400).json({ error: 'User ID, code, and temp token are required' });
  }

  if (!isValidPending2FAToken(user_id, pendingToken)) {
    return res.status(401).json({ error: 'Invalid 2FA session. Please login again.' });
  }

  const query = 'SELECT two_fa_code, two_fa_code_expires, email, username, full_name, avatar_url FROM users WHERE id = $1 AND is_2fa_enabled = true';

  try {
    const user = await db.get(query, [user_id]);
    if (!user) {
      return res.status(404).json({ error: '2FA not enabled for this user' });
    }

    
    if (!user.two_fa_code || !user.two_fa_code_expires) { // Check if code exists and is not expired
      return res.status(400).json({ error: 'No 2FA code found. Please login again.' });
    }

    if (new Date() > new Date(user.two_fa_code_expires)) {
      return res.status(400).json({ error: '2FA code has expired. Please login again.' });
    }

    
    if (String(code) !== String(user.two_fa_code)) { // Verify code matches (email OTP or recovery code)
      try {
        const used = await consumeRecoveryCode(user_id, String(code));
        if (!used) {
          return res.status(401).json({ error: 'Invalid 2FA code' });
        }

        const clearQuery = 'UPDATE users SET two_fa_code = NULL, two_fa_code_expires = NULL WHERE id = $1';
        db.run(clearQuery, [user_id]).catch((clearErr) => {
          console.error('Error clearing 2FA code:', clearErr);
        });

        const token = generateToken(user_id);
        return res.json({
          message: 'Login successful',
          user: {
            id: user_id,
            email: user.email,
            username: user.username,
            full_name: user.full_name,
            avatar_url: user.avatar_url,
          },
          token,
          recovery_used: true,
        });
      } catch (err) {
        console.error('Recovery code check failed:', err);
        return res.status(500).json({ error: 'Error during 2FA verification' });
      }
    }

    // Clear the code after successful verification
    const clearQuery = 'UPDATE users SET two_fa_code = NULL, two_fa_code_expires = NULL WHERE id = $1';
    db.run(clearQuery, [user_id]).catch((clearErr) => {
      console.error('Error clearing 2FA code:', clearErr);
    });

    // Generate token after successful 2FA
    const token = generateToken(user_id);
    return res.json({
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
  } catch {
    return res.status(500).json({ error: 'Database error' });
  }
};

// Resend 2FA code during login challenge
const resend2FALogin = async (req, res) => {
  const { user_id, temp_token, tempToken } = req.body;
  const pendingToken = temp_token || tempToken;

  if (!user_id || !pendingToken) {
    return res.status(400).json({ error: 'User ID and temp token are required' });
  }

  if (!isValidPending2FAToken(user_id, pendingToken)) {
    return res.status(401).json({ error: 'Invalid 2FA session. Please login again.' });
  }

  const query = 'SELECT id, email, username, full_name, is_2fa_enabled FROM users WHERE id = $1';
  try {
    const user = await db.get(query, [user_id]);
    if (!user || !user.is_2fa_enabled) {
      return res.status(404).json({ error: '2FA not enabled for this user' });
    }

    try {
      await issueAndSendTwoFACode(user);
    } catch (twoFAErr) {
      console.error('Resend 2FA issue:', twoFAErr);
      return res.status(500).json({ error: 'Failed to resend 2FA code' });
    }

    return res.json({ message: '2FA code resent to your email' });
  } catch {
    return res.status(500).json({ error: 'Database error' });
  }
};

// Verify token (for other services) - Internal API
const verifyTokenForServices = async (req, res) => {
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
  try {
    const user = await db.get(query, [decoded.userId]);
    if (!user) {
      return res.status(404).json({ valid: false, error: 'User not found' });
    }

    return res.json({
      valid: true,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        full_name: user.full_name,
        avatar_url: user.avatar_url,
      },
    });
  } catch {
    return res.status(500).json({ valid: false, error: 'Database error' });
  }
};

// Get user by ID (for other services) - Internal API
const getUserById = async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  const query = 'SELECT id, email, username, full_name, avatar_url, bio, created_at FROM users WHERE id = $1';
  try {
    const user = await db.get(query, [id]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({ user });
  } catch {
    return res.status(500).json({ error: 'Database error' });
  }
};

// ==================== GOOGLE OAUTH FUNCTIONS ====================

/**
 * Initiates Google OAuth flow - returns Google authorization URL
 * Frontend redirects user to this URL
 */
const googleAuthInit = async (req, res) => {
  await ensureGoogleOAuthSecrets();
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'https://localhost:8081/auth/google/callback';
  
  if (!clientId) {
    return res.status(500).json({ error: 'Google OAuth not configured' });
  }

  // Generate state token for CSRF protection
  const crypto = require('crypto');
  const state = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + OAUTH_STATE_TTL_MS);

  // Persist state for validation on callback
  try {
    await db.run(
      'INSERT INTO oauth_states (state, provider, expires_at) VALUES ($1, $2, $3)',
      [state, 'google', expiresAt]
    );
  } catch (err) {
    console.error('OAuth state insert error:', err?.message || err);
    return res.status(500).json({ error: 'Failed to start OAuth flow' });
  }

  const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  googleAuthUrl.searchParams.append('client_id', clientId);
  googleAuthUrl.searchParams.append('redirect_uri', redirectUri);
  googleAuthUrl.searchParams.append('response_type', 'code');
  googleAuthUrl.searchParams.append('scope', 'openid email profile');
  googleAuthUrl.searchParams.append('state', state);
  googleAuthUrl.searchParams.append('access_type', 'offline');
  googleAuthUrl.searchParams.append('prompt', 'consent');

  return res.json({
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

  await ensureGoogleOAuthSecrets();
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'https://localhost:8081/auth/google/callback';

  if (!clientId || !clientSecret) {
    return res.status(500).json({ error: 'Google OAuth not configured' });
  }

  try {
    const storedState = await db.get(
      'SELECT state, expires_at FROM oauth_states WHERE state = $1 AND provider = $2',
      [state, 'google']
    );
    if (!storedState || new Date(storedState.expires_at).getTime() < Date.now()) {
      await db.run('DELETE FROM oauth_states WHERE state = $1', [state]);
      return res.status(400).json({ error: 'Invalid or expired OAuth state' });
    }

    await db.run('DELETE FROM oauth_states WHERE state = $1', [state]);

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
    const user = await db.get(query, [email.toLowerCase(), googleId]);

    // Step 4a: User exists - update OAuth info and login
    if (user) {
      // Update Google OAuth info
      const updateQuery = `
          UPDATE users 
          SET google_id = $1, oauth_provider = 'google', updated_at = NOW()
          WHERE id = $2
        `;
      try {
        await db.run(updateQuery, [googleId, user.id]);
      } catch (updateErr) {
        console.error('Update error:', updateErr.message);
        return res.status(500).json({ error: 'Database error during update' });
      }

      // Generate JWT token
      const token = generateToken(user.id);
      return res.json({
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
    }

    // Step 4b: New user - create account
    const userId = generateId();
    const username = email.split('@')[0] + '_' + Math.random().toString(36).substr(2, 5);

    const insertQuery = `
        INSERT INTO users (id, email, username, full_name, avatar_url, google_id, oauth_provider, password_hash, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      `;

    // Google OAuth users don't have passwords initially
    try {
      await db.run(insertQuery, [userId, email.toLowerCase(), username, name, picture, googleId, 'google', null]);
    } catch (insertErr) {
      console.error('Insert error:', insertErr.message);
      if (insertErr.message.includes('UNIQUE')) {
        return res.status(409).json({ error: 'Email or username already exists' });
      }
      return res.status(500).json({ error: 'Database error during user creation' });
    }

    // Send welcome email for new OAuth users
    sendWelcomeEmail(email, name || username).catch((welcomeErr) => {
      console.error('Failed to send welcome email (OAuth):', welcomeErr);
      // Don't fail OAuth signup if email fails
    });

    // Generate JWT token
    const token = generateToken(userId);
    return res.status(201).json({
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
const linkGoogleAccount = async (req, res) => {
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

  try {
    await db.run(query, [googleId, userId]);
    return res.json({ message: 'Google account linked successfully' });
  } catch (err) {
    console.error('Link error:', err.message);
    return res.status(500).json({ error: 'Failed to link Google account' });
  }
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
