const pool = require('../db/connection');
const axios = require('axios');

const WS_SERVER_URL = process.env.WS_SERVER_URL || 'http://localhost:8003';

class NotificationService {
  // Create notification and trigger WebSocket
  static async createNotification({ userId, type, title, message, data, priority = 'medium', actionUrl }) {
    try {
      // Save to database
      const result = await pool.query(
        `INSERT INTO notifications (user_id, type, title, message, data, priority, action_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [userId, type, title, message, JSON.stringify(data || {}), priority, actionUrl]
      );

      const notification = result.rows[0];

      // Trigger WebSocket event
      try {
        await axios.post(`${WS_SERVER_URL}/trigger/notification`, {
          userId,
          notification
        });
      } catch (wsError) {
        console.error('WebSocket trigger failed:', wsError.message);
        // Don't fail the whole operation if WebSocket fails
      }

      return notification;
    } catch (error) {
      console.error('Create notification error:', error);
      throw error;
    }
  }

  // Create multiple notifications (batch)
  static async createBatchNotifications(notifications) {
    const promises = notifications.map(notif => 
      this.createNotification(notif)
    );
    
    return Promise.allSettled(promises);
  }
}

module.exports = NotificationService;