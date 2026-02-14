const pool = require('../db/connection');
const NotificationService = require('../services/notificationService');
const ActivityLogService = require('../services/activityLogService');
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
      const entryMetaResult = await pool.query(
        `SELECT 
           e.id,
           e.owner_id,
           owner.username AS owner_username,
           COALESCE(e.diary_type, CASE WHEN e.is_private THEN 'private' ELSE 'collaborative' END) AS diary_type
         FROM diary_entries e
         JOIN users owner ON owner.id = e.owner_id
         WHERE e.id = $1`,
        [entryId]
      );

      if (entryMetaResult.rows.length === 0) {
        return res.status(404).json({ error: 'Entry not found' });
      }

      const entryMeta = entryMetaResult.rows[0];

      const hasAccess =
        String(entryMeta.owner_id) === String(userId) ||
        (
          entryMeta.diary_type === 'collaborative' &&
          (await pool.query(
            `SELECT 1
             FROM collaborators c
             WHERE c.entry_id = $1
               AND c.user_id = $2
               AND c.status = 'accepted'
             LIMIT 1`,
            [entryId, userId]
          )).rows.length > 0
        );

      if (!hasAccess) {
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
          ) as is_online,
          CASE
            WHEN u.id = $2 THEN TRUE
            ELSE EXISTS (
              SELECT 1
              FROM friends f
              WHERE (f.user_id = $2 AND f.friend_id = u.id)
                 OR (f.user_id = u.id AND f.friend_id = $2)
            )
          END as is_friend_with_me
         FROM collaborators c
         JOIN users u ON c.user_id = u.id
         JOIN users inviter ON c.invited_by = inviter.id
         WHERE c.entry_id = $1
         ORDER BY c.invited_at DESC`,
        [entryId, userId]
      );

      const ownerIsMe = String(entryMeta.owner_id) === String(userId);
      let ownerIsFriendWithMe = ownerIsMe;
      if (!ownerIsMe) {
        const ownerFriendCheck = await pool.query(
          `SELECT 1
           FROM friends
           WHERE (user_id = $1 AND friend_id = $2)
              OR (user_id = $2 AND friend_id = $1)
           LIMIT 1`,
          [userId, entryMeta.owner_id]
        );
        ownerIsFriendWithMe = ownerFriendCheck.rows.length > 0;
      }

      const unmetFriendships = [];
      if (!ownerIsFriendWithMe) {
        unmetFriendships.push({
          user_id: entryMeta.owner_id,
          username: entryMeta.owner_username,
          reason: 'owner_not_friend',
        });
      }

      result.rows.forEach((row) => {
        if (row.status !== 'accepted') return;
        if (String(row.user_id) === String(userId)) return;
        if (row.is_friend_with_me) return;
        unmetFriendships.push({
          user_id: row.user_id,
          username: row.username,
          reason: 'collaborator_not_friend',
        });
      });

      res.json({
        collaborators: result.rows,
        total: result.rows.length,
        owner: {
          id: entryMeta.owner_id,
          username: entryMeta.owner_username,
          is_friend_with_me: ownerIsFriendWithMe,
        },
        unmet_friendships: unmetFriendships,
        collaboration_blocked: unmetFriendships.length > 0,
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
        `SELECT 
           id,
           title,
           owner_id,
           COALESCE(diary_type, CASE WHEN is_private THEN 'private' ELSE 'collaborative' END) AS diary_type
         FROM diary_entries
         WHERE id = $1`,
        [entryId]
      );

      if (entryCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Entry not found' });
      }

      const entry = entryCheck.rows[0];

      if (entry.owner_id !== userId) {
        return res.status(403).json({ error: 'Only owner can invite collaborators' });
      }

      if (entry.diary_type !== 'collaborative') {
        return res.status(400).json({ error: 'Collaborators can only be invited to collaborative diaries' });
      }

      // Check if user is trying to invite themselves
      if (collaboratorId === userId) {
        return res.status(400).json({ error: 'Cannot invite yourself' });
      }

      const [targetUserResult, friendshipResult] = await Promise.all([
        pool.query(`SELECT id FROM users WHERE id = $1`, [collaboratorId]),
        pool.query(
          `SELECT 1
           FROM friends
           WHERE (user_id = $1 AND friend_id = $2)
              OR (user_id = $2 AND friend_id = $1)
           LIMIT 1`,
          [userId, collaboratorId]
        ),
      ]);

      if (targetUserResult.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      if (friendshipResult.rows.length === 0) {
        return res.status(403).json({ error: 'Only friends can be invited as collaborators' });
      }

      // Create invitation (or reopen non-accepted invite)
      const result = await pool.query(
        `INSERT INTO collaborators (id, entry_id, user_id, role, invited_by, status, invited_at, accepted_at)
         VALUES ($1, $2, $3, $4, $5, 'pending', NOW(), NULL)
         ON CONFLICT (entry_id, user_id)
         DO UPDATE SET
           role = EXCLUDED.role,
           invited_by = EXCLUDED.invited_by,
           status = 'pending',
           invited_at = NOW(),
           accepted_at = NULL
         WHERE collaborators.status <> 'accepted'
         RETURNING *`,
        [crypto.randomUUID(), entryId, collaboratorId, role, userId]
      );

      if (result.rows.length === 0) {
        return res.status(400).json({ error: 'User is already an accepted collaborator' });
      }

      const invitation = result.rows[0];

      await ActivityLogService.log({
        userId,
        action: 'collaboration_invited',
        entityType: 'collaborator_invite',
        entityId: invitation.id,
        metadata: {
          entryId,
          collaboratorId,
          role,
        },
      });

      // Get inviter info
      const inviterInfo = await pool.query(
        `SELECT username FROM users WHERE id = $1`,
        [userId]
      );

      const inviterUsername = inviterInfo.rows[0].username;

      try {
        await NotificationService.createNotification({
          recipientId: collaboratorId,
          senderId: userId,
          type: 'collaboration_invite',
          entityType: 'diary_entry',
          entityId: entryId,
          title: 'Collaboration Invite',
          message: `${inviterUsername} invited you to collaborate on "${entry.title}"`,
          metadata: {
            inviteId: invitation.id,
            entryId,
            entryTitle: entry.title,
            inviterId: userId,
            inviterUsername,
            role,
            actionUrl: `/entries/${entryId}/invites`,
            priority: 'high'
          }
        });
      } catch (notifyError) {
        console.error('Collaboration invite notification failed:', notifyError.message);
      }

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
         WHERE c.user_id = $1
           AND c.status = 'pending'
           AND COALESCE(e.diary_type, CASE WHEN e.is_private THEN 'private' ELSE 'collaborative' END) = 'collaborative'
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
        `SELECT c.*, e.title as entry_title, e.owner_id,
                COALESCE(e.diary_type, CASE WHEN e.is_private THEN 'private' ELSE 'collaborative' END) AS diary_type
         FROM collaborators c
         JOIN diary_entries e ON c.entry_id = e.id
         WHERE c.id = $1 AND c.user_id = $2 AND c.status = 'pending'`,
        [inviteId, userId]
      );

      if (inviteResult.rows.length === 0) {
        return res.status(404).json({ error: 'Invite not found' });
      }

      const invite = inviteResult.rows[0];

      if (invite.diary_type !== 'collaborative') {
        return res.status(403).json({ error: 'This invite is no longer valid for a non-collaborative diary' });
      }

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

      await ActivityLogService.log({
        userId,
        action: 'collaboration_invite_accepted',
        entityType: 'collaborator_invite',
        entityId: inviteId,
        metadata: {
          entryId: invite.entry_id,
          ownerId: invite.owner_id,
        },
      });

      const friendshipBlockersResult = await pool.query(
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
        [invite.entry_id, userId]
      );
      const missingFriends = friendshipBlockersResult.rows || [];
      const affectedExistingCollaboratorsResult = await pool.query(
        `SELECT c.user_id, u.username
         FROM collaborators c
         JOIN users u ON u.id = c.user_id
         WHERE c.entry_id = $1
           AND c.status = 'accepted'
           AND c.user_id <> $2
           AND NOT EXISTS (
             SELECT 1
             FROM friends f
             WHERE (f.user_id = $2 AND f.friend_id = c.user_id)
                OR (f.user_id = c.user_id AND f.friend_id = $2)
           )`,
        [invite.entry_id, userId]
      );
      const affectedExistingCollaborators = affectedExistingCollaboratorsResult.rows || [];

      try {
        await NotificationService.createNotification({
          recipientId: invite.owner_id,
          senderId: userId,
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
      } catch (notifyError) {
        console.error('Collaboration accepted notification failed:', notifyError.message);
      }

      if (affectedExistingCollaborators.length > 0) {
        try {
          await NotificationService.createBatchNotifications(
            affectedExistingCollaborators.map((collaborator) => ({
              recipientId: collaborator.user_id,
              senderId: userId,
              type: 'collaboration_friendship_required',
              entityType: 'diary_entry',
              entityId: invite.entry_id,
              title: 'Friendship required to collaborate',
              message: `${username} joined "${invite.entry_title}". Become friends to keep collaborative editing enabled.`,
              metadata: {
                entryId: invite.entry_id,
                entryTitle: invite.entry_title,
                missingFriends: [{ user_id: userId, username }],
                priority: 'medium'
              }
            }))
          );
        } catch (notifyError) {
          console.error('Friendship-required batch notification failed:', notifyError.message);
        }
      }

      if (missingFriends.length > 0) {
        const missingNames = missingFriends
          .map((item) => (item ? item.username : ""))
          .filter(Boolean)
          .join(', ');

        try {
          await NotificationService.createNotification({
            recipientId: userId,
            senderId: invite.owner_id,
            type: 'collaboration_friendship_required',
            entityType: 'diary_entry',
            entityId: invite.entry_id,
            title: 'Friendship required to collaborate',
            message: missingNames
              ? `You joined "${invite.entry_title}", but editing is locked until you are friends with: ${missingNames}.`
              : `You joined "${invite.entry_title}", but editing is locked until required friendships are created.`,
            metadata: {
              entryId: invite.entry_id,
              entryTitle: invite.entry_title,
              ownerId: invite.owner_id,
              missingFriends,
              priority: 'medium'
            }
          });
        } catch (notifyError) {
          console.error('Friendship-required notification failed:', notifyError.message);
        }
      }

      res.json({
        message: 'Invite accepted',
        collaborationBlocked: missingFriends.length > 0,
        missingFriends,
      });
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

      const invite = result.rows[0];

      await ActivityLogService.log({
        userId,
        action: 'collaboration_invite_declined',
        entityType: 'collaborator_invite',
        entityId: inviteId,
        metadata: {
          entryId: invite.entry_id,
          invitedBy: invite.invited_by,
        },
      });

      const [entryInfo, userInfo] = await Promise.all([
        pool.query(`SELECT title FROM diary_entries WHERE id = $1`, [invite.entry_id]),
        pool.query(`SELECT username FROM users WHERE id = $1`, [userId]),
      ]);

      const entryTitle = entryInfo.rows[0]?.title || 'your diary';
      const username = userInfo.rows[0]?.username || 'A user';

      try {
        await NotificationService.createNotification({
          recipientId: invite.invited_by,
          senderId: userId,
          type: 'collaboration_invite_declined',
          entityType: 'diary_entry',
          entityId: invite.entry_id,
          title: 'Invite Declined',
          message: `${username} declined your collaboration invite for "${entryTitle}"`,
          metadata: {
            inviteId: invite.id,
            entryId: invite.entry_id,
            entryTitle,
            collaboratorId: userId,
            collaboratorUsername: username,
            priority: 'low'
          }
        });
      } catch (notifyError) {
        console.error('Collaboration declined notification failed:', notifyError.message);
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
        `SELECT owner_id, title FROM diary_entries WHERE id = $1`,
        [entryId]
      );

      if (entryResult.rows.length === 0) {
        return res.status(404).json({ error: 'Entry not found' });
      }

      const ownerId = entryResult.rows[0].owner_id;
      const entryTitle = entryResult.rows[0].title || 'your diary';
      const isOwnerAction = String(ownerId) === String(userId);
      const isSelfLeave = String(collaboratorId) === String(userId);

      if (!isOwnerAction && !isSelfLeave) {
        return res.status(403).json({ error: 'Only owner can remove collaborators' });
      }

      if (isOwnerAction && isSelfLeave) {
        return res.status(400).json({ error: 'Owner cannot leave their own diary' });
      }

      const userInfo = await pool.query(
        `SELECT username AS actor_username FROM users WHERE id = $1`,
        [userId]
      );

      const result = await pool.query(
        `DELETE FROM collaborators WHERE entry_id = $1 AND user_id = $2 RETURNING id`,
        [entryId, collaboratorId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Collaborator not found' });
      }

      const actorUsername = userInfo.rows[0]?.actor_username || 'A user';

      await ActivityLogService.log({
        userId,
        action: isSelfLeave ? 'collaboration_left' : 'collaboration_removed',
        entityType: 'diary_entry',
        entityId: entryId,
        metadata: {
          collaboratorId,
          ownerId,
        },
      });

      try {
        if (isSelfLeave) {
          await NotificationService.createNotification({
            recipientId: ownerId,
            senderId: userId,
            type: 'collaboration_left',
            entityType: 'diary_entry',
            entityId: entryId,
            title: 'Collaborator Left',
            message: `${actorUsername} left collaboration on "${entryTitle}"`,
            metadata: {
              entryId,
              entryTitle,
              collaboratorId: userId,
              collaboratorUsername: actorUsername,
              priority: 'medium'
            }
          });
        } else {
          await NotificationService.createNotification({
            recipientId: collaboratorId,
            senderId: userId,
            type: 'collaboration_removed',
            entityType: 'diary_entry',
            entityId: entryId,
            title: 'Removed from Collaboration',
            message: `${actorUsername} removed you from "${entryTitle}"`,
            metadata: {
              entryId,
              entryTitle,
              ownerId: userId,
              ownerUsername: actorUsername,
              priority: 'high'
            }
          });
        }
      } catch (notifyError) {
        console.error('Collaboration removal notification failed:', notifyError.message);
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

      await ActivityLogService.log({
        userId,
        action: 'collaboration_role_updated',
        entityType: 'diary_entry',
        entityId: entryId,
        metadata: {
          collaboratorId,
          role,
        },
      });

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
