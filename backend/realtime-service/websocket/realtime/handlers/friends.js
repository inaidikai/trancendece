const pool = require("../config/database");
const MessageFormatter = require("../utils/MessageFormatter");
const DIARY_SOCIAL_WS_EVENTS = require("../constants/diarySocialWsEvent");
const friendsCache = require("../cache/friendsCache");

/**
 * Send friends list to a socket (with caching)
 * @param {Socket} socket - Socket.IO socket
 * @param {string} userId - User ID
 */
async function sendFriendsList(socket, userId) {
  try {
    // Check cache first
    const cached = friendsCache.get(userId);
    if (cached) {
      socket.emit(
        DIARY_SOCIAL_WS_EVENTS.FRIENDS_LIST,
        MessageFormatter.create(
          DIARY_SOCIAL_WS_EVENTS.FRIENDS_LIST,
          cached,
          { userId }
        )
      );
      return;
    }

    // Fetch friends from database
    const rows = await pool.all(
      `
      SELECT f.friend_id, COALESCE((w.is_online = TRUE), false) AS online
      FROM friends f
      LEFT JOIN ws_connections w ON w.user_id = f.friend_id
      WHERE f.user_id = $1
      `,
      [userId]
    );

    const onlineFriends = [];
    const offlineFriends = [];

    rows.forEach(r => {
      r.online ? onlineFriends.push(r.friend_id) : offlineFriends.push(r.friend_id);
    });

    const result = { onlineFriends, offlineFriends };
    
    // Cache the result
    friendsCache.set(userId, result);

    socket.emit(
      DIARY_SOCIAL_WS_EVENTS.FRIENDS_LIST,
      MessageFormatter.create(
        DIARY_SOCIAL_WS_EVENTS.FRIENDS_LIST,
        result,
        { userId }
      )
    );

    console.log(`📋 Friends list sent to ${userId} (${onlineFriends.length} online, ${offlineFriends.length} offline)`);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Error sending friends list:`, err);
    socket.emit(
      DIARY_SOCIAL_WS_EVENTS.FRIENDS_LIST,
      MessageFormatter.error("Failed to fetch friends list", "FRIENDS_ERROR", { userId })
    );
  }
}

/**
 * Invalidate friends cache when friendship status changes
 * @param {string} userId - User ID to invalidate cache for
 */
function invalidateFriendsCache(userId) {
  friendsCache.remove(userId);
}

module.exports = { sendFriendsList, invalidateFriendsCache };
