const db = require('../config/database');
const { generateId, hashPassword, validatePasswordPolicy } = require('../utils/auth');
const { sendPasswordResetEmail } = require('../utils/emailService');

const RESET_TOKEN_TTL_MS = Number(process.env.RESET_TOKEN_TTL_MS || 1000 * 60 * 60);

const storeResetToken = async (userId, token, expiresAt) => {
  await db.run('DELETE FROM password_reset_tokens WHERE user_id = $1', [userId]);
  await db.run(
    'INSERT INTO password_reset_tokens (token, user_id, expires_at) VALUES ($1, $2, $3)',
    [token, userId, new Date(expiresAt)]
  );
};

const forgotPassword = async (req, res) => {
  const { email } = req.body || {};
  const normalizedEmail = String(email || '').trim().toLowerCase(); //why trim and lowercase

  if (!normalizedEmail) 
  {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    const user = await db.get( //what is db.get
      'SELECT id, email, username, full_name FROM users WHERE email = $1', //wjat we getting
      [normalizedEmail]
    );

    if (!user) { //if user not there how they saying check ur email
      return res.json({ message: 'Check your email for reset instructions' });
    }

    const token = generateId(); //geneting id for what and why we need to generate token for password reset and how it will be used in reset password flow
    await storeResetToken(user.id, token, Date.now() + RESET_TOKEN_TTL_MS); //explain

    const emailSent = await sendPasswordResetEmail(
      user.email,
      token,
      user.full_name || user.username
    );

    if (!emailSent) {
      return res.status(500).json({ error: 'Failed to send email' });
    }

    const response = { message: 'Check your email for reset instructions' };
    if (process.env.NODE_ENV !== 'production') {//why we are sending token in response in non production and not in production
      response.reset_token = token;//huh can tunderstand
      response.expires_in = Math.floor(RESET_TOKEN_TTL_MS / 1000); //explain the math
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
  const policy = validatePasswordPolicy(password);
  if (!policy.valid) {
    return res.status(400).json({
      error: 'Password policy failed',
      details: policy.errors,
    });
  }

  const entry = await db.get( //explain this fucntion and why we need to get the token from db and check its validity and expiry before allowing password reset
    'SELECT token, user_id, expires_at FROM password_reset_tokens WHERE token = $1',
    [token]
  );
  if (!entry || new Date(entry.expires_at).getTime() < Date.now()) {
    await db.run('DELETE FROM password_reset_tokens WHERE token = $1', [token]);
    return res.status(400).json({ error: 'Invalid or expired token' });
  }

  try {
    const hashedPassword = await hashPassword(password); //why agai n hash the password here, we are not storing the token in db for long time so why we need to hash the password here and not in authController during registeration, explain the flow of password reset and where this hashed password will be used
    await db.run(
      'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [hashedPassword, entry.user_id]
    );
    await db.run('DELETE FROM password_reset_tokens WHERE token = $1', [token]);
    return res.json({ message: 'Password reset successful' });
  } catch (err) {
    console.error('Reset password error:', err);
    return res.status(500).json({ error: 'Database error' });
  }
};

module.exports = {
  forgotPassword,
  resetPassword,
};
