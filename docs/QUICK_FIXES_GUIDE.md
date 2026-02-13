# Quick Fixes Guide - Backend Issues
**Priority Order:** Critical fixes first  
**Estimated Time:** 8-12 hours to implement all

---

## Fix #1: Password Reset Policy Validation (1 hour)

**File:** `/backend/auth-service/controllers/passwordController.js`  
**Issue:** Password reset allows weak passwords (min 6 chars instead of 8 + special chars)

### Current Code (Lines 47-58)
```javascript
const resetPassword = async (req, res) => {
  const { token, password } = req.body || {};

  if (!token) {
    return res.status(400).json({ error: 'Token is required' });
  }
  if (!password || String(password).length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
```

### Fixed Code
```javascript
const resetPassword = async (req, res) => {
  const { token, password } = req.body || {};

  if (!token) {
    return res.status(400).json({ error: 'Token is required' });
  }

  // Import at top: const { validatePasswordPolicy } = require('../utils/auth');
  const policyErrors = validatePasswordPolicy(password);
  if (policyErrors.length > 0) {
    return res.status(400).json({ 
      error: 'Password does not meet policy requirements',
      details: policyErrors 
    });
  }
```

**Export validatePasswordPolicy from auth.js:**
```javascript
// At end of auth.js
module.exports = {
  hashPassword,
  comparePassword,
  generateToken,
  generateId,
  verifyToken,
  validatePasswordPolicy  // Add this
};
```

---

## Fix #2: Move Password Reset Tokens to Database (2 hours)

**Issue:** Tokens stored in memory, lost on restart, not scalable

### Step 1: Create Migration (005_password_reset_tokens.sql)

```sql
-- Create password reset tokens table
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_password_reset_token_hash ON password_reset_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_password_reset_expires_at ON password_reset_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_password_reset_user_id ON password_reset_tokens(user_id);

-- Cleanup: Delete expired tokens periodically
CREATE OR REPLACE FUNCTION cleanup_expired_password_tokens() RETURNS void AS $$
BEGIN
  DELETE FROM password_reset_tokens WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;
```

### Step 2: Update passwordController.js

```javascript
const crypto = require('crypto');

const RESET_TOKEN_TTL_MS = Number(process.env.RESET_TOKEN_TTL_MS || 1000 * 60 * 60);

const forgotPassword = async (req, res) => {
  const { email } = req.body || {};
  const normalizedEmail = String(email || '').trim().toLowerCase();

  if (!normalizedEmail) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    const user = await db.get(
      'SELECT id, email, username, full_name FROM users WHERE email = $1',
      [normalizedEmail]
    );

    if (!user) {
      // Don't reveal if email exists
      return res.json({ message: 'Check your email for reset instructions' });
    }

    // Generate token
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');
    
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

    // Store in database
    const insertQuery = `
      INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at)
      VALUES (gen_random_uuid(), $1, $2, $3)
    `;

    await db.run(insertQuery, [user.id, tokenHash, expiresAt]);

    // Send email
    const emailSent = await sendPasswordResetEmail(
      user.email,
      token,  // Send raw token to user
      user.full_name || user.username
    );

    if (!emailSent) {
      return res.status(500).json({ error: 'Failed to send email' });
    }

    const response = { message: 'Check your email for reset instructions' };
    if (process.env.NODE_ENV !== 'production') {
      response.reset_token = token;
      response.expires_in = Math.floor(RESET_TOKEN_TTL_MS / 1000);
    }

    return res.json(response);
  } catch (err) {
    console.error('Forgot password error:', err);
    return res.status(500).json({ error: 'Database error' });
  }
};

const resetPassword = async (req, res) => {
  const { token, password } = req.body || {};

  if (!token) {
    return res.status(400).json({ error: 'Token is required' });
  }

  // Validate password policy
  const { validatePasswordPolicy } = require('../utils/auth');
  const policyErrors = validatePasswordPolicy(password);
  if (policyErrors.length > 0) {
    return res.status(400).json({ 
      error: 'Password does not meet policy requirements',
      details: policyErrors 
    });
  }

  try {
    // Hash the token to lookup
    const tokenHash = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    // Find and validate token
    const query = `
      SELECT id, user_id, expires_at, used 
      FROM password_reset_tokens 
      WHERE token_hash = $1
    `;

    const tokenRecord = await db.get(query, [tokenHash]);

    if (!tokenRecord) {
      return res.status(400).json({ error: 'Invalid or expired token' });
    }

    if (tokenRecord.used) {
      return res.status(400).json({ error: 'Token has already been used' });
    }

    if (new Date(tokenRecord.expires_at) < new Date()) {
      return res.status(400).json({ error: 'Token has expired' });
    }

    // Hash new password
    const hashedPassword = await hashPassword(password);

    // Update user password and mark token as used
    await db.run(
      'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [hashedPassword, tokenRecord.user_id]
    );

    await db.run(
      'UPDATE password_reset_tokens SET used = true, used_at = NOW() WHERE id = $1',
      [tokenRecord.id]
    );

    return res.json({ message: 'Password reset successful' });
  } catch (err) {
    console.error('Reset password error:', err);
    return res.status(500).json({ error: 'Database error' });
  }
};

module.exports = { forgotPassword, resetPassword };
```

---

## Fix #3: Complete Friend Operations (2 hours)

**File:** `/backend/auth-service/controllers/userController.js`  
**Issue:** Only addFriend partially implemented, missing list/remove/accept

### Add These Functions

```javascript
// Get user's friend list
const listFriends = (req, res) => {
  const userId = req.user.userId;

  const query = `
    SELECT u.id, u.username, u.full_name, u.avatar_url, u.bio
    FROM friends f
    JOIN users u ON f.friend_id = u.id
    WHERE f.user_id = $1
    ORDER BY u.username ASC
  `;

  db.all(query, [userId], (err, friends) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json({ friends: friends || [] });
  });
};

// Get pending friend requests
const getFriendRequests = (req, res) => {
  const userId = req.user.userId;

  const query = `
    SELECT 
      fr.id,
      u.id as sender_id,
      u.username,
      u.full_name,
      u.avatar_url,
      fr.message,
      fr.created_at
    FROM friend_requests fr
    JOIN users u ON fr.sender_id = u.id
    WHERE fr.receiver_id = $1 AND fr.status = 'pending'
    ORDER BY fr.created_at DESC
  `;

  db.all(query, [userId], (err, requests) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json({ friend_requests: requests || [] });
  });
};

// Accept friend request
const acceptFriendRequest = (req, res) => {
  const userId = req.user.userId;
  const { request_id, sender_id } = req.body;

  if (!request_id || !sender_id) {
    return res.status(400).json({ error: 'request_id and sender_id are required' });
  }

  // Update request status
  const updateQuery = 'UPDATE friend_requests SET status = $1 WHERE id = $2';
  
  db.run(updateQuery, ['accepted', request_id], (err) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    // Create bidirectional friendship
    const insertQuery = `
      INSERT INTO friends (user_id, friend_id)
      VALUES ($1, $2), ($3, $4)
      ON CONFLICT DO NOTHING
    `;

    db.run(insertQuery, [userId, sender_id, sender_id, userId], (err) => {
      if (err) {
        console.error('Insert friendship error:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      res.json({ message: 'Friend request accepted' });
    });
  });
};

// Reject friend request
const rejectFriendRequest = (req, res) => {
  const userId = req.user.userId;
  const { request_id } = req.body;

  if (!request_id) {
    return res.status(400).json({ error: 'request_id is required' });
  }

  const query = 'UPDATE friend_requests SET status = $1 WHERE id = $2 AND receiver_id = $3';

  db.run(query, ['rejected', request_id, userId], (err) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    res.json({ message: 'Friend request rejected' });
  });
};

// Remove friend (unfriend)
const removeFriend = (req, res) => {
  const userId = req.user.userId;
  const { friend_id } = req.body;

  if (!friend_id) {
    return res.status(400).json({ error: 'friend_id is required' });
  }

  // Remove both directions
  const query = `
    DELETE FROM friends 
    WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $3 AND friend_id = $4)
  `;

  db.run(query, [userId, friend_id, friend_id, userId], (err) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    res.json({ message: 'Friend removed' });
  });
};

// Check if users are friends
const checkFriendship = (req, res) => {
  const userId = req.user.userId;
  const { friend_id } = req.query;

  if (!friend_id) {
    return res.status(400).json({ error: 'friend_id is required' });
  }

  const query = 'SELECT 1 FROM friends WHERE user_id = $1 AND friend_id = $2';

  db.get(query, [userId, friend_id], (err, result) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    res.json({ is_friend: !!result });
  });
};

// Export all
module.exports = {
  getCurrentUser,
  updateProfile,
  uploadAvatar,
  addFriend,
  listFriends,
  getFriendRequests,
  acceptFriendRequest,
  rejectFriendRequest,
  removeFriend,
  checkFriendship
};
```

### Add to authRoutes.js

```javascript
const userController = require('../controllers/userController');

// Add these routes
router.get('/friends', authMiddleware, userController.listFriends);
router.get('/friend-requests', authMiddleware, userController.getFriendRequests);
router.post('/friend-requests/:id/accept', authMiddleware, userController.acceptFriendRequest);
router.post('/friend-requests/:id/reject', authMiddleware, userController.rejectFriendRequest);
router.post('/friends/:id/remove', authMiddleware, userController.removeFriend);
router.get('/friends/:id/check', authMiddleware, userController.checkFriendship);
```

---

## Fix #4: Implement Recovery Codes (2 hours)

**File:** `/backend/auth-service/controllers/twoFAController.js`  
**Issue:** No 2FA recovery codes for backup access

### Step 1: Create Migration (004_recovery_codes.sql)

```sql
-- Create recovery codes table for 2FA backup
CREATE TABLE IF NOT EXISTS recovery_codes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  code VARCHAR(20) NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, code)
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_recovery_codes_user_id ON recovery_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_recovery_codes_code ON recovery_codes(code);
```

### Step 2: Add Functions to twoFAController.js

```javascript
const { generateId } = require('../utils/auth');

// Generate recovery codes during 2FA setup
const generateRecoveryCodes = () => {
  const codes = [];
  for (let i = 0; i < 10; i++) {
    // Format: XXXX-XXXX-XX (e.g., A1B2-C3D4-E5)
    const code = Math.random().toString(36).substring(2, 8).toUpperCase() + '-' +
                 Math.random().toString(36).substring(2, 8).toUpperCase() + '-' +
                 Math.random().toString(36).substring(2, 4).toUpperCase();
    codes.push(code);
  }
  return codes;
};

// Get recovery codes (show during setup)
const getRecoveryCodes = (req, res) => {
  const userId = req.user.userId || req.user.id;

  const query = 'SELECT code, used FROM recovery_codes WHERE user_id = $1 ORDER BY created_at DESC';

  db.all(query, [userId], (err, codes) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    const unused = (codes || []).filter(c => !c.used).map(c => c.code);
    const used = (codes || []).filter(c => c.used).length;

    res.json({
      recovery_codes: unused,
      used_count: used,
      total_count: codes?.length || 0
    });
  });
};

// Use recovery code (instead of email code)
const useRecoveryCode = (req, res) => {
  const userId = req.user.userId;
  const { code } = req.body;

  if (!code) {
    return res.status(400).json({ error: 'Recovery code is required' });
  }

  // Find unused code
  const query = `
    SELECT id FROM recovery_codes 
    WHERE user_id = $1 AND code = $2 AND used = FALSE
  `;

  db.get(query, [userId, code.toUpperCase().replace(/\s+/g, '')], (err, codeRecord) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    if (!codeRecord) {
      return res.status(401).json({ error: 'Invalid or already used recovery code' });
    }

    // Mark as used
    const updateQuery = 'UPDATE recovery_codes SET used = true, used_at = NOW() WHERE id = $1';

    db.run(updateQuery, [codeRecord.id], (err) => {
      if (err) console.error('Error marking recovery code used:', err);
    });

    res.json({ message: 'Recovery code verified successfully' });
  });
};

// Generate and save recovery codes when enabling 2FA
const saveRecoveryCodes = async (userId, codes) => {
  const query = `
    INSERT INTO recovery_codes (id, user_id, code, created_at)
    VALUES ($1, $2, $3, NOW())
  `;

  for (const code of codes) {
    await db.run(query, [generateId(), userId, code]);
  }
};

// Update enable2FA to include recovery codes
const enable2FAWithRecoveryCodes = async (req, res) => {
  const userId = req.user.userId || req.user.id;

  // Get user info
  const userQuery = 'SELECT email, username FROM users WHERE id = $1';
  
  db.get(userQuery, [userId], async (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Enable 2FA flag
    const query = 'UPDATE users SET is_2fa_enabled = true WHERE id = $1';

    db.run(query, [userId], async (err) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      // Generate recovery codes
      const codes = generateRecoveryCodes();
      await saveRecoveryCodes(userId, codes);

      res.json({
        message: '2FA enabled successfully',
        recovery_codes: codes,
        instructions: 'Save these codes in a safe place. You can use them to login if you lose access to your email.',
        note: 'Each code can only be used once.'
      });
    });
  });
};

// Export all
module.exports = {
  enable2FA: enable2FAWithRecoveryCodes,
  disable2FA,
  verify2FA,
  resend2FACode,
  getRecoveryCodes,
  useRecoveryCode
};
```

---

## Fix #5: Validate OAuth State Token (1.5 hours)

**File:** `/backend/auth-service/controllers/authController.js`  
**Issue:** State token generated but never validated (CSRF vulnerability)

### Add State Storage (Use Redis or Simple Cache)

```javascript
const crypto = require('crypto');

// Simple in-memory cache (replace with Redis in production)
const oauthStates = new Map();

const OAUTH_STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

// Store state
const storeOAuthState = (state) => {
  oauthStates.set(state, {
    createdAt: Date.now(),
    used: false
  });
};

// Validate state
const validateOAuthState = (state) => {
  const entry = oauthStates.get(state);
  
  if (!entry) {
    return false;
  }

  if (entry.used) {
    // State was already used
    oauthStates.delete(state);
    return false;
  }

  if (Date.now() - entry.createdAt > OAUTH_STATE_TTL_MS) {
    // State expired
    oauthStates.delete(state);
    return false;
  }

  // Mark as used (one-time use)
  entry.used = true;
  return true;
};

// Update googleAuthInit to store state
const googleAuthInit = (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:8081/auth/google/callback';
  
  if (!clientId) {
    return res.status(500).json({ error: 'Google OAuth not configured' });
  }

  // Generate state token
  const state = crypto.randomBytes(32).toString('hex');
  storeOAuthState(state);  // ✅ Store it

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

// Update googleAuthCallback to validate state
const googleAuthCallback = async (req, res) => {
  const { code, state } = req.body;
  
  if (!code || !state) {
    return res.status(400).json({ error: 'Missing code or state parameter' });
  }

  // ✅ Validate state token
  if (!validateOAuthState(state)) {
    return res.status(401).json({ error: 'Invalid or expired state token. Please try again.' });
  }

  // ... rest of OAuth flow
};
```

### Fix Redirect URI Default

```javascript
// Update googleAuthInit
const googleAuthInit = (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  let redirectUri = process.env.GOOGLE_REDIRECT_URI;
  
  if (!clientId) {
    return res.status(500).json({ error: 'Google OAuth not configured' });
  }

  if (!redirectUri) {
    if (process.env.NODE_ENV === 'production') {
      // In production, redirect URI is required
      return res.status(500).json({ 
        error: 'Google OAuth redirect URI not configured',
        details: 'Set GOOGLE_REDIRECT_URI environment variable'
      });
    }
    // Dev fallback
    redirectUri = 'http://localhost:8081/auth/google/callback';
  }

  // ... rest of function
};
```

---

## Fix #6: Fix OAuth Tokens Table (30 minutes)

**File:** `/infrastructure/db/init/003_oauth_schema.sql`  
**Issue:** UNIQUE constraint on user_id prevents multiple providers

### Current (Lines 15-23)
```sql
CREATE TABLE IF NOT EXISTS oauth_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,  -- ❌ WRONG
  provider VARCHAR(50) NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expires_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### Fixed
```sql
CREATE TABLE IF NOT EXISTS oauth_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,  -- ✅ Removed UNIQUE
  provider VARCHAR(50) NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expires_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, provider)  -- ✅ Correct: one token per provider per user
);
```

**Action:** Delete existing table and recreate:
```sql
-- Run this once:
DROP TABLE IF EXISTS oauth_tokens CASCADE;

-- Then run the fixed version above
```

---

## Fix #7: Add Default Avatar Logic (30 minutes)

**File:** `/backend/auth-service/controllers/authController.js`  
**Lines:** ~475 (googleAuthCallback)

### Current
```javascript
const insertQuery = `
  INSERT INTO users (..., avatar_url, ...)
  VALUES (..., $5, ...)
`;

db.run(insertQuery, [userId, email.toLowerCase(), username, name, picture, ...]);
```

### Fixed
```javascript
// Use Gravatar or placeholder if no picture
const defaultAvatar = `https://i.pravatar.cc/150?u=${email.toLowerCase()}`;
const avatarUrl = picture || defaultAvatar;

const insertQuery = `
  INSERT INTO users (..., avatar_url, ...)
  VALUES (..., $5, ...)
`;

db.run(insertQuery, [userId, email.toLowerCase(), username, name, avatarUrl, ...]);
```

Also fix in regular register:
```javascript
// After user created, if no avatar provided, set default
const defaultAvatarUrl = `https://i.pravatar.cc/150?u=${email.toLowerCase()}`;
// Update user with default avatar
```

---

## Implementation Checklist

Use this checklist to track fixes:

### Critical (Do First)
- [ ] Fix #1: Password reset policy validation (1h)
- [ ] Fix #5: Validate OAuth state token (1.5h)  
- [ ] Fix #3: Complete friend operations (2h)
- [ ] Fix #4: Implement recovery codes (2h)
- [ ] Fix #2: Move password reset to database (2h)

### High Priority (Do Next)
- [ ] Fix #6: Fix oauth_tokens UNIQUE constraint (0.5h)
- [ ] Fix #7: Add default avatar logic (0.5h)
- [ ] Add missing friend routes to authRoutes.js
- [ ] Update docker-compose.yml with missing env vars
- [ ] Add test suite for auth endpoints

### Before Deploying
- [ ] Code review all changes
- [ ] Test each fix individually
- [ ] Integration test entire auth flow
- [ ] Security audit
- [ ] Performance test
- [ ] Update API documentation

---

## Testing Each Fix

### Fix #1 Test
```bash
# Should reject weak password
curl -X POST http://localhost:8081/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{"token": "test", "password": "weak"}' 

# Should accept strong password
curl -X POST http://localhost:8081/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{"token": "test", "password": "StrongPass123!"}'
```

### Fix #3 Test
```bash
# List friends
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:8081/auth/friends

# Get requests
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:8081/auth/friend-requests
```

### Fix #4 Test
```bash
# Should return recovery codes on enable
curl -X POST http://localhost:8081/auth/2fa/enable \
  -H "Authorization: Bearer TOKEN"

# Should accept recovery code for login
curl -X POST http://localhost:8081/auth/verify-2fa-login \
  -H "Content-Type: application/json" \
  -d '{"user_id": "X", "code": "ABCD-EFGH-IJ", "temp_token": "T"}'
```

### Fix #5 Test
```bash
# Get OAuth URL with state
RESPONSE=$(curl http://localhost:8081/auth/google/auth-url)
STATE=$(echo $RESPONSE | jq -r '.state')

# Try callback with wrong state (should fail)
curl -X POST http://localhost:8081/auth/google/callback \
  -H "Content-Type: application/json" \
  -d '{"code": "test", "state": "wrong-state"}'
  # Should return 401 "Invalid or expired state token"
```

---

**Total Implementation Time:** 8-12 hours  
**Difficulty:** Medium (mostly straightforward database + controller updates)  
**Risk:** Low (all changes isolated to specific functions)
