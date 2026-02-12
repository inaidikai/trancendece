const pool = require('../db/connection');

class UsersController {
  // Get current user profile
  static async getMyProfile(req, res) {
    const userId = req.user.userId;

    try {
      const result = await pool.query(
        `SELECT
          u.id,
          u.username,
          u.email,
          u.full_name,
          COALESCE(to_jsonb(u)->>'avatar_url', to_jsonb(u)->>'avatar') AS avatar,
          u.bio,
          u.created_at,
          w.last_seen
         FROM users u
         LEFT JOIN ws_connections w ON w.user_id = u.id
         WHERE u.id = $1`,
        [userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({ user: result.rows[0] });
    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({ error: 'Failed to get profile' });
    }
  }

  // Update profile
  static async updateProfile(req, res) {
    const userId = req.user.userId;
    const { fullName, avatar, bio } = req.body;

    try {
      const updates = [];
      const values = [];
      let paramCount = 1;

      if (fullName !== undefined) {
        updates.push(`full_name = $${paramCount++}`);
        values.push(fullName);
      }
      if (avatar !== undefined) {
        updates.push(`avatar_url = $${paramCount++}`);
        values.push(avatar);
      }
      if (bio !== undefined) {
        updates.push(`bio = $${paramCount++}`);
        values.push(bio);
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }

      updates.push(`updated_at = NOW()`);
      values.push(userId);

      const query = `
        UPDATE users 
        SET ${updates.join(', ')}
        WHERE id = $${paramCount}
        RETURNING id, username, email, full_name, avatar_url AS avatar, bio
      `;

      const result = await pool.query(query, values);

      res.json({
        message: 'Profile updated',
        user: result.rows[0]
      });
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({ error: 'Failed to update profile' });
    }
  }

  // Search users
  static async searchUsers(req, res) {
    const { q } = req.query;
    const userId = req.user.userId;

    if (!q || q.length < 2) {
      return res.status(400).json({ error: 'Search query must be at least 2 characters' });
    }

    try {
      const result = await pool.query(
        `SELECT 
          u.id,
          u.username,
          u.full_name,
          COALESCE(to_jsonb(u)->>'avatar_url', to_jsonb(u)->>'avatar') AS avatar,
          EXISTS(
            SELECT 1 FROM friends 
            WHERE user_id = $1 AND friend_id = u.id
          ) as is_friend,
          EXISTS(
            SELECT 1 FROM friend_requests 
            WHERE sender_id = $1 AND receiver_id = u.id AND status = 'pending'
          ) as request_sent
         FROM users u
         WHERE u.id != $1 
           AND (u.username ILIKE $2 OR u.full_name ILIKE $2)
         LIMIT 20`,
        [userId, `%${q}%`]
      );

      res.json({
        users: result.rows,
        total: result.rows.length
      });
    } catch (error) {
      console.error('Search users error:', error);
      res.status(500).json({ error: 'Failed to search users' });
    }
  }

  // Get user profile by ID
  static async getUserProfile(req, res) {
    const { userId } = req.params;
    const currentUserId = req.user.userId;

    try {
      const result = await pool.query(
        `SELECT 
          u.id,
          u.username,
          u.full_name,
          COALESCE(to_jsonb(u)->>'avatar_url', to_jsonb(u)->>'avatar') AS avatar,
          u.bio,
          u.created_at,
          EXISTS(
            SELECT 1 FROM friends 
            WHERE user_id = $2 AND friend_id = u.id
          ) as is_friend,
          EXISTS(
            SELECT 1 FROM ws_connections 
            WHERE user_id = u.id AND socket_id IS NOT NULL
          ) as is_online
         FROM users u
         WHERE u.id = $1`,
        [userId, currentUserId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({ user: result.rows[0] });
    } catch (error) {
      console.error('Get user profile error:', error);
      res.status(500).json({ error: 'Failed to get user profile' });
    }
  }
}

module.exports = UsersController;
