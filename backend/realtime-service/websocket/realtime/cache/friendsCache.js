/**
 * In-memory cache for friends lists
 * Stores online/offline status of friends per user
 */

// userId -> { online: [], offline: [] }
const friendsCache = new Map();

module.exports = {
  /**
   * Get cached friends for a user
   * @param {string} userId
   * @returns {object|null} { online: [...], offline: [...] }
   */
  get(userId) {
    return friendsCache.get(userId);
  },

  /**
   * Set cached friends for a user
   * @param {string} userId
   * @param {object} data { online: [...], offline: [...] }
   */
  set(userId, data) {
    friendsCache.set(userId, data);
  },

  /**
   * Remove cached friends for a user
   * @param {string} userId
   */
  remove(userId) {
    friendsCache.delete(userId);
  },

  /**
   * Update online/offline status of a friend
   * @param {string} userId - The user whose cache to update
   * @param {string} friendId - The friend whose status changed
   * @param {boolean} isOnline - Whether friend is online
   */
  updateStatus(userId, friendId, isOnline) {
    const cache = friendsCache.get(userId);
    if (!cache) return;

    if (isOnline) {
      // Remove from offline, add to online
      cache.offline = cache.offline.filter(id => id !== friendId);
      if (!cache.online.includes(friendId)) {
        cache.online.push(friendId);
      }
    } else {
      // Remove from online, add to offline
      cache.online = cache.online.filter(id => id !== friendId);
      if (!cache.offline.includes(friendId)) {
        cache.offline.push(friendId);
      }
    }
  },

  /**
   * Clear all cache
   */
  clear() {
    friendsCache.clear();
  }
};
