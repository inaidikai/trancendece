const pool = require('../db/connection');

class EntriesController {
  // Get user's entries
  static async getEntries(req, res) {
    const userId = req.user.userId;

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
    const userId = req.user.userId;
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
    const userId = req.user.userId;
    const { title, content = [], coverImage, isPrivate = true } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    try {
      const result = await pool.query(
        `INSERT INTO diary_entries (owner_id, title, content, cover_image, is_private)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [userId, title, JSON.stringify(content), coverImage, isPrivate]
      );

      res.status(201).json({
        message: 'Entry created',
        entry: result.rows[0]
      });
    } catch (error) {
      console.error('Create entry error:', error);
      res.status(500).json({ error: 'Failed to create entry' });
    }
  }

  // Update entry
  static async updateEntry(req, res) {
    const userId = req.user.userId;
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

      res.json({
        message: 'Entry updated',
        entry: result.rows[0]
      });
    } catch (error) {
      console.error('Update entry error:', error);
      res.status(500).json({ error: 'Failed to update entry' });
    }
  }

  // Delete entry
  static async deleteEntry(req, res) {
    const userId = req.user.userId;
    const { id } = req.params;

    try {
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

      res.json({ message: 'Entry deleted' });
    } catch (error) {
      console.error('Delete entry error:', error);
      res.status(500).json({ error: 'Failed to delete entry' });
    }
  }
}

module.exports = EntriesController;