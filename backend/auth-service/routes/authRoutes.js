const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');
const { validate, schemas } = require('../middleware/validation');
const { authLimiter, registerLimiter } = require('../middleware/rateLimiter');

// Public routes
router.post('/register', registerLimiter, validate(schemas.register), authController.register);
router.post('/login', authLimiter, validate(schemas.login), authController.login);
router.post('/verify-2fa-login', authLimiter, authController.verify2FALogin);

// Internal API routes (for other services)
router.post('/verify', authController.verifyTokenForServices);
router.get('/user/:id', authController.getUserById);

// Protected routes
router.get('/me', authMiddleware, authController.getMe);
router.post('/logout', authMiddleware, authController.logout);

module.exports = router;
