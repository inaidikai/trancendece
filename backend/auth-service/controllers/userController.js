const db = require('../config/database');
const { generateId } = require('../utils/auth');
const path = require('path');
const fs = require('fs');

// Get current user
const getCurrentUser = (req, res) => {
  const userId = req.user.userId;

  const query = 'SELECT id, email, username, full_name, avatar_url, bio, created_at, updated_at FROM users WHERE id = $1';
  db.get(query, [userId], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  });
};

// Update profile
const updateProfile = (req, res) => {
  const userId = req.user.userId;
  const { full_name, bio } = req.body;

  const query = `
    UPDATE users 
    SET full_name = COALESCE($1, full_name), 
        bio = COALESCE($2, bio),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $3
  `;

  db.run(query, [full_name || null, bio || null, userId], function (err) {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    const selectQuery = 'SELECT id, email, username, full_name, avatar_url, bio FROM users WHERE id = $1';
    db.get(selectQuery, [userId], (err, user) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      res.json({ message: 'Profile updated', user });
    });
  });
};

// Upload avatar
const uploadAvatar = (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const userId = req.user.userId;
  const fileName = `${userId}_${Date.now()}_${req.file.originalname}`;
  const filePath = path.join(process.env.UPLOAD_DIR || './uploads/avatars', fileName);

  // Ensure directory exists
  const uploadDir = path.dirname(filePath);
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  // Move file
  fs.rename(req.file.path, filePath, (err) => {
    if (err) {
      return res.status(500).json({ error: 'Error saving file' });
    }

    const avatarUrl = `/avatars/${fileName}`;
    const query = 'UPDATE users SET avatar_url = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2';

    db.run(query, [avatarUrl, userId], (err) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      res.json({ message: 'Avatar uploaded', avatar_url: avatarUrl });
    });
  });
};

// Add friend
const addFriend = (req, res) => {
  const userId = req.user.userId;
  const { friend_id } = req.body;

  if (!friend_id) {
    return res.status(400).json({ error: 'friend_id is required' });
  }

  if (userId === friend_id) {
    return res.status(400).json({ error: 'Cannot add yourself as friend' });
  }

  // Check if friend exists
  const checkQuery = 'SELECT id FROM users WHERE id = $1';
  db.get(checkQuery, [friend_id], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    if (!user) {
      return res.status(404).json({ error: 'Friend not found' });
    }

    const friendId = generateId();
    const insertQuery = 'INSERT INTO friends (id, user_id, friend_id, status) VALUES ($1, $2, $3, $4)';

    db.run(insertQuery, [friendId, userId, friend_id, 'pending'], function (err) {
      if (err) {
        if (err.message.includes('UNIQUE')) {
          return res.status(409).json({ error: 'Friend request already exists' });
        }
        return res.status(500).json({ error: 'Database error' });
      }

      res.status(201).json({ message: 'Friend request sent', friend_id });
    });
  });
};

// Get friends list
const getFriends = (req, res) => {
  const userId = req.user.userId;
  const { status = 'accepted' } = req.query;

  const query = `
    SELECT u.id, u.username, u.full_name, u.avatar_url, f.status, f.created_at
    FROM friends f
    JOIN users u ON (f.friend_id = u.id)
    WHERE f.user_id = $1 AND f.status = $2
    ORDER BY f.created_at DESC
  `;

  db.all(query, [userId, status], (err, friends) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    res.json(friends);
  });
};

// Accept friend request
const acceptFriend = (req, res) => {
  const userId = req.user.userId;
  const { friend_id } = req.body;

  const updateQuery = `
    UPDATE friends 
    SET status = 'accepted', updated_at = CURRENT_TIMESTAMP
    WHERE user_id = $1 AND friend_id = $2 AND status = 'pending'
  `;

  db.run(updateQuery, [friend_id, userId], function (err) {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: 'Friend request not found' });
    }

    res.json({ message: 'Friend request accepted' });
  });
};

// Remove friend
const removeFriend = (req, res) => {
  const userId = req.user.userId;
  const { friend_id } = req.params;

  const deleteQuery = `
    DELETE FROM friends 
    WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $3 AND friend_id = $4)
  `;

  db.run(deleteQuery, [userId, friend_id, friend_id, userId], function (err) {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: 'Friend not found' });
    }

    res.json({ message: 'Friend removed' });
  });
};

module.exports = {
  getCurrentUser,
  updateProfile,
  uploadAvatar,
  addFriend,
  getFriends,
  acceptFriend,
  removeFriend,
};
