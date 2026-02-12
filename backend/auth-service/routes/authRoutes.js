const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const twoFAController = require('../controllers/twoFAController');
const passwordController = require('../controllers/passwordController');
const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/authMiddleware');
const { validate, schemas } = require('../middleware/validation');
const { authLimiter, registerLimiter, passwordResetLimiter } = require('../middleware/rateLimiter');

// Public routes
router.post('/register', registerLimiter, validate(schemas.register), authController.register);
router.post('/login', authLimiter, validate(schemas.login), authController.login);
router.post('/verify-2fa-login', authLimiter, authController.verify2FALogin);
router.post('/resend-2fa-login', authLimiter, authController.resend2FALogin);
router.post('/forgot-password', passwordResetLimiter, passwordController.forgotPassword);
router.post('/reset-password', passwordResetLimiter, passwordController.resetPassword);

// Google OAuth routes
router.get('/google/auth-url', authController.googleAuthInit);
router.get('/google/callback', authController.googleAuthRedirect);
router.post('/google/callback', authController.googleAuthCallback);

// Internal API routes (for other services)
router.post('/verify', authController.verifyTokenForServices);
router.get('/user/:id', authController.getUserById);

// Protected routes
router.get('/me', authMiddleware, authController.getMe);
router.post('/logout', authMiddleware, authController.logout);
router.post('/link-google', authMiddleware, authController.linkGoogleAccount);
router.patch('/profile', authMiddleware, userController.updateProfile);

// Protected 2FA management routes
router.post('/2fa/enable', authMiddleware, twoFAController.enable2FA);
router.post('/2fa/disable', authMiddleware, twoFAController.disable2FA);
router.post('/2fa/verify', authMiddleware, twoFAController.verify2FA);
router.post('/2fa/resend-code', authMiddleware, twoFAController.resend2FACode);

module.exports = router;
