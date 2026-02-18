const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/authMiddleware');
const { validate, schemas } = require('../middleware/validation');

// All routes require authentication
router.use(authMiddleware);

// Get current user info
router.get('/me', userController.getCurrentUser);

// Profile routes
router.patch('/profile', validate(schemas.updateProfile), userController.updateProfile);

// Friends routes
router.post('/friends/add', validate(schemas.addFriend), userController.addFriend);
router.get('/friends', userController.getFriends);
router.post('/friends/accept', validate(schemas.acceptFriend), userController.acceptFriend);
router.delete('/friends/:friend_id', userController.removeFriend);

module.exports = router;
