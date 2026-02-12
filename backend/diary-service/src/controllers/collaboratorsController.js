const pool = require('../db/connection');
const NotificationService = require('../services/notificationService');
const crypto = require('crypto');

class CollaboratorsController {
  // Get collaborators for an entry
  static async getCollaborators(req, res) {
    const { entryId } = req.params;
    const userId = req.user.userId || req.user.id;
    if (!userId) {
      return res.status(401).json({ error: 'Invalid token payload' });
    }

    try {
      // Check if user has access to this entry
      const accessCheck = await pool.query(
        `SELECT 1 FROM diary_entries 
         WHERE id = $1 AND (owner_id = $2 OR id IN (
           SELECT entry_id FROM collaborators 
           WHERE user_id = $2 AND status = 'accepted'
         ))`,
        [entryId, userId]
      );

      if (accessCheck.rows.length === 0) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Get collaborators
      const result = await pool.query(
        `SELECT 
          c.id,
          c.role,
          c.status,
          c.invited_at,
          c.accepted_at,
          u.id as user_id,
          u.username,
          u.full_name,
          COALESCE(to_jsonb(u)->>'avatar_url', to_jsonb(u)->>'avatar') as avatar,
          inviter.username as invited_by_username,
          EXISTS(
            SELECT 1 FROM ws_connections 
            WHERE user_id = u.id AND is_online = TRUE
          ) as is_online
         FROM collaborators c
         JOIN users u ON c.user_id = u.id
         JOIN users inviter ON c.invited_by = inviter.id
         WHERE c.entry_id = $1
         ORDER BY c.invited_at DESC`,
        [entryId]
      );

      res.json({
        collaborators: result.rows,
        total: result.rows.length
      });
    } catch (error) {
      console.error('Get collaborators error:', error);
      res.status(500).json({ error: 'Failed to get collaborators' });
    }
  }

  // Invite user to collaborate
  static async inviteCollaborator(req, res) {
    const { entryId } = req.params;
    const userId = req.user.userId || req.user.id;
    if (!userId) {
      return res.status(401).json({ error: 'Invalid token payload' });
    }
    const { collaboratorId, role = 'editor' } = req.body;

    if (!collaboratorId) {
      return res.status(400).json({ error: 'Collaborator ID is required' });
    }

    if (!['viewer', 'editor'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    try {
      // Check if user owns this entry
      const entryCheck = await pool.query(
        `SELECT title, owner_id FROM diary_entries WHERE id = $1`,
        [entryId]
      );

      if (entryCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Entry not found' });
      }

      const entry = entryCheck.rows[0];

      if (entry.owner_id !== userId) {
        return res.status(403).json({ error: 'Only owner can invite collaborators' });
      }

      // Check if user is trying to invite themselves
      if (collaboratorId === userId) {
        return res.status(400).json({ error: 'Cannot invite yourself' });
      }

      // Check if already invited
      const existingInvite = await pool.query(
        `SELECT * FROM collaborators 
         WHERE entry_id = $1 AND user_id = $2`,
        [entryId, collaboratorId]
      );

      if (existingInvite.rows.length > 0) {
        return res.status(400).json({ error: 'User already invited' });
      }

      // Create invitation
      const result = await pool.query(
        `INSERT INTO collaborators (id, entry_id, user_id, role, invited_by, status)
         VALUES ($1, $2, $3, $4, $5, 'pending')
         RETURNING *`,
        [crypto.randomUUID(), entryId, collaboratorId, role, userId]
      );

      const invitation = result.rows[0];

      // Get inviter info
      const inviterInfo = await pool.query(
        `SELECT username FROM users WHERE id = $1`,
        [userId]
      );

      const inviterUsername = inviterInfo.rows[0].username;

      // Create notification
      await NotificationService.createNotification({
        recipientId: collaboratorId,   // who receives it
  senderId: userId,               // who sent it

  type: 'collaboration_invite',
  entityType: 'diary_entry',
  entityId: entryId,

  title: 'Collaboration Invite',
  message: `${inviterUsername} invited you to collaborate on "${entry.title}"`,

  metadata: {
    inviteId: invitation.id,
    entryId: entryId,
    entryTitle: entry.title,
    inviterId: userId,
    inviterUsername: inviterUsername,
    role: role,
    actionUrl: `/entries/${entryId}/invites`,
    priority: 'high'}
      });

      res.status(201).json({
        message: 'Invitation sent',
        invitation: invitation
      });
    } catch (error) {
      console.error('Invite collaborator error:', error);
      res.status(500).json({ error: 'Failed to send invitation' });
    }
  }

  // Get my collaboration invites
  static async getMyInvites(req, res) {
    const userId = req.user.userId || req.user.id;
    if (!userId) {
      return res.status(401).json({ error: 'Invalid token payload' });
    }

    try {
      const result = await pool.query(
        `SELECT 
          c.id,
          c.role,
          c.invited_at,
          e.id as entry_id,
          e.title as entry_title,
          e.cover_image,
          inviter.id as inviter_id,
          inviter.username as inviter_username,
          inviter.full_name as inviter_name,
          COALESCE(to_jsonb(inviter)->>'avatar_url', to_jsonb(inviter)->>'avatar') as inviter_avatar
         FROM collaborators c
         JOIN diary_entries e ON c.entry_id = e.id
         JOIN users inviter ON c.invited_by = inviter.id
         WHERE c.user_id = $1 AND c.status = 'pending'
         ORDER BY c.invited_at DESC`,
        [userId]
      );

      res.json({
        invites: result.rows,
        total: result.rows.length
      });
    } catch (error) {
      console.error('Get invites error:', error);
      res.status(500).json({ error: 'Failed to get invites' });
    }
  }

  // Accept collaboration invite
  static async acceptInvite(req, res) {
    const userId = req.user.userId || req.user.id;
    if (!userId) {
      return res.status(401).json({ error: 'Invalid token payload' });
    }
    const { inviteId } = req.params;

    try {
      // Get invite details
      const inviteResult = await pool.query(
        `SELECT c.*, e.title as entry_title, e.owner_id
         FROM collaborators c
         JOIN diary_entries e ON c.entry_id = e.id
         WHERE c.id = $1 AND c.user_id = $2 AND c.status = 'pending'`,
        [inviteId, userId]
      );

      if (inviteResult.rows.length === 0) {
        return res.status(404).json({ error: 'Invite not found' });
      }

      const invite = inviteResult.rows[0];

      // Update invite status
      await pool.query(
        `UPDATE collaborators 
         SET status = 'accepted', accepted_at = NOW()
         WHERE id = $1`,
        [inviteId]
      );

      // Get user info
      const userInfo = await pool.query(
        `SELECT username FROM users WHERE id = $1`,
        [userId]
      );

      const username = userInfo.rows[0].username;

      // Notify owner
      await NotificationService.createNotification({
      recipientId: invite.owner_id,  // who receives it
      senderId: userId,              // who accepted (the actor)

      type: 'collaboration_accepted',
      entityType: 'diary_entry',
      entityId: invite.entry_id,

      title: 'Invite Accepted',
      message: `${username} accepted your collaboration invite for "${invite.entry_title}"`,

      metadata: {
        entryId: invite.entry_id,
        collaboratorId: userId,
        collaboratorUsername: username,
        priority: 'medium'
      }
    });


      res.json({ message: 'Invite accepted' });
    } catch (error) {
      console.error('Accept invite error:', error);
      res.status(500).json({ error: 'Failed to accept invite' });
    }
  }

  // Decline collaboration invite
  static async declineInvite(req, res) {
    const userId = req.user.userId || req.user.id;
    if (!userId) {
      return res.status(401).json({ error: 'Invalid token payload' });
    }
    const { inviteId } = req.params;

    try {
      const result = await pool.query(
        `UPDATE collaborators 
         SET status = 'declined'
         WHERE id = $1 AND user_id = $2 AND status = 'pending'
         RETURNING *`,
        [inviteId, userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Invite not found' });
      }

      res.json({ message: 'Invite declined' });
    } catch (error) {
      console.error('Decline invite error:', error);
      res.status(500).json({ error: 'Failed to decline invite' });
    }
  }

  // Remove collaborator
  static async removeCollaborator(req, res) {
    const userId = req.user.userId || req.user.id;
    if (!userId) {
      return res.status(401).json({ error: 'Invalid token payload' });
    }
    const { entryId, collaboratorId } = req.params;

    try {
      const entryResult = await pool.query(
        `SELECT owner_id FROM diary_entries WHERE id = $1`,
        [entryId]
      );

      if (entryResult.rows.length === 0) {
        return res.status(404).json({ error: 'Entry not found' });
      }

      const ownerId = entryResult.rows[0].owner_id;
      const isOwnerAction = String(ownerId) === String(userId);
      const isSelfLeave = String(collaboratorId) === String(userId);

      if (!isOwnerAction && !isSelfLeave) {
        return res.status(403).json({ error: 'Only owner can remove collaborators' });
      }

      if (isOwnerAction && isSelfLeave) {
        return res.status(400).json({ error: 'Owner cannot leave their own diary' });
      }

      const result = await pool.query(
        `DELETE FROM collaborators WHERE entry_id = $1 AND user_id = $2 RETURNING id`,
        [entryId, collaboratorId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Collaborator not found' });
      }

      res.json({ message: isSelfLeave ? 'Left collaboration' : 'Collaborator removed' });
    } catch (error) {
      console.error('Remove collaborator error:', error);
      res.status(500).json({ error: 'Failed to remove collaborator' });
    }
  }

  // Update collaborator permissions
  static async updatePermissions(req, res) {
    const userId = req.user.userId || req.user.id;
    if (!userId) {
      return res.status(401).json({ error: 'Invalid token payload' });
    }
    const { entryId, collaboratorId } = req.params;
    const { role } = req.body;

    if (!['viewer', 'editor'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    try {
      // Check if user is owner
      const ownerCheck = await pool.query(
        `SELECT 1 FROM diary_entries WHERE id = $1 AND owner_id = $2`,
        [entryId, userId]
      );

      if (ownerCheck.rows.length === 0) {
        return res.status(403).json({ error: 'Only owner can update permissions' });
      }

      // Update role
      const result = await pool.query(
        `UPDATE collaborators 
         SET role = $1
         WHERE entry_id = $2 AND user_id = $3 AND status = 'accepted'
         RETURNING *`,
        [role, entryId, collaboratorId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Collaborator not found' });
      }

      res.json({
        message: 'Permissions updated',
        collaborator: result.rows[0]
      });
    } catch (error) {
      console.error('Update permissions error:', error);
      res.status(500).json({ error: 'Failed to update permissions' });
    }
  }
}

module.exports = CollaboratorsController;
