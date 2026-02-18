const db = require('../config/database');
const { generateId } = require('../utils/auth');

// Get current user
const getCurrentUser = async (req, res) => {
  const userId = req.user.userId;

  const query = 'SELECT id, email, username, full_name, avatar_url, bio, created_at, updated_at FROM users WHERE id = $1';
  try {
    const user = await db.get(query, [userId]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json(user);
  } catch {
    return res.status(500).json({ error: 'Database error' });
  }
};

// Update profile
const updateProfile = async (req, res) => {
  const userId = req.user.userId;
  const { full_name, bio, avatar } = req.body;

  if (avatar && avatar.length > 5242880) {
    return res.status(413).json({ error: 'Avatar too large. Max 5 MB.' });
  }

  const query = `
    UPDATE users 
    SET full_name = COALESCE($1, full_name), 
        bio = COALESCE($2, bio),
        avatar_url = COALESCE($4, avatar_url),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $3
  `;

  try {
    await db.run(query, [full_name || null, bio || null, userId, avatar || null]);
    const selectQuery = 'SELECT id, email, username, full_name, avatar_url, bio FROM users WHERE id = $1';
    const user = await db.get(selectQuery, [userId]);
    return res.json({ message: 'Profile updated', user });
  } catch {
    return res.status(500).json({ error: 'Database error' });
  }
};



// Add friend
const addFriend = async (req, res) => {
  const userId = req.user.userId;
  const { friend_id } = req.body;

  if (!friend_id) {
    return res.status(400).json({ error: 'friend_id is required' });
  }

  if (userId === friend_id) {
    return res.status(400).json({ error: 'Cannot add yourself as friend' });
  }

  try {
    // Check if friend exists
    const checkQuery = 'SELECT id FROM users WHERE id = $1';
    const user = await db.get(checkQuery, [friend_id]);
    if (!user) {
      return res.status(404).json({ error: 'Friend not found' });
    }

    const existingFriendQuery = `
      SELECT 1 FROM friends
      WHERE (user_id = $1 AND friend_id = $2)
         OR (user_id = $2 AND friend_id = $1)
      LIMIT 1
    `;

    const existing = await db.get(existingFriendQuery, [userId, friend_id]);
    if (existing) {
      return res.status(409).json({ error: 'Already friends' });
    }

    const requestId = generateId();
    const insertQuery = `
      INSERT INTO friend_requests (id, sender_id, receiver_id, status)
      VALUES ($1, $2, $3, 'pending')
    `;

    try {
      await db.run(insertQuery, [requestId, userId, friend_id]);
    } catch (err) {
      if (err.message.includes('UNIQUE')) {
        return res.status(409).json({ error: 'Friend request already exists' });
      }
      return res.status(500).json({ error: 'Database error' });
    }

    return res.status(201).json({ message: 'Friend request sent', friend_id });
  } catch {
    return res.status(500).json({ error: 'Database error' });
  }
};

// Get friends list
const getFriends = async (req, res) => {
  const userId = req.user.userId;
  const { status = 'accepted' } = req.query;

  if (status === 'pending') {
    const pendingQuery = `
      SELECT u.id, u.username, u.full_name, u.avatar_url, fr.status, fr.created_at
      FROM friend_requests fr
      JOIN users u ON (fr.sender_id = u.id)
      WHERE fr.receiver_id = $1 AND fr.status = 'pending'
      ORDER BY fr.created_at DESC
    `;

    try {
      const requests = await db.all(pendingQuery, [userId]);
      return res.json(requests);
    } catch {
      return res.status(500).json({ error: 'Database error' });
    }
  }

  if (status === 'sent') {
    const sentQuery = `
      SELECT u.id, u.username, u.full_name, u.avatar_url, fr.status, fr.created_at
      FROM friend_requests fr
      JOIN users u ON (fr.receiver_id = u.id)
      WHERE fr.sender_id = $1 AND fr.status = 'pending'
      ORDER BY fr.created_at DESC
    `;

    try {
      const requests = await db.all(sentQuery, [userId]);
      return res.json(requests);
    } catch {
      return res.status(500).json({ error: 'Database error' });
    }
  }

  const query = `
    SELECT u.id, u.username, u.full_name, u.avatar_url, f.created_at
    FROM friends f
    JOIN users u ON (f.friend_id = u.id)
    WHERE f.user_id = $1
    ORDER BY f.created_at DESC
  `;

  try {
    const friends = await db.all(query, [userId]);
    return res.json(friends);
  } catch {
    return res.status(500).json({ error: 'Database error' });
  }
};

// Accept friend request
const acceptFriend = async (req, res) => {
  const userId = req.user.userId;
  const { friend_id } = req.body;

  const findRequestQuery = `
    SELECT id
    FROM friend_requests
    WHERE sender_id = $1 AND receiver_id = $2 AND status = 'pending'
  `;

  try {
    const requestRow = await db.get(findRequestQuery, [friend_id, userId]);
    if (!requestRow) {
      return res.status(404).json({ error: 'Friend request not found' });
    }

    const acceptQuery = `
      UPDATE friend_requests
      SET status = 'accepted', updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `;

    await db.run(acceptQuery, [requestRow.id]);

    const insertFriendsQuery = `
      INSERT INTO friends (user_id, friend_id)
      VALUES ($1, $2), ($2, $1)
      ON CONFLICT DO NOTHING
    `;

    await db.run(insertFriendsQuery, [userId, friend_id]);

    return res.json({ message: 'Friend request accepted' });
  } catch {
    return res.status(500).json({ error: 'Database error' });
  }
};

// Remove friend
const removeFriend = async (req, res) => {
  const userId = req.user.userId;
  const { friend_id } = req.params;

  const deleteQuery = `
    DELETE FROM friends 
    WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $3 AND friend_id = $4)
  `;

  try {
    const result = await db.run(deleteQuery, [userId, friend_id, friend_id, userId]);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Friend not found' });
    }

    return res.json({ message: 'Friend removed' });
  } catch {
    return res.status(500).json({ error: 'Database error' });
  }
};

module.exports = {
  getCurrentUser,
  updateProfile,
  addFriend,
  getFriends,
  acceptFriend,
  removeFriend,
};
