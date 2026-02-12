const db = require('../config/database');
const { comparePassword } = require('../utils/auth');
const { sendTwoFAEmail } = require('../utils/emailService');

// Enable 2FA (Email-based)
const enable2FA = async (req, res) => {
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

    db.run(query, [userId], (err) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      res.json({
        message: '2FA enabled successfully',
        instructions: 'Next time you login, a 6-digit code will be sent to your email',
      });
    });
  });
};

// Disable 2FA
const disable2FA = (req, res) => {
  const userId = req.user.userId || req.user.id;
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({ error: 'Password is required to disable 2FA' });
  }

  // Verify password first
  const getUserQuery = 'SELECT password_hash FROM users WHERE id = $1';
  db.get(getUserQuery, [userId], async (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    try {
      const isPasswordValid = await comparePassword(password, user.password_hash);
      
      if (!isPasswordValid) {
        return res.status(401).json({ error: 'Invalid password' });
      }

      const query = 'UPDATE users SET is_2fa_enabled = false, two_fa_code = NULL, two_fa_code_expires = NULL WHERE id = $1';

      db.run(query, [userId], (err) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }

        res.json({ message: '2FA disabled' });
      });
    } catch (err) {
      res.status(500).json({ error: 'Error disabling 2FA' });
    }
  });
};

// Verify 2FA code with auth middleware (for profile/settings page)
const verify2FA = (req, res) => {
  const userId = req.user.userId || req.user.id;
  const { code } = req.body;

  if (!code) {
    return res.status(400).json({ error: 'Code is required' });
  }

  const query = 'SELECT two_fa_code, two_fa_code_expires FROM users WHERE id = $1';

  db.get(query, [userId], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if code exists and is not expired
    if (!user.two_fa_code || !user.two_fa_code_expires) {
      return res.status(400).json({ error: 'No 2FA code sent. Please enable 2FA first.' });
    }

    if (new Date() > new Date(user.two_fa_code_expires)) {
      return res.status(400).json({ error: '2FA code has expired' });
    }

    // Verify code matches
    if (code !== user.two_fa_code) {
      return res.status(401).json({ error: 'Invalid 2FA code' });
    }

    // Clear the code after successful verification
    const clearQuery = 'UPDATE users SET two_fa_code = NULL, two_fa_code_expires = NULL WHERE id = $1';
    db.run(clearQuery, [userId], (err) => {
      if (err) console.error('Error clearing 2FA code:', err);
    });

    res.json({ message: '2FA verified successfully' });
  });
};

// Resend 2FA code
const resend2FACode = async (req, res) => {
  const userId = req.user.userId || req.user.id;

  const query = 'SELECT email, full_name, username FROM users WHERE id = $1';

  db.get(query, [userId], async (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Generate new 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Save code to database
    const updateQuery = 'UPDATE users SET two_fa_code = $1, two_fa_code_expires = $2 WHERE id = $3';
    db.run(updateQuery, [code, expiresAt, userId], async (err) => {
      if (err) {
        console.error('Error saving 2FA code:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      try {
        const sent = await sendTwoFAEmail(user.email, code, user.full_name || user.username);
        if (!sent) {
          return res.status(500).json({ error: 'Failed to send 2FA email' });
        }
        res.json({ message: '2FA code resent to your email' });
      } catch (emailError) {
        console.error('Error sending 2FA email:', emailError);
        res.status(500).json({ error: 'Failed to send 2FA email' });
      }
    });
  });
};

module.exports = {
  enable2FA,
  disable2FA,
  verify2FA,
  resend2FACode,
};
