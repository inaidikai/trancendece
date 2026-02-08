import { useState, useEffect, useCallback } from "react";
import { useWebSocket } from "./useWebSocket";

/**
 * useCollaboration hook
 * Manages viewers, cursors, and edits for a single diary entry
 */
export function useCollaboration(token, entryId) {
  const { emit, on, off, connected } = useWebSocket(token);

  const [viewers, setViewers] = useState([]);
  const [cursors, setCursors] = useState({});
  const [content, setContent] = useState("");

  // Join entry room on mount
  const joinEntry = useCallback(() => {
    if (!entryId || !connected) return;
    emit("join_entry_room", { entryId });
  }, [emit, entryId, connected]);

  // Leave entry room
  const leaveEntry = useCallback(() => {
    if (!entryId || !connected) return;
    emit("leave_entry_room", { entryId });
    setCursors({});
    setViewers([]);
  }, [emit, entryId, connected]);

  // Auto-join when connected
  useEffect(() => {
    if (connected && entryId) {
      joinEntry();
    }
    return () => {
      if (connected && entryId) {
        leaveEntry();
      }
    };
  }, [connected, entryId, joinEntry, leaveEntry]);

  // Socket event handlers
  useEffect(() => {
    if (!on || !off || !entryId) return;

    const handleCurrentViewers = ({ viewers: current }) => {
      setViewers(current || []);
    };

    const handleUserViewing = ({ userId }) => {
      setViewers((prev) => {
        const exists = prev.find((v) => v.user_id === userId);
        if (exists) return prev;
        return [...prev, { user_id: userId, status: "viewing" }];
      });
    };

    const handleUserLeave = ({ userId }) => {
      setViewers((prev) => prev.filter((v) => v.user_id !== userId));
      setCursors((prev) => {
        const newCursors = { ...prev };
        delete newCursors[userId];
        return newCursors;
      });
    };

    const handleCursorMove = ({ userId, position }) => {
      setCursors((prev) => ({
        ...prev,
        [userId]: { position, timestamp: Date.now() },
      }));
    };

    const handleCursorClear = ({ userId }) => {
      setCursors((prev) => {
        const newCursors = { ...prev };
        delete newCursors[userId];
        return newCursors;
      });
    };

    const handleEntryEdit = ({ content: newContent }) => {
      setContent(newContent || "");
    };

    const handleStateResponse = ({ content: newContent, viewers: currentViewers }) => {
      if (newContent !== undefined) setContent(newContent);
      if (currentViewers) setViewers(currentViewers);
    };

    // Register listeners
    on("current_viewers", handleCurrentViewers);
    on("user_viewing_entry", handleUserViewing);
    on("entry_collab_leave", handleUserLeave);
    on("entry_cursor_move", handleCursorMove);
    on("entry_cursor_clear", handleCursorClear);
    on("entry_edit", handleEntryEdit);
    on("state_response", handleStateResponse);

    // Cleanup
    return () => {
      off("current_viewers", handleCurrentViewers);
      off("user_viewing_entry", handleUserViewing);
      off("entry_collab_leave", handleUserLeave);
      off("entry_cursor_move", handleCursorMove);
      off("entry_cursor_clear", handleCursorClear);
      off("entry_edit", handleEntryEdit);
      off("state_response", handleStateResponse);
    };
  }, [on, off, entryId]);

  // Send cursor position
  const moveCursor = useCallback(
    (position) => {
      if (!entryId || !connected) return;
      emit("entry_cursor_move", { entryId, position });
    },
    [emit, entryId, connected]
  );

  // Send content edit
  const editContent = useCallback(
    (newContent, operation = "update") => {
      if (!entryId || !connected) return;
      emit("entry_edit", {
        entryId,
        content: newContent,
        operation,
        timestamp: Date.now(),
      });
    },
    [emit, entryId, connected]
  );

  return {
    viewers,
    cursors,
    content,
    joinEntry,
    leaveEntry,
    moveCursor,
    editContent,
  };
}
