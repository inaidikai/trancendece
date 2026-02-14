const pool = require('../db/connection');
const NotificationService = require('../services/notificationService');
const ActivityLogService = require('../services/activityLogService');
const crypto = require('crypto');

class FriendsController {
  static resolveRequestId(req) {
    return (
      req.params?.requestId ||
      req.query?.requestId ||
      req.query?.request_id ||
      req.body?.requestId ||
      req.body?.request_id ||
      ""
    );
  }

  // Get all friends with online status
  static async getFriends(req, res) {
    const userId = req.user.userId || req.user.id;

    try {
      const result = await pool.query(
        `SELECT 
          u.id,
          u.username,
          u.full_name,
          COALESCE(to_jsonb(u)->>'avatar_url', to_jsonb(u)->>'avatar') AS avatar,
          u.bio,
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
    const senderId = req.user.userId || req.user.id;
    const { receiverId: receiverIdInput, username, message } = req.body;
    let receiverId = receiverIdInput;

    try {
      if (!receiverId && username) {
        const userLookup = await pool.query(
          `SELECT id FROM users WHERE LOWER(username) = LOWER($1)`,
          [username.trim()]
        );
        if (userLookup.rows.length === 0) {
          return res.status(404).json({ error: 'User not found' });
        }
        receiverId = userLookup.rows[0].id;
      }
    } catch (error) {
      console.error('User lookup error:', error);
      return res.status(500).json({ error: 'Failed to resolve user' });
    }

    if (!receiverId) {
      return res.status(400).json({ error: 'Receiver ID or username is required' });
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
         WHERE ((sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1))
           AND status = 'pending'`,
        [senderId, receiverId]
      );

      if (existingRequest.rows.length > 0) {
        const isReversePending = existingRequest.rows.some(
          (row) => row.sender_id === receiverId && row.receiver_id === senderId
        );
        return res.status(400).json({
          error: isReversePending
            ? 'This user already sent you a request'
            : 'Request already sent',
        });
      }

      // Create friend request (or reopen a non-pending one)
      const result = await pool.query(
        `INSERT INTO friend_requests (id, sender_id, receiver_id, message, status)
         VALUES ($1, $2, $3, $4, 'pending')
         ON CONFLICT (sender_id, receiver_id)
         DO UPDATE SET
           status = 'pending',
           message = EXCLUDED.message,
           updated_at = NOW()
         WHERE friend_requests.status <> 'pending'
         RETURNING *`,
        [crypto.randomUUID(), senderId, receiverId, message || null]
      );

      if (result.rows.length === 0) {
        return res.status(400).json({ error: 'Request already sent' });
      }

      const request = result.rows[0];

      await ActivityLogService.log({
        userId: senderId,
        action: 'friend_request_sent',
        entityType: 'friend_request',
        entityId: request.id,
        metadata: {
          receiverId,
        },
      });

      // Get sender info for notification
      const senderInfo = await pool.query(
        `SELECT username, full_name, COALESCE(to_jsonb(users)->>'avatar_url', to_jsonb(users)->>'avatar') AS avatar FROM users WHERE id = $1`,
        [senderId]
      );

      const sender = senderInfo.rows[0];

      try {
        await NotificationService.createNotification({
          recipientId: receiverId,
          senderId: senderId,
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
      } catch (notifyError) {
        console.error('Friend request notification failed:', notifyError.message);
      }


      res.status(201).json({
        message: 'Friend request sent',
        request: request
      });
    } catch (error) {
      if (error?.code === '23505' && error?.constraint === 'unique_friend_request') {
        return res.status(400).json({ error: 'Request already sent' });
      }
      console.error('Send friend request error:', error);
      res.status(500).json({ error: 'Failed to send friend request' });
    }
  }

  // Get pending friend requests (received)
  static async getPendingRequests(req, res) {
    const userId = req.user.userId || req.user.id;
    const scope = (req.query.scope || 'sent').toLowerCase();

    try {
      let result;
      if (scope === 'received') {
        result = await pool.query(
          `SELECT 
            fr.id,
            fr.message,
            fr.created_at,
            fr.sender_id AS user_id,
            u.username,
            u.full_name,
            COALESCE(to_jsonb(u)->>'avatar_url', to_jsonb(u)->>'avatar') AS avatar,
            u.bio,
            'received' AS direction
           FROM friend_requests fr
           JOIN users u ON fr.sender_id = u.id
           WHERE fr.receiver_id = $1 AND fr.status = 'pending'
           ORDER BY fr.created_at DESC`,
          [userId]
        );
      } else if (scope === 'all') {
        result = await pool.query(
          `SELECT 
            fr.id,
            fr.message,
            fr.created_at,
            fr.sender_id AS user_id,
            u.username,
            u.full_name,
            COALESCE(to_jsonb(u)->>'avatar_url', to_jsonb(u)->>'avatar') AS avatar,
            u.bio,
            'received' AS direction
           FROM friend_requests fr
           JOIN users u ON fr.sender_id = u.id
           WHERE fr.receiver_id = $1 AND fr.status = 'pending'
           UNION ALL
           SELECT 
            fr.id,
            fr.message,
            fr.created_at,
            fr.receiver_id AS user_id,
            u.username,
            u.full_name,
            COALESCE(to_jsonb(u)->>'avatar_url', to_jsonb(u)->>'avatar') AS avatar,
            u.bio,
            'sent' AS direction
           FROM friend_requests fr
           JOIN users u ON fr.receiver_id = u.id
           WHERE fr.sender_id = $1 AND fr.status = 'pending'
           ORDER BY created_at DESC`,
          [userId]
        );
      } else {
        result = await pool.query(
          `SELECT 
            fr.id,
            fr.message,
            fr.created_at,
            fr.receiver_id AS user_id,
            u.username,
            u.full_name,
            COALESCE(to_jsonb(u)->>'avatar_url', to_jsonb(u)->>'avatar') AS avatar,
            u.bio,
            'sent' AS direction
           FROM friend_requests fr
           JOIN users u ON fr.receiver_id = u.id
           WHERE fr.sender_id = $1 AND fr.status = 'pending'
           ORDER BY fr.created_at DESC`,
          [userId]
        );
      }

      res.json({
        requests: result.rows,
        total: result.rows.length,
        scope,
      });
    } catch (error) {
      console.error('Get pending requests error:', error);
      res.status(500).json({ error: 'Failed to get requests' });
    }
  }

  // Cancel sent friend request
  static async cancelRequest(req, res) {
    const userId = req.user.userId || req.user.id;
    const { requestId } = req.params;

    try {
      const result = await pool.query(
        `DELETE FROM friend_requests
         WHERE id = $1 AND sender_id = $2 AND status = 'pending'
         RETURNING id`,
        [requestId, userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Pending request not found' });
      }

      await ActivityLogService.log({
        userId,
        action: 'friend_request_cancelled',
        entityType: 'friend_request',
        entityId: requestId,
        metadata: {},
      });

      res.json({ message: 'Friend request cancelled' });
    } catch (error) {
      console.error('Cancel friend request error:', error);
      res.status(500).json({ error: 'Failed to cancel request' });
    }
  }

  // Accept friend request
  static async acceptRequest(req, res) {
    const userId = req.user.userId || req.user.id;
    const requestId = FriendsController.resolveRequestId(req);

    if (!requestId) {
      return res.status(400).json({ error: 'Request ID is required' });
    }

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
           VALUES ($1, $2), ($2, $1)
           ON CONFLICT (user_id, friend_id) DO NOTHING`,
          [userId, request.sender_id]
        );

        await client.query('COMMIT');

        // Get user info for notification
        const userInfo = await pool.query(
          `SELECT username FROM users WHERE id = $1`,
          [userId]
        );

        const username = userInfo.rows[0].username;

        await ActivityLogService.log({
          userId,
          action: 'friend_request_accepted',
          entityType: 'friend_request',
          entityId: request.id,
          metadata: {
            senderId: request.sender_id,
          },
        });

        try {
          await NotificationService.createNotification({
            recipientId: request.sender_id,
            senderId: userId,
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
        } catch (notifyError) {
          console.error('Friend accepted notification failed:', notifyError.message);
        }


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
    const userId = req.user.userId || req.user.id;
    const requestId = FriendsController.resolveRequestId(req);

    if (!requestId) {
      return res.status(400).json({ error: 'Request ID is required' });
    }

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

      const request = result.rows[0];

      await ActivityLogService.log({
        userId,
        action: 'friend_request_declined',
        entityType: 'friend_request',
        entityId: request.id,
        metadata: {
          senderId: request.sender_id,
        },
      });

      const receiverInfo = await pool.query(
        `SELECT username FROM users WHERE id = $1`,
        [userId]
      );

      const receiverUsername = receiverInfo.rows[0]?.username || 'A user';

      try {
        await NotificationService.createNotification({
          recipientId: request.sender_id,
          senderId: userId,
          type: 'friend_request_declined',
          entityType: 'friend_request',
          entityId: request.id,
          title: 'Friend Request Declined',
          message: `${receiverUsername} declined your friend request`,
          metadata: {
            requestId: request.id,
            userId,
            username: receiverUsername,
            priority: 'low'
          }
        });
      } catch (notifyError) {
        console.error('Friend declined notification failed:', notifyError.message);
      }

      res.json({ message: 'Friend request declined' });
    } catch (error) {
      console.error('Decline friend request error:', error);
      res.status(500).json({ error: 'Failed to decline request' });
    }
  }

  // Remove friend
  static async removeFriend(req, res) {
    const userId = req.user.userId || req.user.id;
    const { friendId } = req.params;

    try {
      const userInfo = await pool.query(
        `SELECT username AS actor_username FROM users WHERE id = $1`,
        [userId]
      );

      // Delete friendship (both directions)
      const result = await pool.query(
        `DELETE FROM friends 
         WHERE (user_id = $1 AND friend_id = $2) 
            OR (user_id = $2 AND friend_id = $1)
         RETURNING user_id, friend_id`,
        [userId, friendId]
      );

      const wasRemoved = result.rows.length > 0;
      const actorUsername = userInfo.rows[0]?.actor_username || 'A friend';

      if (wasRemoved) {
        await ActivityLogService.log({
          userId,
          action: 'friend_removed',
          entityType: 'friendship',
          entityId: friendId,
          metadata: {},
        });

        try {
          await NotificationService.createNotification({
            recipientId: friendId,
            senderId: userId,
            type: 'friend_removed',
            entityType: 'friendship',
            entityId: userId,
            title: 'Friend Removed',
            message: `${actorUsername} removed you from friends`,
            metadata: {
              friendId: userId,
              friendUsername: actorUsername,
              priority: 'medium'
            }
          });
        } catch (notifyError) {
          console.error('Friend removed notification failed:', notifyError.message);
        }
      }

      res.json({ message: 'Friend removed' });
    } catch (error) {
      console.error('Remove friend error:', error);
      res.status(500).json({ error: 'Failed to remove friend' });
    }
  }
}

module.exports = FriendsController;
