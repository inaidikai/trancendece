const nodemailer = require('nodemailer');

// Create email transporter
// In production, use your email service credentials
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: process.env.EMAIL_PORT || 587,
  secure: process.env.EMAIL_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER || 'your-email@gmail.com',
    pass: process.env.EMAIL_PASSWORD || 'your-app-password',
  },
});

// Send password reset email
const sendPasswordResetEmail = async (email, resetToken, userName) => {
  try {
    const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`;

    const mailOptions = {
      from: process.env.EMAIL_FROM || 'noreply@auth.com',
      to: email,
      subject: 'Password Reset Request',
      html: `
        <h2>Password Reset Request</h2>
        <p>Hi ${userName || email},</p>
        <p>You requested a password reset. Click the link below to reset your password:</p>
        <p><a href="${resetLink}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reset Password</a></p>
        <p>This link expires in 1 hour.</p>
        <p>If you didn't request this, please ignore this email.</p>
        <p>Best regards,<br/>Quillow Team ^-^ </p>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`Password reset email sent to ${email}`);
    return true;
  } catch (error) {
    console.error('Error sending password reset email:', error);
    return false;
  }
};

// Send verification email
const sendVerificationEmail = async (email, verificationToken, userName) => {
  try {
    const verificationLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-email?token=${verificationToken}`;

    const mailOptions = {
      from: process.env.EMAIL_FROM || 'noreply@auth.com',
      to: email,
      subject: 'Verify Your Email',
      html: `
        <h2>Welcome!</h2>
        <p>Hi ${userName || email},</p>
        <p>Please verify your email address by clicking the link below:</p>
        <p><a href="${verificationLink}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Verify Email</a></p>
        <p>This link expires in 24 hours.</p>
        <p>Best regards,<br/>Quillow Team  ^-^</p>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`Verification email sent to ${email}`);
    return true;
  } catch (error) {
    console.error('Error sending verification email:', error);
    return false;
  }
};

// Send welcome email
const sendWelcomeEmail = async (email, userName) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_FROM || 'noreply@auth.com',
      to: email,
      subject: 'Welcome to Our Platform',
      html: `
        <h2>Welcome!</h2>
        <p>Hi ${userName || email},</p>
        <p>
          <strong>Quillow</strong> is your personal diary platform — a safe space to write,
          reflect, and express yourself while exploring a cozy <strong>3D world</strong> built
          just for you 🌍✨
        </p>

        <p>
          Capture your thoughts, relive your memories, and let your diary come alive
          in a whole new dimension.
        </p>

        <p>
          Ready to begin your journey? Your world is waiting 🚀
        </p>

        <p>
          With love,<br/>
          <strong>Team Quillow Team  ^-^</strong>
        </p>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`Welcome email sent to ${email}`);
    return true;
  } catch (error) {
    console.error('Error sending welcome email:', error);
    return false;
  }
};

// Test email configuration
const testEmailConfig = async () => {
  try {
    await transporter.verify();
    console.log('✓ Email service configured correctly');
    return true;
  } catch (error) {
    console.error('✗ Email service configuration error:', error);
    return false;
  }
};

// Send OAuth verification code email
const sendOAuthCodeEmail = async (email, code, userName) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_FROM || 'noreply@auth.com',
      to: email,
      subject: 'Your OAuth Verification Code',
      html: `
        <h2>OAuth Verification Code</h2>
        <p>Hi ${userName || email},</p>
        <p>Your verification code is:</p>
        <h1 style="color: #4CAF50; font-size: 32px; letter-spacing: 5px;">${code}</h1>
        <p>This code expires in 10 minutes.</p>
        <p>If you didn't request this code, please ignore this email.</p>
        <p>Best regards,<br/>Quillow Team  ^-^</p>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`OAuth verification code sent to ${email}`);
    return true;
  } catch (error) {
    console.error('Error sending OAuth code email:', error);
    return false;
  }
};

const sendTwoFAEmail = async (email, code, userName) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_FROM || 'noreply@auth.com',
      to: email,
      subject: 'Your 2FA Code',
      html: `
        <h2>2FA Verification Code</h2>
        <p>Hi ${userName || email},</p>
        <p>Your 2FA verification code is:</p>
        <h1 style="color: #4CAF50; font-size: 40px; letter-spacing: 10px; font-weight: bold;">${code}</h1>
        <p style="font-size: 16px; color: #666;">This code expires in 10 minutes.</p>
        <p>If you didn't request this code, please ignore this email.</p>
        <p>Best regards,<br/>Quillow Team  ^-^</p>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`2FA code sent to ${email}`);
    return true;
  } catch (error) {
    console.error('Error sending 2FA code email:', error);
    return false;
  }
};

module.exports = {
  sendPasswordResetEmail,
  sendVerificationEmail,
  sendWelcomeEmail,
  sendOAuthCodeEmail,
  sendTwoFAEmail,
  testEmailConfig,
};
