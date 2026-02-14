const pool = require('../db/connection');

class ActivityLogService {
  static async log({
    userId,
    action,
    entityType = null,
    entityId = null,
    metadata = {},
  }) {
    if (!userId || !action) return;

    try {
      await pool.query(
        `INSERT INTO activity_log (user_id, action, entity_type, entity_id, metadata)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          String(userId),
          String(action),
          entityType ? String(entityType) : null,
          entityId ? String(entityId) : null,
          metadata && typeof metadata === 'object' ? metadata : {},
        ]
      );
    } catch (error) {
      // Logging must never break primary request paths.
      console.error('Activity log write failed:', error.message);
    }
  }
}

module.exports = ActivityLogService;
