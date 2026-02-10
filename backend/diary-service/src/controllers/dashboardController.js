const pool = require('../db/connection');

class DashboardController {
  // Get dashboard summary
  static async getDashboard(req, res) {
    const userId = req.user.userId;

    try {
      // Get counts in parallel
      const [friendsResult, notificationsResult, entriesResult, invitesResult] = await Promise.all([
        // Friends count
        pool.query(
          `SELECT COUNT(*) as count FROM friends WHERE user_id = $1`,
          [userId]
        ),
        
        // Unread notifications count
        pool.query(
          `SELECT COUNT(*) as count FROM notifications 
           WHERE user_id = $1 AND is_read = FALSE AND is_archived = FALSE`,
          [userId]
        ),
        
        // Diary entries count
        pool.query(
          `SELECT COUNT(*) as count FROM diary_entries WHERE owner_id = $1`,
          [userId]
        ),
        
        // Pending invites count
        pool.query(
          `SELECT COUNT(*) as count FROM collaborators 
           WHERE user_id = $1 AND status = 'pending'`,
          [userId]
        )
      ]);

      // Get online friends
      const onlineFriendsResult = await pool.query(
        `SELECT COUNT(*) as count FROM friends f
         WHERE f.user_id = $1 
         AND EXISTS(
           SELECT 1 FROM ws_connections 
           WHERE user_id = f.friend_id AND is_online = TRUE
         )`,
        [userId]
      );

      // Get recent activity
      const recentActivity = await pool.query(
        `SELECT * FROM activity_log 
         WHERE user_id = $1 
         ORDER BY created_at DESC 
         LIMIT 10`,
        [userId]
      );

      res.json({
        summary: {
          friendsCount: parseInt(friendsResult.rows[0].count),
          onlineFriendsCount: parseInt(onlineFriendsResult.rows[0].count),
          unreadNotifications: parseInt(notificationsResult.rows[0].count),
          entriesCount: parseInt(entriesResult.rows[0].count),
          pendingInvites: parseInt(invitesResult.rows[0].count)
        },
        recentActivity: recentActivity.rows
      });
    } catch (error) {
      console.error('Get dashboard error:', error);
      res.status(500).json({ error: 'Failed to get dashboard data' });
    }
  }
}

module.exports = DashboardController;