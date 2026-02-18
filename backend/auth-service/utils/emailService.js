const nodemailer = require('nodemailer'); //what is nodemailer and why we need it
const { loadVaultSecrets } = require('../../shared/vault');//why

async function getTransporter() { //explain this function and why we need it
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) 
  {
    try 
    {
      await loadVaultSecrets({ logger: console });
    } 
    catch (error) 
    {
      console.error('Vault reload for email failed:', error?.message || error);
    }
  }

  return nodemailer.createTransport(
  {
    host: process.env.EMAIL_HOST || 'smtp.gmail.com', //what is host and why we need it and smtp
    port: Number(process.env.EMAIL_PORT || 587),  //why we need port and why 587
    secure: process.env.EMAIL_SECURE === 'true', //what is secure and why we need it
    auth: 
    {
      user: process.env.EMAIL_USER || 'your-email@gmail.com',//
      pass: process.env.EMAIL_PASSWORD || 'your-app-password',//why we need meil user and passw
    },
  });
}

function baseMailOptions(to, subject) //explain this function and why we need it with examples
{
  return {
    from: process.env.EMAIL_FROM || 'Quillow <noreply@auth.com>',
    to,
    subject,
    replyTo: process.env.EMAIL_REPLY_TO || process.env.EMAIL_FROM || 'noreply@auth.com',
  };
}


const sendPasswordResetEmail = async (email, resetToken, userName) => { //expl this funtion
  try {
    const transporter = await getTransporter();
    const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`;

    const mailOptions = {
      ...baseMailOptions(email, 'Password Reset Request'),
      text: `Hi ${userName || email},

You requested a password reset for your Quillow account.
Reset your password using this link: ${resetLink} //wh ydollar sign and curly braces and what is resetLink

This link expires in 1 hour.
If you did not request this, you can ignore this email.

Quillow Team`,
      html: `
        <h2>Password Reset Request</h2>
        <p>Hi ${userName || email},</p>
        <p>You requested a password reset. Click the link below to reset your password:</p>
        <p><a href="${resetLink}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reset Password</a></p>
        <p>This link expires in 1 hour.</p>
        <p>If you didn't request this, please ignore this email.</p> //why lines repeating
        <p>Best regards,<br/>Quillow Team</p>
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
    const transporter = await getTransporter();
    const verificationLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-email?token=${verificationToken}`;

    const mailOptions = {
      ...baseMailOptions(email, 'Verify Your Email'),
      text: `Hi ${userName || email},

Please verify your email address using this link: ${verificationLink}

This link expires in 24 hours.

Quillow Team`,
      html: `
        <h2>Welcome!</h2>
        <p>Hi ${userName || email},</p>
        <p>Please verify your email address by clicking the link below:</p>
        <p><a href="${verificationLink}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Verify Email</a></p>
        <p>This link expires in 24 hours.</p>
        <p>Best regards,<br/>Quillow Team</p>
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
    const transporter = await getTransporter();
    const mailOptions = {
      ...baseMailOptions(email, 'Welcome to Quillow'),
      text: `Hi ${userName || email},

Welcome to Quillow.
Your account is ready, and you can start writing in your diary now.

Quillow Team`,
      html: `
        <h2>Welcome!</h2>
        <p>Hi ${userName || email},</p>
        <p>
          <strong>Quillow</strong> is your personal diary platform and a safe space to write and reflect.
        </p>
        <p>Your account is ready. You can start writing now.</p>

        <p>
          Best regards,<br/>
          <strong>Quillow Team</strong>
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
    const transporter = await getTransporter();
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
    const transporter = await getTransporter();
    const mailOptions = {
      ...baseMailOptions(email, 'Your OAuth Verification Code'),
      text: `Hi ${userName || email},

Your OAuth verification code is: ${code}
This code expires in 2 minutes.
If you did not request this, ignore this email.

Quillow Team`,
      html: `
        <h2>OAuth Verification Code</h2>
        <p>Hi ${userName || email},</p>
        <p>Your verification code is:</p>
        <h1 style="color: #4CAF50; font-size: 32px; letter-spacing: 5px;">${code}</h1>
        <p>This code expires in 2 minutes.</p>
        <p>If you didn't request this code, please ignore this email.</p>
        <p>Best regards,<br/>Quillow Team</p>
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
    const transporter = await getTransporter();
    const mailOptions = {
      ...baseMailOptions(email, 'Your 2FA Code'),
      text: `Hi ${userName || email},

Your 2FA code is: ${code}
This code expires in 2 minutes.
If you did not request this, ignore this email.

Quillow Team`,
      html: `
        <h2>2FA Verification Code</h2>
        <p>Hi ${userName || email},</p>
        <p>Your 2FA verification code is:</p>
        <h1 style="color: #4CAF50; font-size: 40px; letter-spacing: 10px; font-weight: bold;">${code}</h1>
        <p style="font-size: 16px; color: #666;">This code expires in 2 minutes.</p>
        <p>If you didn't request this code, please ignore this email.</p>
        <p>Best regards,<br/>Quillow Team</p>
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

//co,e back to this late