const pool = require('../db/connection');
const NotificationService = require("../services/notificationService");
const ActivityLogService = require('../services/activityLogService');
const crypto = require('crypto');

const DIARY_TYPES = {
  PRIVATE: 'private',
  COLLABORATIVE: 'collaborative',
};

function resolveDiaryType({ diaryType, isPrivate }) {
  let normalizedIsPrivate = isPrivate;
  if (typeof isPrivate === 'string') {
    const lowered = isPrivate.toLowerCase();
    if (lowered === 'true') {
      normalizedIsPrivate = true;
    } else if (lowered === 'false') {
      normalizedIsPrivate = false;
    } else {
      return { error: 'isPrivate must be a boolean value.' };
    }
  }

  if (diaryType !== undefined && !Object.values(DIARY_TYPES).includes(diaryType)) {
    return { error: 'Invalid diary type. Use "private" or "collaborative".' };
  }

  if (diaryType !== undefined && normalizedIsPrivate !== undefined) {
    const expected = diaryType === DIARY_TYPES.PRIVATE;
    if (Boolean(normalizedIsPrivate) !== expected) {
      return { error: 'diaryType and isPrivate conflict. Use private=true or collaborative=false.' };
    }
  }

  if (diaryType !== undefined) {
    return {
      diaryType,
      isPrivate: diaryType === DIARY_TYPES.PRIVATE,
    };
  }

  if (normalizedIsPrivate !== undefined) {
    return {
      diaryType: Boolean(normalizedIsPrivate) ? DIARY_TYPES.PRIVATE : DIARY_TYPES.COLLABORATIVE,
      isPrivate: Boolean(normalizedIsPrivate),
    };
  }

  return {
    diaryType: DIARY_TYPES.PRIVATE,
    isPrivate: true,
  };
}

function isSingleDiaryTypeConstraintError(error) {
  const message = String(error?.message || '').toLowerCase();
  return (
    error?.code === '23514' &&
    (message.includes('owner already has a') || message.includes('single_diary_type_per_owner'))
  );
}

// returns array of userIds that should be notified (owner + accepted collaborators), excluding actor
async function getEntryRecipients(entryId, actorId) {
  // Owner
  const ownerRes = await pool.query(
    `SELECT owner_id,
            COALESCE(diary_type, CASE WHEN is_private THEN 'private' ELSE 'collaborative' END) AS diary_type
     FROM diary_entries
     WHERE id = $1`,
    [entryId]
  );
  if (ownerRes.rows.length === 0) return [];

  const ownerId = ownerRes.rows[0].owner_id;
  const diaryType = ownerRes.rows[0].diary_type;
  if (diaryType !== DIARY_TYPES.COLLABORATIVE) {
    return ownerId === actorId ? [] : [ownerId];
  }

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
            SELECT c.role
            FROM collaborators c
            WHERE c.entry_id = e.id
              AND c.user_id = $1
              AND c.status = 'accepted'
            LIMIT 1
          ) AS my_role,
          (
            SELECT COUNT(*) FROM collaborators 
            WHERE entry_id = e.id AND status = 'accepted'
          ) as collaborators_count
         FROM diary_entries e
         WHERE e.owner_id = $1 
            OR (
              COALESCE(e.diary_type, CASE WHEN e.is_private THEN 'private' ELSE 'collaborative' END) = 'collaborative'
              AND EXISTS (
                SELECT 1
                FROM collaborators c
                WHERE c.entry_id = e.id AND c.user_id = $1 AND c.status = 'accepted'
              )
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
        `SELECT 1 FROM diary_entries e
         WHERE id = $1 AND (
           e.owner_id = $2 
           OR (
             COALESCE(e.diary_type, CASE WHEN e.is_private THEN 'private' ELSE 'collaborative' END) = 'collaborative'
             AND EXISTS (
               SELECT 1 FROM collaborators c
               WHERE c.entry_id = e.id AND c.user_id = $2 AND c.status = 'accepted'
             )
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
    const { title, content = [], coverImage, isPrivate, diaryType } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const resolvedPrivacy = resolveDiaryType({ diaryType, isPrivate });
    if (resolvedPrivacy.error) {
      return res.status(400).json({ error: resolvedPrivacy.error });
    }

    try {
      const entryId = crypto.randomUUID();
      const result = await pool.query(
        `INSERT INTO diary_entries (id, owner_id, title, content, cover_image, is_private, diary_type)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          entryId,
          userId,
          title,
          JSON.stringify(content),
          coverImage,
          resolvedPrivacy.isPrivate,
          resolvedPrivacy.diaryType,
        ]
      );

      const entry = result.rows[0];

      await ActivityLogService.log({
        userId,
        action: 'entry_created',
        entityType: 'diary_entry',
        entityId: entry.id,
        metadata: {
          title: entry.title,
          diaryType: entry.diary_type || resolvedPrivacy.diaryType,
        },
      });

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
      if (isSingleDiaryTypeConstraintError(error)) {
        return res
          .status(409)
          .json({ error: 'Each user can only have one private diary and one collaborative diary.' });
      }
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
    const { title, content, coverImage, isPrivate, diaryType } = req.body;

    try {
      // Check if user can edit (owner or editor)
      const accessCheck = await pool.query(
        `SELECT 
           e.owner_id,
           (e.owner_id = $2) AS is_owner
         FROM diary_entries e
         WHERE e.id = $1
           AND (
             e.owner_id = $2 
             OR (
               COALESCE(e.diary_type, CASE WHEN e.is_private THEN 'private' ELSE 'collaborative' END) = 'collaborative'
               AND EXISTS (
                 SELECT 1
                 FROM collaborators c
                 WHERE c.entry_id = e.id
                   AND c.user_id = $2
                   AND c.status = 'accepted'
                   AND c.role = 'editor'
               )
             )
           )`,
        [id, userId]
      );

      if (accessCheck.rows.length === 0) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const isOwner = Boolean(accessCheck.rows[0].is_owner);
      if (!isOwner) {
        const friendshipBlockers = await pool.query(
          `SELECT u.id AS user_id, u.username
           FROM (
             SELECT e.owner_id AS participant_id
             FROM diary_entries e
             WHERE e.id = $1
             UNION
             SELECT c.user_id AS participant_id
             FROM collaborators c
             WHERE c.entry_id = $1
               AND c.status = 'accepted'
           ) participants
           JOIN users u ON u.id = participants.participant_id
           WHERE participants.participant_id <> $2
             AND NOT EXISTS (
               SELECT 1
               FROM friends f
               WHERE (f.user_id = $2 AND f.friend_id = participants.participant_id)
                  OR (f.user_id = participants.participant_id AND f.friend_id = $2)
             )`,
          [id, userId]
        );

        if (friendshipBlockers.rows.length > 0) {
          return res.status(403).json({
            error: 'You must be friends with all collaborators to edit this entry.',
            code: 'COLLAB_FRIENDSHIP_REQUIRED',
            missingFriends: friendshipBlockers.rows,
          });
        }
      }

      if (!isOwner && (isPrivate !== undefined || diaryType !== undefined)) {
        return res.status(403).json({ error: 'Only owner can change diary privacy/type' });
      }

      const privacyPayloadProvided = isPrivate !== undefined || diaryType !== undefined;
      const resolvedPrivacy = privacyPayloadProvided
        ? resolveDiaryType({ diaryType, isPrivate })
        : null;

      if (resolvedPrivacy?.error) {
        return res.status(400).json({ error: resolvedPrivacy.error });
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
      if (resolvedPrivacy) {
        updates.push(`is_private = $${paramCount++}`);
        values.push(resolvedPrivacy.isPrivate);
        updates.push(`diary_type = $${paramCount++}`);
        values.push(resolvedPrivacy.diaryType);
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
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Entry not found' });
      }
      const entry = result.rows[0];

      await ActivityLogService.log({
        userId,
        action: 'entry_updated',
        entityType: 'diary_entry',
        entityId: id,
        metadata: {
          title: entry.title,
          diaryType: entry.diary_type,
          fields: {
            title: title !== undefined,
            content: content !== undefined,
            coverImage: coverImage !== undefined,
            privacy: Boolean(resolvedPrivacy),
          },
        },
      });

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
              entityId: id,
              title: "Diary entry updated",
              message: `${username} updated "${entry.title}"`,
              metadata: { entryId: id, entryTitle: entry.title }
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
      if (isSingleDiaryTypeConstraintError(error)) {
        return res
          .status(409)
          .json({ error: 'Each user can only have one private diary and one collaborative diary.' });
      }
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

      await ActivityLogService.log({
        userId,
        action: 'entry_deleted',
        entityType: 'diary_entry',
        entityId: id,
        metadata: {
          title: entry.title,
        },
      });

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
              entityId: id,
              title: "Diary entry deleted",
              message: `${username} deleted "${entry.title}"`,
              metadata: { entryId: id, entryTitle: entry.title }
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
