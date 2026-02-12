/**
 * Notification Service
 * Core business logic for notification system
 */

const { pool } = require('../config/database');
const crypto = require('crypto');
const { 
  NOTIFICATION_TYPES, 
  NOTIFICATION_PRIORITIES,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_STATUS 
} = require('../constants/notificationWsEvents');

class NotificationService {
  static schemaReady = null;

  static async ensureSchema() {
    if (this.schemaReady) {
      return this.schemaReady;
    }

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

      await pool.query(`
        CREATE TABLE IF NOT EXISTS notification_preferences (
          user_id TEXT PRIMARY KEY,
          email_enabled BOOLEAN NOT NULL DEFAULT TRUE,
          push_enabled BOOLEAN NOT NULL DEFAULT TRUE,
          in_app_enabled BOOLEAN NOT NULL DEFAULT TRUE,
          digest_enabled BOOLEAN NOT NULL DEFAULT FALSE,
          quiet_hours_start TIME,
          quiet_hours_end TIME,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS notification_delivery_status (
          id BIGSERIAL PRIMARY KEY,
          notification_id TEXT NOT NULL,
          channel TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          error_message TEXT,
          delivered_at TIMESTAMP,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
          UNIQUE(notification_id, channel)
        )
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS notification_batches (
          id BIGSERIAL PRIMARY KEY,
          recipient_id TEXT NOT NULL,
          batch_key TEXT,
          last_notification_id TEXT,
          count INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);

      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_notifications_recipient_created
        ON notifications (recipient_id, created_at DESC)
      `);

      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_notifications_unread
        ON notifications (recipient_id, is_read, is_archived)
      `);
    })().catch((error) => {
      this.schemaReady = null;
      throw error;
    });

    return this.schemaReady;
  }

  /**
   * Create a new notification
   */
  static async createNotification({
    recipientId,
    senderId = null,
    type,
    entityType,
    entityId = null,
    title,
    message,
    metadata = {},
    priority = NOTIFICATION_PRIORITIES.NORMAL,
  }) {
    try {
      await this.ensureSchema();
      const notificationId = crypto.randomUUID();
      const result = await pool.query(
        `INSERT INTO notifications 
        (id, recipient_id, sender_id, type, entity_type, entity_id, title, message, metadata)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *`,
        [
          notificationId,
          recipientId,
          senderId,
          type,
          entityType,
          entityId,
          title,
          message,
          JSON.stringify(metadata),
        ]
      );

      const notification = result.rows[0];

      // Create delivery status records
      await this.createDeliveryStatus(notification.id, NOTIFICATION_CHANNELS.WEBSOCKET);

      return notification;
    } catch (error) {
      console.error('[NotificationService] Create error:', error);
      throw error;
    }
  }

  /**
   * Create multiple notifications (batch)
   */
  static async createBulkNotifications(notifications) {
    await this.ensureSchema();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const createdNotifications = [];
      for (const notif of notifications) {
        const notificationId = crypto.randomUUID();
        const result = await client.query(
          `INSERT INTO notifications 
          (id, recipient_id, sender_id, type, entity_type, entity_id, title, message, metadata)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING *`,
          [
            notificationId,
            notif.recipientId,
            notif.senderId || null,
            notif.type,
            notif.entityType,
            notif.entityId || null,
            notif.title,
            notif.message,
            JSON.stringify(notif.metadata || {}),
          ]
        );
        createdNotifications.push(result.rows[0]);
      }

      await client.query('COMMIT');
      return createdNotifications;
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('[NotificationService] Bulk create error:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get notifications for a user
   */
  static async getNotifications(userId, options = {}) {
    const {
      limit = 50,
      offset = 0,
      isRead = null,
      isArchived = false,
      type = null,
      sortBy = 'created_at',
      sortOrder = 'DESC',
    } = options;

    try {
      await this.ensureSchema();
      const allowedSortBy = new Set(['created_at', 'updated_at', 'read_at', 'archived_at']);
      const safeSortBy = allowedSortBy.has(sortBy) ? sortBy : 'created_at';
      const safeSortOrder = String(sortOrder).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

      let query = `
        SELECT n.*, 
          json_build_object(
            'id', u.id,
            'name', COALESCE(u.full_name, u.username),
            'avatar', u.avatar_url
          ) as sender
        FROM notifications n
        LEFT JOIN users u ON n.sender_id = u.id
        WHERE n.recipient_id = $1
        AND n.is_archived = $2
      `;

      const params = [userId, isArchived];
      let paramIndex = 3;

      if (isRead !== null) {
        query += ` AND n.is_read = $${paramIndex}`;
        params.push(isRead);
        paramIndex++;
      }

      if (type) {
        query += ` AND n.type = $${paramIndex}`;
        params.push(type);
        paramIndex++;
      }

      query += ` ORDER BY n.${safeSortBy} ${safeSortOrder} LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const result = await pool.query(query, params);
      return result.rows;
    } catch (error) {
      console.error('[NotificationService] Get notifications error:', error);
      throw error;
    }
  }

  /**
   * Get unread notification count
   */
  static async getUnreadCount(userId) {
    try {
      await this.ensureSchema();
      const result = await pool.query(
        `SELECT COUNT(*)::int as count
         FROM notifications
         WHERE recipient_id = $1
           AND is_read = FALSE
           AND is_archived = FALSE`,
        [userId]
      );
      return result.rows[0].count;
    } catch (error) {
      console.error('[NotificationService] Get unread count error:', error);
      throw error;
    }
  }

  /**
   * Mark notifications as read
   */
  static async markAsRead(userId, notificationIds = null) {
    try {
      await this.ensureSchema();
      if (notificationIds && notificationIds.length > 0) {
        const result = await pool.query(
          `UPDATE notifications
           SET is_read = TRUE, read_at = NOW(), updated_at = NOW()
           WHERE recipient_id = $1
             AND id = ANY($2)
             AND is_read = FALSE`,
          [userId, notificationIds]
        );
        return result.rowCount;
      } else {
        const result = await pool.query(
          `UPDATE notifications
           SET is_read = TRUE, read_at = NOW(), updated_at = NOW()
           WHERE recipient_id = $1
             AND is_read = FALSE`,
          [userId]
        );
        return result.rowCount;
      }
    } catch (error) {
      console.error('[NotificationService] Mark as read error:', error);
      throw error;
    }
  }

  /**
   * Mark notification as unread
   */
  static async markAsUnread(userId, notificationId) {
    try {
      await this.ensureSchema();
      const result = await pool.query(
        `UPDATE notifications 
        SET is_read = FALSE, read_at = NULL, updated_at = NOW()
        WHERE id = $1 AND recipient_id = $2
        RETURNING *`,
        [notificationId, userId]
      );
      return result.rows[0];
    } catch (error) {
      console.error('[NotificationService] Mark as unread error:', error);
      throw error;
    }
  }

  /**
   * Archive notifications
   */
  static async archiveNotifications(userId, notificationIds) {
    try {
      await this.ensureSchema();
      const result = await pool.query(
        `UPDATE notifications 
        SET is_archived = TRUE, archived_at = NOW(), updated_at = NOW()
        WHERE recipient_id = $1 AND id = ANY($2)
        RETURNING *`,
        [userId, notificationIds]
      );
      return result.rows;
    } catch (error) {
      console.error('[NotificationService] Archive error:', error);
      throw error;
    }
  }

  /**
   * Unarchive notifications
   */
  static async unarchiveNotifications(userId, notificationIds) {
    try {
      await this.ensureSchema();
      const result = await pool.query(
        `UPDATE notifications 
        SET is_archived = FALSE, archived_at = NULL, updated_at = NOW()
        WHERE recipient_id = $1 AND id = ANY($2)
        RETURNING *`,
        [userId, notificationIds]
      );
      return result.rows;
    } catch (error) {
      console.error('[NotificationService] Unarchive error:', error);
      throw error;
    }
  }

  /**
   * Delete notification
   */
  static async deleteNotification(userId, notificationId) {
    try {
      await this.ensureSchema();
      const result = await pool.query(
        `DELETE FROM notifications 
        WHERE id = $1 AND recipient_id = $2
        RETURNING *`,
        [notificationId, userId]
      );
      return result.rows[0];
    } catch (error) {
      console.error('[NotificationService] Delete error:', error);
      throw error;
    }
  }

  /**
   * Get notification preferences
   */
  static async getPreferences(userId) {
    try {
      await this.ensureSchema();
      const result = await pool.query(
        `SELECT * FROM notification_preferences WHERE user_id = $1`,
        [userId]
      );

      if (result.rows.length === 0) {
        // Create default preferences
        return await this.createDefaultPreferences(userId);
      }

      return result.rows[0];
    } catch (error) {
      console.error('[NotificationService] Get preferences error:', error);
      throw error;
    }
  }

  /**
   * Update notification preferences
   */
  static async updatePreferences(userId, preferences) {
    try {
      await this.ensureSchema();
      const fields = [];
      const values = [];
      let paramIndex = 1;

      Object.keys(preferences).forEach((key) => {
        fields.push(`${key} = $${paramIndex}`);
        values.push(preferences[key]);
        paramIndex++;
      });

      fields.push('updated_at = NOW()');
      values.push(userId);

      const query = `
        UPDATE notification_preferences 
        SET ${fields.join(', ')}
        WHERE user_id = $${paramIndex}
        RETURNING *
      `;

      const result = await pool.query(query, values);
      return result.rows[0];
    } catch (error) {
      console.error('[NotificationService] Update preferences error:', error);
      throw error;
    }
  }

  /**
   * Create default preferences
   */
  static async createDefaultPreferences(userId) {
    try {
      await this.ensureSchema();
      const result = await pool.query(
        `INSERT INTO notification_preferences (user_id)
        VALUES ($1)
        ON CONFLICT (user_id) DO UPDATE SET updated_at = NOW()
        RETURNING *`,
        [userId]
      );
      return result.rows[0];
    } catch (error) {
      console.error('[NotificationService] Create default preferences error:', error);
      throw error;
    }
  }

  /**
   * Create delivery status record
   */
  static async createDeliveryStatus(notificationId, channel, status = NOTIFICATION_STATUS.PENDING) {
    try {
      await this.ensureSchema();
      await pool.query(
        `INSERT INTO notification_delivery_status (notification_id, channel, status)
        VALUES ($1, $2, $3)
        ON CONFLICT (notification_id, channel)
        DO UPDATE SET status = EXCLUDED.status, updated_at = NOW()`,
        [notificationId, channel, status]
      );
    } catch (error) {
      console.error('[NotificationService] Create delivery status error:', error);
    }
  }

  /**
   * Update delivery status
   */
  static async updateDeliveryStatus(notificationId, channel, status, errorMessage = null) {
    try {
      await this.ensureSchema();
      await pool.query(
        `UPDATE notification_delivery_status 
        SET status = $1,
            error_message = $2,
            delivered_at = CASE WHEN $1 = '${NOTIFICATION_STATUS.DELIVERED}' THEN NOW() ELSE delivered_at END,
            updated_at = NOW()
        WHERE notification_id = $3 AND channel = $4`,
        [status, errorMessage, notificationId, channel]
      );
    } catch (error) {
      console.error('[NotificationService] Update delivery status error:', error);
    }
  }

  /**
   * Get notification batches
   */
  static async getBatches(userId, limit = 10) {
    try {
      await this.ensureSchema();
      const result = await pool.query(
        `SELECT nb.*, n.title, n.message, n.created_at as last_notification_time
        FROM notification_batches nb
        LEFT JOIN notifications n ON nb.last_notification_id = n.id
        WHERE nb.recipient_id = $1
        ORDER BY nb.updated_at DESC
        LIMIT $2`,
        [userId, limit]
      );
      return result.rows;
    } catch (error) {
      console.error('[NotificationService] Get batches error:', error);
      throw error;
    }
  }

  /**
   * Clean up old archived notifications
   */
  static async cleanupOldNotifications(daysOld = 90) {
    try {
      await this.ensureSchema();
      const result = await pool.query(
        `DELETE FROM notifications 
        WHERE is_archived = TRUE 
        AND archived_at < NOW() - ($1 || ' days')::INTERVAL`,
        [daysOld]
      );
      return result.rowCount;
    } catch (error) {
      console.error('[NotificationService] Cleanup error:', error);
      throw error;
    }
  }
}

module.exports = NotificationService;
