const pool = require("../config/database");
const DIARY_SOCIAL_WS_EVENTS = require("../constants/diarySocialWsEvent");
const { invalidateFriendsCache } = require("./friends");

/**
 * Set a user as online and notify their friends
 * @param {string} userId - User ID
 * @param {string} socketId - Socket.IO socket ID
 * @param {Server} io - Socket.IO server instance
 */
async function setUserOnline(userId, socketId, io) {
  try {
    // Update or insert ws_connections record
    await pool.run(
      `
      INSERT INTO ws_connections(user_id, socket_id, online, last_seen)
      VALUES ($1, $2, true, NOW())
      ON CONFLICT(user_id) DO UPDATE
      SET socket_id = $2, online = true, last_seen = NOW()
      `,
      [userId, socketId]
    );

    // Get friends who should be notified (reverse relationship: who has this user as a friend)
    const friends = await pool.all(
      `SELECT user_id FROM friends WHERE friend_id = $1`,
      [userId]
    );

    // Notify each friend that this user is online
    friends.forEach((friendRow) => {
      const friendId = friendRow.user_id;
      
      // Invalidate friend's cache so they get fresh data
      invalidateFriendsCache(friendId);
      
      // Broadcast to all connected sockets - they'll filter by userId on client side
      io.emit(DIARY_SOCIAL_WS_EVENTS.FRIEND_ONLINE, {
        userId,
        friendId,
        timestamp: Date.now(),
      });
    });

    console.log(`✅ ${userId} is now online`);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Error setting user online:`, err);
    throw err;
  }
}

/**
 * Set a user as offline and notify their friends
 * @param {string} userId - User ID
 * @param {Server} io - Socket.IO server instance
 */
async function setUserOffline(userId, io) {
  try {
    // Update connection status
    await pool.run(
      `UPDATE ws_connections 
       SET online = false, last_seen = NOW() 
       WHERE user_id = $1`,
      [userId]
    );

    // Get friends who should be notified
    const friends = await pool.all(
      `SELECT user_id FROM friends WHERE friend_id = $1`,
      [userId]
    );

    // Notify each friend that this user is offline
    friends.forEach((friendRow) => {
      const friendId = friendRow.user_id;
      
      // Invalidate friend's cache
      invalidateFriendsCache(friendId);
      
      // Broadcast to all connected sockets
      io.emit(DIARY_SOCIAL_WS_EVENTS.FRIEND_OFFLINE, {
        userId,
        friendId,
        timestamp: Date.now(),
      });
    });

    console.log(`❌ ${userId} is now offline`);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Error setting user offline:`, err);
    throw err;
  }
}

/**
 * Get online friends for a user
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Array of online friend objects
 */
async function getOnlineFriends(userId) {
  try {
    const friends = await pool.all(
      `
      SELECT f.friend_id, w.socket_id, w.online
      FROM friends f
      LEFT JOIN ws_connections w ON w.user_id = f.friend_id
      WHERE f.user_id = $1 AND w.online = true
      `,
      [userId]
    );
    return friends;
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Error fetching online friends:`, err);
    return [];
  }
}

module.exports = {
  setUserOnline,
  setUserOffline,
  getOnlineFriends,
};
