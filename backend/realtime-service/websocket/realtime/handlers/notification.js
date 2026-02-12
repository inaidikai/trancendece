/**
 * Notification Handlers
 * WebSocket event handlers for the notification system
 */

const NotificationService = require('../services/notificationService');
const { NOTIFICATION_WS_EVENTS, NOTIFICATION_CHANNELS, NOTIFICATION_STATUS } = require('../constants/notificationWsEvents');

/**
 * Emit notification to a specific user
 */
async function emitNotificationToUser(io, userId, notification) {
  try {
    // Find user's socket
    const userSockets = await io.in(`user_${userId}`).fetchSockets();
    
    if (userSockets.length > 0) {
      io.to(`user_${userId}`).emit(NOTIFICATION_WS_EVENTS.NOTIFICATION_CREATED, {
        notification,
        timestamp: Date.now(),
      });

      // Update delivery status
      await NotificationService.updateDeliveryStatus(
        notification.id,
        NOTIFICATION_CHANNELS.WEBSOCKET,
        NOTIFICATION_STATUS.DELIVERED
      );

      return true;
    }
    
    return false;
  } catch (error) {
    console.error('[NotificationHandler] Emit error:', error);
    
    // Mark delivery as failed
    await NotificationService.updateDeliveryStatus(
      notification.id,
      NOTIFICATION_CHANNELS.WEBSOCKET,
      NOTIFICATION_STATUS.FAILED,
      error.message
    );
    
    return false;
  }
}

/**
 * Emit notification to multiple users
 */
async function emitNotificationToUsers(io, userIds, notification) {
  const results = await Promise.allSettled(
    userIds.map(userId => emitNotificationToUser(io, userId, notification))
  );
  
  return results.map((result, index) => ({
    userId: userIds[index],
    success: result.status === 'fulfilled' && result.value,
  }));
}

/**
 * Emit batch notification summary
 */
async function emitBatchNotification(io, userId, batch) {
  try {
    const userSockets = await io.in(`user_${userId}`).fetchSockets();
    
    if (userSockets.length > 0) {
      io.to(`user_${userId}`).emit(NOTIFICATION_WS_EVENTS.NOTIFICATION_BATCH, {
        batch,
        timestamp: Date.now(),
      });
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('[NotificationHandler] Emit batch error:', error);
    return false;
  }
}

/**
 * Handle notification subscription
 */
async function handleSubscribe(socket, userId) {
  try {
    // Join user-specific room for notifications
    await socket.join(`user_${userId}`);
    
    // Send current unread count
    const unreadCount = await NotificationService.getUnreadCount(userId);
    
    socket.emit(NOTIFICATION_WS_EVENTS.NOTIFICATION_SUBSCRIBED, {
      userId,
      unreadCount,
      timestamp: Date.now(),
    });

    console.log(`📬 User ${userId} subscribed to notifications`);
  } catch (error) {
    console.error('[NotificationHandler] Subscribe error:', error);
    socket.emit('error', {
      code: 'NOTIFICATION_SUBSCRIBE_ERROR',
      message: 'Failed to subscribe to notifications',
    });
  }
}

/**
 * Handle notification unsubscribe
 */
async function handleUnsubscribe(socket, userId) {
  try {
    await socket.leave(`user_${userId}`);
    console.log(`📭 User ${userId} unsubscribed from notifications`);
  } catch (error) {
    console.error('[NotificationHandler] Unsubscribe error:', error);
  }
}

/**
 * Handle get notifications list
 */
async function handleGetNotifications(socket, userId, options = {}) {
  try {
    const notifications = await NotificationService.getNotifications(userId, options);
    
    socket.emit(NOTIFICATION_WS_EVENTS.NOTIFICATION_LIST_RESPONSE, {
      notifications,
      total: notifications.length,
      ...options,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('[NotificationHandler] Get notifications error:', error);
    socket.emit('error', {
      code: 'NOTIFICATION_LIST_ERROR',
      message: 'Failed to fetch notifications',
    });
  }
}

/**
 * Handle get unread count
 */
async function handleGetUnreadCount(socket, userId) {
  try {
    const count = await NotificationService.getUnreadCount(userId);
    
    socket.emit(NOTIFICATION_WS_EVENTS.NOTIFICATION_COUNT_RESPONSE, {
      count,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('[NotificationHandler] Get count error:', error);
    socket.emit('error', {
      code: 'NOTIFICATION_COUNT_ERROR',
      message: 'Failed to fetch notification count',
    });
  }
}

/**
 * Handle mark as read
 */
async function handleMarkAsRead(io, socket, userId, { notificationIds }) {
  try {
    const updatedCount = await NotificationService.markAsRead(userId, notificationIds);
    const newUnreadCount = await NotificationService.getUnreadCount(userId);
    
    socket.emit(NOTIFICATION_WS_EVENTS.NOTIFICATION_READ_SUCCESS, {
      updatedCount,
      unreadCount: newUnreadCount,
      notificationIds,
      timestamp: Date.now(),
    });

    // Broadcast updated count to all user's connected clients
    io.to(`user_${userId}`).emit(NOTIFICATION_WS_EVENTS.NOTIFICATION_COUNT_RESPONSE, {
      count: newUnreadCount,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('[NotificationHandler] Mark as read error:', error);
    socket.emit('error', {
      code: 'NOTIFICATION_READ_ERROR',
      message: 'Failed to mark notifications as read',
    });
  }
}

/**
 * Handle mark as unread
 */
async function handleMarkAsUnread(io, socket, userId, { notificationId }) {
  try {
    await NotificationService.markAsUnread(userId, notificationId);
    const newUnreadCount = await NotificationService.getUnreadCount(userId);
    
    // Broadcast updated count to all user's connected clients
    io.to(`user_${userId}`).emit(NOTIFICATION_WS_EVENTS.NOTIFICATION_COUNT_RESPONSE, {
      count: newUnreadCount,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('[NotificationHandler] Mark as unread error:', error);
    socket.emit('error', {
      code: 'NOTIFICATION_UNREAD_ERROR',
      message: 'Failed to mark notification as unread',
    });
  }
}

/**
 * Handle mark all as read
 */
async function handleMarkAllAsRead(io, socket, userId) {
  try {
    const updatedCount = await NotificationService.markAsRead(userId);
    
    socket.emit(NOTIFICATION_WS_EVENTS.NOTIFICATION_READ_SUCCESS, {
      updatedCount,
      unreadCount: 0,
      timestamp: Date.now(),
    });

    // Broadcast to all user's connected clients
    io.to(`user_${userId}`).emit(NOTIFICATION_WS_EVENTS.NOTIFICATION_COUNT_RESPONSE, {
      count: 0,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('[NotificationHandler] Mark all as read error:', error);
    socket.emit('error', {
      code: 'NOTIFICATION_READ_ALL_ERROR',
      message: 'Failed to mark all notifications as read',
    });
  }
}

/**
 * Handle archive notifications
 */
async function handleArchive(socket, userId, { notificationIds }) {
  try {
    await NotificationService.archiveNotifications(userId, notificationIds);
    
    socket.emit(NOTIFICATION_WS_EVENTS.NOTIFICATION_ARCHIVE_SUCCESS, {
      notificationIds,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('[NotificationHandler] Archive error:', error);
    socket.emit('error', {
      code: 'NOTIFICATION_ARCHIVE_ERROR',
      message: 'Failed to archive notifications',
    });
  }
}

/**
 * Handle unarchive notifications
 */
async function handleUnarchive(socket, userId, { notificationIds }) {
  try {
    await NotificationService.unarchiveNotifications(userId, notificationIds);
    
    socket.emit(NOTIFICATION_WS_EVENTS.NOTIFICATION_ARCHIVE_SUCCESS, {
      notificationIds,
      archived: false,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('[NotificationHandler] Unarchive error:', error);
    socket.emit('error', {
      code: 'NOTIFICATION_UNARCHIVE_ERROR',
      message: 'Failed to unarchive notifications',
    });
  }
}

/**
 * Handle get preferences
 */
async function handleGetPreferences(socket, userId) {
  try {
    const preferences = await NotificationService.getPreferences(userId);
    
    socket.emit(NOTIFICATION_WS_EVENTS.NOTIFICATION_PREFERENCES_RESPONSE, {
      preferences,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('[NotificationHandler] Get preferences error:', error);
    socket.emit('error', {
      code: 'NOTIFICATION_PREFERENCES_ERROR',
      message: 'Failed to fetch preferences',
    });
  }
}

/**
 * Handle update preferences
 */
async function handleUpdatePreferences(socket, userId, { preferences }) {
  try {
    const updated = await NotificationService.updatePreferences(userId, preferences);
    
    socket.emit(NOTIFICATION_WS_EVENTS.NOTIFICATION_PREFERENCES_RESPONSE, {
      preferences: updated,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('[NotificationHandler] Update preferences error:', error);
    socket.emit('error', {
      code: 'NOTIFICATION_PREFERENCES_UPDATE_ERROR',
      message: 'Failed to update preferences',
    });
  }
}

/**
 * Register all notification handlers
 */
function registerNotificationHandlers(io, socket) {
  const userId = socket.data.userId;

  // Subscribe to notifications on connection
  handleSubscribe(socket, userId);

  // List and query handlers
  socket.on(NOTIFICATION_WS_EVENTS.NOTIFICATION_LIST_REQUEST, (data) => {
    handleGetNotifications(socket, userId, data);
  });

  socket.on(NOTIFICATION_WS_EVENTS.NOTIFICATION_COUNT_REQUEST, () => {
    handleGetUnreadCount(socket, userId);
  });

  // Read/Unread handlers
  socket.on(NOTIFICATION_WS_EVENTS.NOTIFICATION_MARK_READ, (data) => {
    handleMarkAsRead(io, socket, userId, data);
  });

  socket.on(NOTIFICATION_WS_EVENTS.NOTIFICATION_MARK_UNREAD, (data) => {
    handleMarkAsUnread(io, socket, userId, data);
  });

  socket.on(NOTIFICATION_WS_EVENTS.NOTIFICATION_MARK_ALL_READ, () => {
    handleMarkAllAsRead(io, socket, userId);
  });

  // Archive handlers
  socket.on(NOTIFICATION_WS_EVENTS.NOTIFICATION_ARCHIVE, (data) => {
    handleArchive(socket, userId, data);
  });

  socket.on(NOTIFICATION_WS_EVENTS.NOTIFICATION_UNARCHIVE, (data) => {
    handleUnarchive(socket, userId, data);
  });

  // Preferences handlers
  socket.on(NOTIFICATION_WS_EVENTS.NOTIFICATION_PREFERENCES_GET, () => {
    handleGetPreferences(socket, userId);
  });

  socket.on(NOTIFICATION_WS_EVENTS.NOTIFICATION_PREFERENCES_UPDATE, (data) => {
    handleUpdatePreferences(socket, userId, data);
  });

  // Subscription handlers
  socket.on(NOTIFICATION_WS_EVENTS.NOTIFICATION_SUBSCRIBE, () => {
    handleSubscribe(socket, userId);
  });

  socket.on(NOTIFICATION_WS_EVENTS.NOTIFICATION_UNSUBSCRIBE, () => {
    handleUnsubscribe(socket, userId);
  });

  console.log(`📬 Notification handlers registered for user ${userId}`);
}

module.exports = {
  registerNotificationHandlers,
  emitNotificationToUser,
  emitNotificationToUsers,
  emitBatchNotification,
};