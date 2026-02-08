const pool = require("../config/database");
const MessageFormatter = require("../utils/MessageFormatter");
const DIARY_COLLAB_WS_EVENTS = require("../constants/diaryCollabWsEvents");

// ============================================
// Cursor Management
// ============================================
function handleCursorMove(io, socket, userId, entryId, position, cursorStore) {
  const room = `entry_${entryId}`;

  if (!cursorStore.has(entryId)) {
    cursorStore.set(entryId, new Map());
  }

  const entryCursors = cursorStore.get(entryId);

  const cursorPayload = {
    userId,
    position,
    timestamp: Date.now(),
  };

  entryCursors.set(userId, cursorPayload);

  // Broadcast to others in the room
  socket.to(room).emit(DIARY_COLLAB_WS_EVENTS.ENTRY_CURSOR_MOVE, cursorPayload);
}

function clearCursor(io, socket, userId, entryId, cursorStore) {
  const room = `entry_${entryId}`;
  const entryCursors = cursorStore.get(entryId);
  if (!entryCursors) return;

  entryCursors.delete(userId);

  if (entryCursors.size === 0) {
    cursorStore.delete(entryId);
  }

  socket.to(room).emit(DIARY_COLLAB_WS_EVENTS.ENTRY_CURSOR_CLEAR, { 
    userId, 
    entryId 
  });
}

// ============================================
// Entry Room Lifecycle
// ============================================
async function joinEntryRoom(io, socket, userId, entryId) {
  const room = `entry_${entryId}`;
  socket.join(room);

  // Insert or update active session
  await pool.run(
    `
    INSERT INTO active_sessions (entry_id, user_id, status, last_seen)
    VALUES ($1, $2, 'viewing', NOW())
    ON CONFLICT (entry_id, user_id)
    DO UPDATE SET status = 'viewing', last_seen = NOW()
    `,
    [entryId, userId]
  );

  // Get current viewers
  const rows = await pool.all(
    `SELECT user_id, status FROM active_sessions WHERE entry_id = $1`,
    [entryId]
  );

  // Send current viewers to the joining user
  socket.emit(DIARY_COLLAB_WS_EVENTS.CURRENT_VIEWERS, {
    entryId,
    viewers: rows,
  });

  // Notify others that this user is viewing
  socket.to(room).emit(DIARY_COLLAB_WS_EVENTS.USER_VIEWING_ENTRY, {
    entryId,
    userId,
    timestamp: Date.now(),
  });
}

async function leaveEntryRoom(io, socket, userId, entryId, cursorStore) {
  const room = `entry_${entryId}`;
  socket.leave(room);

  // Delete active session
  await pool.run(
    `DELETE FROM active_sessions WHERE entry_id = $1 AND user_id = $2`,
    [entryId, userId]
  );

  // Clear cursor
  if (cursorStore && cursorStore.has(entryId)) {
    const cursors = cursorStore.get(entryId);
    cursors.delete(userId);
  }

  // Notify others
  socket.to(room).emit(DIARY_COLLAB_WS_EVENTS.ENTRY_COLLAB_LEAVE, {
    entryId,
    userId,
    timestamp: Date.now(),
  });
}

// ============================================
// Editing State
// ============================================
async function userEditingEntry(io, socket, userId, entryId) {
  await pool.run(
    `UPDATE active_sessions 
     SET status = 'editing', last_seen = NOW() 
     WHERE entry_id = $1 AND user_id = $2`,
    [entryId, userId]
  );

  io.to(`entry_${entryId}`).emit(DIARY_COLLAB_WS_EVENTS.USER_EDITING_ENTRY, {
    entryId,
    userId,
    timestamp: Date.now(),
  });
}

async function userIdleEntry(io, socket, userId, entryId) {
  await pool.run(
    `UPDATE active_sessions 
     SET status = 'idle', last_seen = NOW() 
     WHERE entry_id = $1 AND user_id = $2`,
    [entryId, userId]
  );

  io.to(`entry_${entryId}`).emit(DIARY_COLLAB_WS_EVENTS.USER_IDLE_ENTRY, {
    entryId,
    userId,
    timestamp: Date.now(),
  });
}

// ============================================
// State Request Handler
// ============================================
async function handleStateRequest(io, socket, userId, entryId) {
  try {
    // Fetch entry content from database
    const entry = await pool.get(
      `SELECT content, updated_at FROM diary_entries WHERE id = $1`,
      [entryId]
    );

    if (!entry) {
      socket.emit(DIARY_COLLAB_WS_EVENTS.STATE_RESPONSE, {
        entryId,
        error: "Entry not found",
      });
      return;
    }

    // Fetch current viewers
    const viewers = await pool.all(
      `SELECT user_id, status FROM active_sessions WHERE entry_id = $1`,
      [entryId]
    );

    // Send full state
    socket.emit(DIARY_COLLAB_WS_EVENTS.STATE_RESPONSE, {
      entryId,
      content: entry.content,
      updatedAt: entry.updated_at,
      viewers,
      timestamp: Date.now(),
    });

    console.log(`📡 State sent to ${userId} for entry ${entryId}`);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] State request error:`, err);
    socket.emit(DIARY_COLLAB_WS_EVENTS.STATE_RESPONSE, {
      entryId,
      error: "Failed to fetch state",
    });
  }
}

// ============================================
// Collaboration Event Handlers
// ============================================
const lastEditMap = new Map(); // entryId -> { userId, timestamp }
const debounceMap = new Map(); // socket.id -> timeout
const cursorThrottleMap = new Map(); // socket.id -> lastEmit

function registerCollaborationHandlers(io, socket, cursorStore, checkRateLimit) {
  const userId = socket.data.userId;

  // ============================================
  // ENTRY_EDIT Handler (with debounce & conflict detection)
  // ============================================
  socket.on(DIARY_COLLAB_WS_EVENTS.ENTRY_EDIT, (payload) => {
    const { entryId, content, operation, cursorPosition, timestamp } = payload;
    
    if (!entryId || !timestamp) {
      console.warn(`Invalid ENTRY_EDIT payload from ${userId}`);
      return;
    }

    // Rate limiting
    if (!checkRateLimit(userId)) {
      socket.emit("ERROR", { 
        code: "RATE_LIMIT", 
        message: "Too many edits per second" 
      });
      return;
    }

    const room = `entry_${entryId}`;
    const lastEdit = lastEditMap.get(entryId);

    // Conflict detection (if two edits happen within 300ms)
    if (
      lastEdit &&
      lastEdit.userId !== userId &&
      Math.abs(timestamp - lastEdit.timestamp) < 300
    ) {
      socket.emit(DIARY_COLLAB_WS_EVENTS.CONFLICT_DETECTED, {
        entryId,
        strategy: "last-write-wins",
        timestamp: Date.now(),
      });
    }

    // Clear previous debounce
    if (debounceMap.has(socket.id)) {
      clearTimeout(debounceMap.get(socket.id));
    }

    // Debounce (500ms)
    debounceMap.set(
      socket.id,
      setTimeout(() => {
        const editPayload = {
          entryId,
          content,
          operation,
          cursorPosition,
          userId,
          timestamp: Date.now(),
        };

        // Broadcast to others in the room
        socket.to(room).emit(DIARY_COLLAB_WS_EVENTS.ENTRY_EDIT, editPayload);

        // Update last edit tracking
        lastEditMap.set(entryId, {
          userId,
          timestamp: editPayload.timestamp,
        });

        debounceMap.delete(socket.id);
      }, 500)
    );
  });

  // ============================================
  // ENTRY_CURSOR_MOVE Handler (with throttle)
  // ============================================
  socket.on(DIARY_COLLAB_WS_EVENTS.ENTRY_CURSOR_MOVE, ({ entryId, position }) => {
    if (!entryId || !position) return;

    const lastEmit = cursorThrottleMap.get(socket.id) || 0;
    const now = Date.now();

    // Throttle: max 10 updates/sec (100ms between updates)
    if (now - lastEmit < 100) return;
    
    cursorThrottleMap.set(socket.id, now);

    handleCursorMove(io, socket, userId, entryId, position, cursorStore);
  });

  // ============================================
  // USER_EDITING_ENTRY Handler
  // ============================================
  socket.on(DIARY_COLLAB_WS_EVENTS.USER_EDITING_ENTRY, async ({ entryId }) => {
    if (!entryId) return;
    await userEditingEntry(io, socket, userId, entryId);
  });

  // ============================================
  // USER_IDLE_ENTRY Handler
  // ============================================
  socket.on(DIARY_COLLAB_WS_EVENTS.USER_IDLE_ENTRY, async ({ entryId }) => {
    if (!entryId) return;
    await userIdleEntry(io, socket, userId, entryId);
  });
}

module.exports = {
  registerCollaborationHandlers,
  joinEntryRoom,
  leaveEntryRoom,
  userEditingEntry,
  userIdleEntry,
  handleCursorMove,
  clearCursor,
  handleStateRequest,
};
