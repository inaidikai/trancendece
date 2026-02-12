/**
 * Notification WebSocket Events
 * Events for the complete notification system
 */

const NOTIFICATION_WS_EVENTS = {
  // ============================================
  // NOTIFICATION DELIVERY EVENTS
  // ============================================
  NOTIFICATION_CREATED: 'notification:created',
  NOTIFICATION_UPDATED: 'notification:updated',
  NOTIFICATION_DELETED: 'notification:deleted',
  NOTIFICATION_BATCH: 'notification:batch',
  
  // ============================================
  // NOTIFICATION READ/UNREAD EVENTS
  // ============================================
  NOTIFICATION_MARK_READ: 'notification:mark_read',
  NOTIFICATION_MARK_UNREAD: 'notification:mark_unread',
  NOTIFICATION_MARK_ALL_READ: 'notification:mark_all_read',
  NOTIFICATION_READ_SUCCESS: 'notification:read_success',
  
  // ============================================
  // NOTIFICATION ARCHIVE EVENTS
  // ============================================
  NOTIFICATION_ARCHIVE: 'notification:archive',
  NOTIFICATION_UNARCHIVE: 'notification:unarchive',
  NOTIFICATION_ARCHIVE_SUCCESS: 'notification:archive_success',
  
  // ============================================
  // NOTIFICATION QUERY EVENTS
  // ============================================
  NOTIFICATION_LIST_REQUEST: 'notification:list_request',
  NOTIFICATION_LIST_RESPONSE: 'notification:list_response',
  NOTIFICATION_COUNT_REQUEST: 'notification:count_request',
  NOTIFICATION_COUNT_RESPONSE: 'notification:count_response',
  NOTIFICATION_GET_BY_ID: 'notification:get_by_id',
  
  // ============================================
  // NOTIFICATION PREFERENCE EVENTS
  // ============================================
  NOTIFICATION_PREFERENCES_GET: 'notification:preferences_get',
  NOTIFICATION_PREFERENCES_UPDATE: 'notification:preferences_update',
  NOTIFICATION_PREFERENCES_RESPONSE: 'notification:preferences_response',
  
  // ============================================
  // NOTIFICATION SUBSCRIPTION EVENTS
  // ============================================
  NOTIFICATION_SUBSCRIBE: 'notification:subscribe',
  NOTIFICATION_UNSUBSCRIBE: 'notification:unsubscribe',
  NOTIFICATION_SUBSCRIBED: 'notification:subscribed',
  
  // ============================================
  // NOTIFICATION ACTION EVENTS
  // ============================================
  NOTIFICATION_ACTION_CLICK: 'notification:action_click',
  NOTIFICATION_ACTION_DISMISS: 'notification:action_dismiss',
  NOTIFICATION_ACTION_SNOOZE: 'notification:action_snooze',
};

/**
 * Notification Types
 * Categories of notifications that can be sent
 */
const NOTIFICATION_TYPES = {
  // Diary Entry Notifications
  DIARY_ENTRY_CREATED: 'diary_entry_created',
  DIARY_ENTRY_UPDATED: 'diary_entry_updated',
  DIARY_ENTRY_DELETED: 'diary_entry_deleted',
  DIARY_ENTRY_SHARED: 'diary_entry_shared',
  DIARY_ENTRY_UNSHARED: 'diary_entry_unshared',
  
  // Comment Notifications
  COMMENT_CREATED: 'comment_created',
  COMMENT_UPDATED: 'comment_updated',
  COMMENT_DELETED: 'comment_deleted',
  COMMENT_REPLY: 'comment_reply',
  
  // Friend Notifications
  FRIEND_REQUEST_RECEIVED: 'friend_request_received',
  FRIEND_REQUEST_ACCEPTED: 'friend_request_accepted',
  FRIEND_REQUEST_REJECTED: 'friend_request_rejected',
  FRIEND_REMOVED: 'friend_removed',
  
  // Collaboration Notifications
  COLLABORATION_INVITE: 'collaboration_invite',
  COLLABORATION_JOIN: 'collaboration_join',
  COLLABORATION_LEAVE: 'collaboration_leave',
  COLLABORATION_EDIT: 'collaboration_edit',
  COLLABORATION_CONFLICT: 'collaboration_conflict',
  
  // Social Notifications
  MENTION_RECEIVED: 'mention_received',
  REACTION_RECEIVED: 'reaction_received',
  TAG_ADDED: 'tag_added',
  
  // System Notifications
  SYSTEM_ANNOUNCEMENT: 'system_announcement',
  SYSTEM_UPDATE: 'system_update',
  SYSTEM_MAINTENANCE: 'system_maintenance',
  
  // Activity Notifications
  ACTIVITY_REMINDER: 'activity_reminder',
  ACTIVITY_MILESTONE: 'activity_milestone',
  ACTIVITY_STREAK: 'activity_streak',
};

/**
 * Notification Priorities
 */
const NOTIFICATION_PRIORITIES = {
  LOW: 'low',
  NORMAL: 'normal',
  HIGH: 'high',
  URGENT: 'urgent',
};

/**
 * Notification Delivery Channels
 */
const NOTIFICATION_CHANNELS = {
  WEBSOCKET: 'websocket',
  EMAIL: 'email',
  PUSH: 'push',
  IN_APP: 'in_app',
};

/**
 * Notification Delivery Status
 */
const NOTIFICATION_STATUS = {
  PENDING: 'pending',
  SENT: 'sent',
  DELIVERED: 'delivered',
  FAILED: 'failed',
  READ: 'read',
};

module.exports = {
  NOTIFICATION_WS_EVENTS,
  NOTIFICATION_TYPES,
  NOTIFICATION_PRIORITIES,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_STATUS,
};
