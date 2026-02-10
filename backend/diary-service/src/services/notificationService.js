const pool = require('../db/connection');
const axios = require('axios');

// IMPORTANT: in Docker use http://realtime-service:8003 (not localhost)
const WS_SERVER_URL = process.env.WS_SERVER_URL || 'http://realtime-service:8003';

class NotificationService {
  /**
   * Create notification in DB + trigger WebSocket push
   * Matches table created in infrastructure/db/init/001_lola_schema.sql:
   * notifications(recipient_id, sender_id, type, entity_type, entity_id, title, message, metadata, ...)
   */
  static async createNotification({
    recipientId,          // required
    senderId = null,      // optional (actor)
    type,                 // required
    entityType,           // required
    entityId = null,      // optional
    title,                // required
    message,              // required
    metadata = {},        // optional object (JSONB)
  }) {
    try {
      // 1) Save to database
      const result = await pool.query(
        `INSERT INTO notifications
          (recipient_id, sender_id, type, entity_type, entity_id, title, message, metadata)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         RETURNING *`,
        [
          recipientId,
          senderId,
          type,
          entityType,
          entityId,
          title,
          message,
          metadata,
        ]
      );

      const notification = result.rows[0];

      // 2) Trigger WebSocket event (don’t fail DB insert if WS fails)
      try {
        await axios.post(`${WS_SERVER_URL}/trigger/notification`, {
          userId: recipientId,
          notification,
        });
      } catch (wsError) {
        console.error('WebSocket trigger failed:', wsError.message);
      }

      return notification;
    } catch (error) {
      console.error('Create notification error:', error);
      throw error;
    }
  }

  // Batch helper
  static async createBatchNotifications(notifications) {
    const promises = notifications.map((n) => this.createNotification(n));
    return Promise.allSettled(promises);
  }
}

module.exports = NotificationService;
