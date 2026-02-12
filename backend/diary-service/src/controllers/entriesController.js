const pool = require('../db/connection');
const NotificationService = require("../services/notificationService");
const crypto = require('crypto');

// returns array of userIds that should be notified (owner + accepted collaborators), excluding actor
async function getEntryRecipients(entryId, actorId) {
  // Owner
  const ownerRes = await pool.query(
    `SELECT owner_id FROM diary_entries WHERE id = $1`,
    [entryId]
  );
  if (ownerRes.rows.length === 0) return [];

  const ownerId = ownerRes.rows[0].owner_id;

  // Accepted collaborators
  const collabRes = await pool.query(
    `SELECT user_id
     FROM collaborators
     WHERE entry_id = $1 AND status = 'accepted'`,
    [entryId]
  );

  const collaboratorIds = collabRes.rows.map(r => r.user_id);

  // Combine + unique + exclude actor
  const all = [ownerId, ...collaboratorIds];
  const unique = [...new Set(all)].filter(id => id !== actorId);

  return unique;
}

class EntriesController {
  // Get user's entries
  static async getEntries(req, res) {
    const userId = req.user.userId || req.user.id;
    if (!userId) {
      return res.status(401).json({ error: 'Invalid token payload' });
    }

    try {
      const result = await pool.query(
        `SELECT 
          e.*,
          (
            SELECT COUNT(*) FROM collaborators 
            WHERE entry_id = e.id AND status = 'accepted'
          ) as collaborators_count
         FROM diary_entries e
         WHERE e.owner_id = $1 
            OR e.id IN (
              SELECT entry_id FROM collaborators 
              WHERE user_id = $1 AND status = 'accepted'
            )
         ORDER BY e.updated_at DESC`,
        [userId]
      );

      res.json({
        entries: result.rows,
        total: result.rows.length
      });
    } catch (error) {
      console.error('Get entries error:', error);
      res.status(500).json({ error: 'Failed to get entries' });
    }
  }

  // Get specific entry
  static async getEntry(req, res) {
    const userId = req.user.userId || req.user.id;
    if (!userId) {
      return res.status(401).json({ error: 'Invalid token payload' });
    }
    const { id } = req.params;

    try {
      // Check access
      const accessCheck = await pool.query(
        `SELECT 1 FROM diary_entries 
         WHERE id = $1 AND (
           owner_id = $2 
           OR id IN (
             SELECT entry_id FROM collaborators 
             WHERE user_id = $2 AND status = 'accepted'
           )
         )`,
        [id, userId]
      );

      if (accessCheck.rows.length === 0) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Get entry
      const result = await pool.query(
        `SELECT 
          e.*,
          u.username as owner_username,
          u.full_name as owner_name,
          (
            SELECT role FROM collaborators 
            WHERE entry_id = e.id AND user_id = $2
          ) as my_role
         FROM diary_entries e
         JOIN users u ON e.owner_id = u.id
         WHERE e.id = $1`,
        [id, userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Entry not found' });
      }

      res.json({ entry: result.rows[0] });
    } catch (error) {
      console.error('Get entry error:', error);
      res.status(500).json({ error: 'Failed to get entry' });
    }
  }

  // Create new entry
  static async createEntry(req, res) {
    const userId = req.user.userId || req.user.id;
    if (!userId) {
      return res.status(401).json({ error: 'Invalid token payload' });
    }
    const username = req.user.username || "Someone";
    const { title, content = [], coverImage, isPrivate = true } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    try {
      const entryId = crypto.randomUUID();
      const result = await pool.query(
        `INSERT INTO diary_entries (id, owner_id, title, content, cover_image, is_private)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [entryId, userId, title, JSON.stringify(content), coverImage, isPrivate]
      );

      const entry = result.rows[0];

      // ✅ Notify collaborators/owner group (if any exist)
      // (Usually none exist right at creation, but safe + meets requirement)
      try {
        const recipients = await getEntryRecipients(entry.id, userId);
        if (recipients.length > 0) {
          await NotificationService.createBatchNotifications(
            recipients.map((recipientId) => ({
              recipientId,
              senderId: userId,
              type: "entry_created",
              entityType: "diary_entry",
              entityId: entry.id,
              title: "New diary entry",
              message: `${username} created "${entry.title}"`,
              metadata: { entryId: entry.id, entryTitle: entry.title }
            }))
          );
        }
      } catch (notifErr) {
        console.error("Create-entry notification failed:", notifErr.message);
      }

      res.status(201).json({
        message: 'Entry created',
        entry
      });
    } catch (error) {
      console.error('Create entry error:', error);
      res.status(500).json({ error: 'Failed to create entry' });
    }
  }

  // Update entry
  static async updateEntry(req, res) {
    const userId = req.user.userId || req.user.id;
    if (!userId) {
      return res.status(401).json({ error: 'Invalid token payload' });
    }
    const username = req.user.username || "Someone";
    const { id } = req.params;
    const { title, content, coverImage, isPrivate } = req.body;

    try {
      // Check if user can edit (owner or editor)
      const accessCheck = await pool.query(
        `SELECT 1 FROM diary_entries 
         WHERE id = $1 AND (
           owner_id = $2 
           OR id IN (
             SELECT entry_id FROM collaborators 
             WHERE user_id = $2 AND status = 'accepted' AND role = 'editor'
           )
         )`,
        [id, userId]
      );

      if (accessCheck.rows.length === 0) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Build update query dynamically
      const updates = [];
      const values = [];
      let paramCount = 1;

      if (title !== undefined) {
        updates.push(`title = $${paramCount++}`);
        values.push(title);
      }
      if (content !== undefined) {
        updates.push(`content = $${paramCount++}`);
        values.push(JSON.stringify(content));
      }
      if (coverImage !== undefined) {
        updates.push(`cover_image = $${paramCount++}`);
        values.push(coverImage);
      }
      if (isPrivate !== undefined) {
        updates.push(`is_private = $${paramCount++}`);
        values.push(isPrivate);
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }

      updates.push(`updated_at = NOW()`);
      values.push(id);

      const query = `
        UPDATE diary_entries 
        SET ${updates.join(', ')}
        WHERE id = $${paramCount}
        RETURNING *
      `;

      const result = await pool.query(query, values);
      const entry = result.rows[0];

      // ✅ Notify owner + accepted collaborators (except actor)
      try {
        const recipients = await getEntryRecipients(id, userId);
        if (recipients.length > 0) {
          await NotificationService.createBatchNotifications(
            recipients.map((recipientId) => ({
              recipientId,
              senderId: userId,
              type: "entry_updated",
              entityType: "diary_entry",
              entityId: Number(id),
              title: "Diary entry updated",
              message: `${username} updated "${entry.title}"`,
              metadata: { entryId: Number(id), entryTitle: entry.title }
            }))
          );
        }
      } catch (notifErr) {
        console.error("Update-entry notification failed:", notifErr.message);
      }

      res.json({
        message: 'Entry updated',
        entry
      });
    } catch (error) {
      console.error('Update entry error:', error);
      res.status(500).json({ error: 'Failed to update entry' });
    }
  }

  // Delete entry
  static async deleteEntry(req, res) {
    const userId = req.user.userId || req.user.id;
    if (!userId) {
      return res.status(401).json({ error: 'Invalid token payload' });
    }
    const username = req.user.username || "Someone";
    const { id } = req.params;

    try {
      // Fetch entry BEFORE deleting so we can notify with title/owner_id
      const entryRes = await pool.query(
        `SELECT id, title, owner_id FROM diary_entries WHERE id = $1`,
        [id]
      );
      if (entryRes.rows.length === 0) {
        return res.status(404).json({ error: "Entry not found" });
      }
      const entry = entryRes.rows[0];

      // Only owner can delete
      const result = await pool.query(
        `DELETE FROM diary_entries 
         WHERE id = $1 AND owner_id = $2
         RETURNING id`,
        [id, userId]
      );

      if (result.rows.length === 0) {
        return res.status(403).json({ error: 'Only owner can delete entry' });
      }

      // ✅ Notify collaborators (and owner group except actor)
      try {
        const collabRes = await pool.query(
          `SELECT user_id FROM collaborators WHERE entry_id = $1 AND status = 'accepted'`,
          [id]
        );

        const recipients = [...new Set([entry.owner_id, ...collabRes.rows.map(r => r.user_id)])]
          .filter(uid => uid !== userId);

        if (recipients.length > 0) {
          await NotificationService.createBatchNotifications(
            recipients.map((recipientId) => ({
              recipientId,
              senderId: userId,
              type: "entry_deleted",
              entityType: "diary_entry",
              entityId: Number(id),
              title: "Diary entry deleted",
              message: `${username} deleted "${entry.title}"`,
              metadata: { entryId: Number(id), entryTitle: entry.title }
            }))
          );
        }
      } catch (notifErr) {
        console.error("Delete-entry notification failed:", notifErr.message);
      }

      res.json({ message: 'Entry deleted' });
    } catch (error) {
      console.error('Delete entry error:', error);
      res.status(500).json({ error: 'Failed to delete entry' });
    }
  }
}

module.exports = EntriesController;
