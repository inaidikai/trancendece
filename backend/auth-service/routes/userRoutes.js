const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/authMiddleware');
const { validate, schemas } = require('../middleware/validation');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = process.env.UPLOAD_DIR || './uploads/avatars';
    try {
      fs.mkdirSync(uploadDir, { recursive: true });
    } catch (err) {
      return cb(err);
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and GIF are allowed'));
    }
  },
});

// All routes require authentication
router.use(authMiddleware);

// Get current user info
router.get('/me', userController.getCurrentUser);

// Profile routes
router.patch('/profile', validate(schemas.updateProfile), userController.updateProfile);
router.post('/avatar', upload.single('avatar'), userController.uploadAvatar);

// Friends routes
router.post('/friends/add', validate(schemas.addFriend), userController.addFriend);
router.get('/friends', userController.getFriends);
router.post('/friends/accept', validate(schemas.acceptFriend), userController.acceptFriend);
router.delete('/friends/:friend_id', userController.removeFriend);

module.exports = router;
