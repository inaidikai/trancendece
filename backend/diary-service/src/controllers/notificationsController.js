const pool = require('../db/connection');

class NotificationsController {
  // Get notifications with pagination
  static async getNotifications(req, res) {
    const userId = req.user.userId;
    const { limit = 20, offset = 0, unreadOnly = false } = req.query;

    try {
      let query = `
        SELECT * FROM notifications
        WHERE user_id = $1 AND is_archived = FALSE
      `;
      
      const params = [userId];

      if (unreadOnly === 'true') {
        query += ` AND is_read = FALSE`;
      }

      query += ` ORDER BY created_at DESC LIMIT $2 OFFSET $3`;
      params.push(limit, offset);

      const result = await pool.query(query, params);

      // Get total count
      const countResult = await pool.query(
        `SELECT COUNT(*) as total FROM notifications 
         WHERE user_id = $1 AND is_archived = FALSE ${unreadOnly === 'true' ? 'AND is_read = FALSE' : ''}`,
        [userId]
      );

      res.json({
        notifications: result.rows,
        total: parseInt(countResult.rows[0].total),
        limit: parseInt(limit),
        offset: parseInt(offset)
      });
    } catch (error) {
      console.error('Get notifications error:', error);
      res.status(500).json({ error: 'Failed to get notifications' });
    }
  }

  // Get unread count
  static async getUnreadCount(req, res) {
    const userId = req.user.userId;

    try {
      const result = await pool.query(
        `SELECT COUNT(*) as count FROM notifications 
         WHERE user_id = $1 AND is_read = FALSE AND is_archived = FALSE`,
        [userId]
      );

      res.json({ count: parseInt(result.rows[0].count) });
    } catch (error) {
      console.error('Get unread count error:', error);
      res.status(500).json({ error: 'Failed to get unread count' });
    }
  }

  // Mark notification as read
  static async markAsRead(req, res) {
    const userId = req.user.userId;
    const { id } = req.params;

    try {
      const result = await pool.query(
        `UPDATE notifications 
         SET is_read = TRUE, read_at = NOW()
         WHERE id = $1 AND user_id = $2
         RETURNING *`,
        [id, userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Notification not found' });
      }

      res.json({ message: 'Notification marked as read', notification: result.rows[0] });
    } catch (error) {
      console.error('Mark as read error:', error);
      res.status(500).json({ error: 'Failed to mark as read' });
    }
  }

  // Mark all as read
  static async markAllAsRead(req, res) {
    const userId = req.user.userId;

    try {
      const result = await pool.query(
        `UPDATE notifications 
         SET is_read = TRUE, read_at = NOW()
         WHERE user_id = $1 AND is_read = FALSE
         RETURNING id`,
        [userId]
      );

      res.json({ 
        message: 'All notifications marked as read',
        count: result.rows.length
      });
    } catch (error) {
      console.error('Mark all as read error:', error);
      res.status(500).json({ error: 'Failed to mark all as read' });
    }
  }

  // Delete notification
  static async deleteNotification(req, res) {
    const userId = req.user.userId;
    const { id } = req.params;

    try {
      const result = await pool.query(
        `DELETE FROM notifications 
         WHERE id = $1 AND user_id = $2
         RETURNING id`,
        [id, userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Notification not found' });
      }

      res.json({ message: 'Notification deleted' });
    } catch (error) {
      console.error('Delete notification error:', error);
      res.status(500).json({ error: 'Failed to delete notification' });
    }
  }
}

module.exports = NotificationsController;