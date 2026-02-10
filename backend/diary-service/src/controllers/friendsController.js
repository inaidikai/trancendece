const pool = require('../db/connection');
const NotificationService = require('../services/notificationService');

class FriendsController {
  // Get all friends with online status
  static async getFriends(req, res) {
    const userId = req.user.userId;

    try {
      const result = await pool.query(
        `SELECT 
          u.id,
          u.username,
          u.full_name,
          u.avatar,
          f.created_at as friends_since,
          EXISTS(
            SELECT 1 FROM ws_connections 
            WHERE user_id = u.id AND is_online = TRUE
          ) as is_online
         FROM friends f
         JOIN users u ON f.friend_id = u.id
         WHERE f.user_id = $1
         ORDER BY u.username`,
        [userId]
      );

      res.json({
        friends: result.rows,
        total: result.rows.length
      });
    } catch (error) {
      console.error('Get friends error:', error);
      res.status(500).json({ error: 'Failed to get friends' });
    }
  }

  // Send friend request
  static async sendRequest(req, res) {
    const senderId = req.user.userId;
    const { receiverId, message } = req.body;

    if (!receiverId) {
      return res.status(400).json({ error: 'Receiver ID is required' });
    }

    if (senderId === receiverId) {
      return res.status(400).json({ error: 'Cannot send request to yourself' });
    }

    try {
      // Check if already friends
      const existingFriendship = await pool.query(
        `SELECT 1 FROM friends WHERE user_id = $1 AND friend_id = $2`,
        [senderId, receiverId]
      );

      if (existingFriendship.rows.length > 0) {
        return res.status(400).json({ error: 'Already friends' });
      }

      // Check if request already exists
      const existingRequest = await pool.query(
        `SELECT * FROM friend_requests 
         WHERE sender_id = $1 AND receiver_id = $2 AND status = 'pending'`,
        [senderId, receiverId]
      );

      if (existingRequest.rows.length > 0) {
        return res.status(400).json({ error: 'Request already sent' });
      }

      // Create friend request
      const result = await pool.query(
        `INSERT INTO friend_requests (sender_id, receiver_id, message, status)
         VALUES ($1, $2, $3, 'pending')
         RETURNING *`,
        [senderId, receiverId, message || null]
      );

      const request = result.rows[0];

      // Get sender info for notification
      const senderInfo = await pool.query(
        `SELECT username, full_name, avatar FROM users WHERE id = $1`,
        [senderId]
      );

      const sender = senderInfo.rows[0];

      // Create notification
await NotificationService.createNotification({
  recipientId: receiverId,     // who receives the notification
  senderId: senderId,          // who triggered it

  type: 'friend_request_received',
  entityType: 'friend_request',
  entityId: request.id,

  title: 'New Friend Request',
  message: `${sender.username} sent you a friend request`,

  metadata: {
    requestId: request.id,
    senderId: senderId,
    senderUsername: sender.username,
    senderAvatar: sender.avatar,
    priority: 'medium'
  }
});


      res.status(201).json({
        message: 'Friend request sent',
        request: request
      });
    } catch (error) {
      console.error('Send friend request error:', error);
      res.status(500).json({ error: 'Failed to send friend request' });
    }
  }

  // Get pending friend requests (received)
  static async getPendingRequests(req, res) {
    const userId = req.user.userId;

    try {
      const result = await pool.query(
        `SELECT 
          fr.id,
          fr.message,
          fr.created_at,
          u.id as sender_id,
          u.username as sender_username,
          u.full_name as sender_name,
          u.avatar as sender_avatar
         FROM friend_requests fr
         JOIN users u ON fr.sender_id = u.id
         WHERE fr.receiver_id = $1 AND fr.status = 'pending'
         ORDER BY fr.created_at DESC`,
        [userId]
      );

      res.json({
        requests: result.rows,
        total: result.rows.length
      });
    } catch (error) {
      console.error('Get pending requests error:', error);
      res.status(500).json({ error: 'Failed to get requests' });
    }
  }

  // Accept friend request
  static async acceptRequest(req, res) {
    const userId = req.user.userId;
    const { requestId } = req.params;

    try {
      // Get request details
      const requestResult = await pool.query(
        `SELECT * FROM friend_requests 
         WHERE id = $1 AND receiver_id = $2 AND status = 'pending'`,
        [requestId, userId]
      );

      if (requestResult.rows.length === 0) {
        return res.status(404).json({ error: 'Request not found' });
      }

      const request = requestResult.rows[0];

      // Start transaction
      const client = await pool.connect();
      
      try {
        await client.query('BEGIN');

        // Update request status
        await client.query(
          `UPDATE friend_requests SET status = 'accepted', updated_at = NOW()
           WHERE id = $1`,
          [requestId]
        );

        // Create friendship (bidirectional)
        await client.query(
          `INSERT INTO friends (user_id, friend_id)
           VALUES ($1, $2), ($2, $1)`,
          [userId, request.sender_id]
        );

        await client.query('COMMIT');

        // Get user info for notification
        const userInfo = await pool.query(
          `SELECT username FROM users WHERE id = $1`,
          [userId]
        );

        const username = userInfo.rows[0].username;

        // Notify sender
        await NotificationService.createNotification({
  recipientId: request.sender_id, // who receives the notification
  senderId: userId,               // who accepted the request

  type: 'friend_request_accepted',
  entityType: 'friend_request',
  entityId: request.id,

  title: 'Friend Request Accepted',
  message: `${username} accepted your friend request`,

  metadata: {
    friendId: userId,
    friendUsername: username,
    priority: 'medium'
  }
});


        res.json({ message: 'Friend request accepted' });

      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Accept friend request error:', error);
      res.status(500).json({ error: 'Failed to accept request' });
    }
  }

  // Decline friend request
  static async declineRequest(req, res) {
    const userId = req.user.userId;
    const { requestId } = req.params;

    try {
      const result = await pool.query(
        `UPDATE friend_requests 
         SET status = 'declined', updated_at = NOW()
         WHERE id = $1 AND receiver_id = $2 AND status = 'pending'
         RETURNING *`,
        [requestId, userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Request not found' });
      }

      res.json({ message: 'Friend request declined' });
    } catch (error) {
      console.error('Decline friend request error:', error);
      res.status(500).json({ error: 'Failed to decline request' });
    }
  }

  // Remove friend
  static async removeFriend(req, res) {
    const userId = req.user.userId;
    const { friendId } = req.params;

    try {
      // Delete friendship (both directions)
      await pool.query(
        `DELETE FROM friends 
         WHERE (user_id = $1 AND friend_id = $2) 
            OR (user_id = $2 AND friend_id = $1)`,
        [userId, friendId]
      );

      res.json({ message: 'Friend removed' });
    } catch (error) {
      console.error('Remove friend error:', error);
      res.status(500).json({ error: 'Failed to remove friend' });
    }
  }
}

module.exports = FriendsController;