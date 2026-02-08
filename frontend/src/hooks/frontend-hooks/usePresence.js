import { useState, useEffect } from "react";
import { useWebSocket } from "./useWebSocket";

/**
 * usePresence hook
 * Tracks online and offline friends
 */
export function usePresence(token) {
  const { on, off } = useWebSocket(token);

  const [onlineUsers, setOnlineUsers] = useState([]);
  const [offlineUsers, setOfflineUsers] = useState([]);

  useEffect(() => {
    if (!on || !off) return;

    // FRIEND_ONLINE event
    const handleFriendOnline = ({ userId }) => {
      setOnlineUsers((prev) => {
        if (prev.includes(userId)) return prev;
        return [...prev, userId];
      });
      setOfflineUsers((prev) => prev.filter((id) => id !== userId));
    };

    // FRIEND_OFFLINE event
    const handleFriendOffline = ({ userId }) => {
      setOnlineUsers((prev) => prev.filter((id) => id !== userId));
      setOfflineUsers((prev) => {
        if (prev.includes(userId)) return prev;
        return [...prev, userId];
      });
    };

    // FRIENDS_LIST initial data
    const handleFriendsList = ({ onlineFriends = [], offlineFriends = [] }) => {
      setOnlineUsers(onlineFriends);
      setOfflineUsers(offlineFriends);
    };

    // Register socket listeners
    on("friend_online", handleFriendOnline);
    on("friend_offline", handleFriendOffline);
    on("friends_list", handleFriendsList);

    // Cleanup listeners on unmount
    return () => {
      off("friend_online", handleFriendOnline);
      off("friend_offline", handleFriendOffline);
      off("friends_list", handleFriendsList);
    };
  }, [on, off]);

  return { onlineUsers, offlineUsers };
}
