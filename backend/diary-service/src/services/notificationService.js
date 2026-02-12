const pool = require('../db/connection');
const axios = require('axios');
const crypto = require('crypto');

// IMPORTANT: in Docker use http://realtime-service:8003 (not localhost)
const WS_SERVER_URL = process.env.WS_SERVER_URL || 'http://realtime-service:8003';

class NotificationService {
  static schemaReady = null;

  static async ensureSchema() {
    if (this.schemaReady) return this.schemaReady;

    this.schemaReady = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS notifications (
          id TEXT PRIMARY KEY,
          recipient_id TEXT NOT NULL,
          sender_id TEXT,
          type TEXT NOT NULL,
          entity_type TEXT NOT NULL,
          entity_id TEXT,
          title TEXT NOT NULL,
          message TEXT NOT NULL,
          metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
          is_read BOOLEAN NOT NULL DEFAULT FALSE,
          read_at TIMESTAMP,
          is_archived BOOLEAN NOT NULL DEFAULT FALSE,
          archived_at TIMESTAMP,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
    })().catch((error) => {
      this.schemaReady = null;
      throw error;
    });

    return this.schemaReady;
  }

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
      await this.ensureSchema();
      // 1) Save to database
      const result = await pool.query(
        `INSERT INTO notifications
          (id, recipient_id, sender_id, type, entity_type, entity_id, title, message, metadata)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         RETURNING *`,
        [
          crypto.randomUUID(),
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
