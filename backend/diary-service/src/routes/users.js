const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const UsersController = require('../controllers/usersController');

router.use(authenticateToken);

router.get('/me', UsersController.getMyProfile);
router.put('/me', UsersController.updateProfile);
router.get('/search', UsersController.searchUsers);
router.get('/:userId', UsersController.getUserProfile);

module.exports = router;