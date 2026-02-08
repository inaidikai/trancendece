const DIARY_COLLAB_WS_EVENTS = {
  /* Invitations */
  COLLAB_INVITE_SENT: 'collab_invite_sent',
  COLLAB_INVITE_RECEIVED: 'collab_invite_received',
  COLLAB_INVITE_ACCEPTED: 'collab_invite_accepted',
  COLLAB_INVITE_DECLINED: 'collab_invite_declined',
  COLLAB_INVITE_REVOKED: 'collab_invite_revoked',

  ENTRY_CURSOR_MOVE: "entry_cursor_move",
  ENTRY_CURSOR_CLEAR: "entry_cursor_clear",

  JOIN_ENTRY_ROOM: "join_entry_room",
  LEAVE_ENTRY_ROOM: "leave_entry_room",

  CURRENT_VIEWERS: "current_viewers",

  /* Entry Session */
  ENTRY_COLLAB_JOIN: 'entry_collab_join',
  ENTRY_COLLAB_LEAVE: 'entry_collab_leave',

  /* Presence (only inside that entry) */
  USER_VIEWING_ENTRY: 'user_viewing_entry',
  USER_EDITING_ENTRY: 'user_editing_entry',
  USER_IDLE_ENTRY: 'user_idle_entry',

  /* Real-time Editing */
  ENTRY_EDIT: 'entry_edit',
  ENTRY_SELECTION_CHANGE: 'entry_selection_change',

  /* Comments */
  COMMENT_ADDED: 'comment_added',
  COMMENT_DELETED: 'comment_deleted',

  ACCESS_DENIED: 'access_denied',
  PERMISSION_GRANTED: 'permission_granted',
  PERMISSION_REVOKED: 'permission_revoked',
  COLLAB_ENDED: 'collab_ended',

  STATE_REQUEST: 'state_request',
  STATE_RESPONSE: 'state_response',
  DESYNC_DETECTED: 'desync_detected',

  /* Permissions */
  ENTRY_PERMISSION_UPDATED: 'entry_permission_updated'
};

module.exports = DIARY_COLLAB_WS_EVENTS;
