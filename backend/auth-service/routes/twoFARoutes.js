const express = require('express');
const router = express.Router();
const twoFAController = require('../controllers/twoFAController');
const authMiddleware = require('../middleware/authMiddleware');

// All 2FA routes require authentication
router.use(authMiddleware);

router.post('/enable', twoFAController.enable2FA);
router.post('/disable', twoFAController.disable2FA);
router.post('/verify', twoFAController.verify2FA);
router.post('/resend-code', twoFAController.resend2FACode);

module.exports = router;