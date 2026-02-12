// backend/realtime-service/websocket/registerlala.js

const WS_EVENTS = require("./realtime/constants/wsEvents");
const DIARY_SOCIAL_WS_EVENTS = require("./realtime/constants/diarySocialWsEvent");
const DIARY_COLLAB_WS_EVENTS = require("./realtime/constants/diaryCollabWsEvents");

// handlers (these are modules, not “registerX” functions)
<<<<<<<< HEAD:backend/realtime-service/websocket/registerLola.js
const presence = require("./realtime/handlers/presence");
const friends = require("./realtime/handlers/friends");
const collab = require("./realtime/handlers/collaboration");
const registerNotifications = require("./realtime/handlers/notification");
========
const presence = require("./realtime/handlers/presence");
const friends = require("./realtime/handlers/friends");
const collab = require("./realtime/handlers/collaboration");
const { registerNotificationHandlers } = require("./realtime/handlers/notification");
>>>>>>>> 040a8b1928d6342a2e5e500fe673f664630194de:backend/realtime-service/websocket/registerlala.js

// --------------------
// Socket-friendly rate limit
// --------------------
const RATE_LIMIT = 10; // events per second
const userEventCounts = new Map();

function checkRateLimit(userId) {
  const now = Date.now();
  const windowMs = 1000;

  let data = userEventCounts.get(userId);
  if (!data) {
    data = { count: 0, lastReset: now };
    userEventCounts.set(userId, data);
  }

  if (now - data.lastReset > windowMs) {
    data.count = 0;
    data.lastReset = now;
  }

  data.count += 1;
  return data.count <= RATE_LIMIT;
}

// --------------------
// In-memory store (shared across sockets)
// --------------------
const cursorStore = new Map(); // entryId -> Map(userId -> cursorData)

// --------------------
// Main register
// --------------------
<<<<<<<< HEAD:backend/realtime-service/websocket/registerLola.js
module.exports = async function registerLola(io, socket) {
  const userId = socket.data.userId;
  socket.join(`user_${socket.data.userId}`);
========
module.exports = async function registerLola(io, socket) {
  const userId = socket.data.userId;
  socket.join(`user_${socket.data.userId}`);
>>>>>>>> 040a8b1928d6342a2e5e500fe673f664630194de:backend/realtime-service/websocket/registerlala.js

  // minimal baseline
  socket.emit("ready", { userId });
  socket.on("ping", () => socket.emit("pong"));

  // (Optional but recommended) Presence “online”
  // Only call these if they exist in your presence module.
  try {
    if (presence?.setUserOnline) await presence.setUserOnline(userId, socket.id, io);
  } catch (e) {
    console.error("setUserOnline failed:", e.message);
  }

  // (Optional) send friends list if implemented
  try {
    if (friends?.sendFriendsList) await friends.sendFriendsList(socket, userId);
  } catch (e) {
    console.error("sendFriendsList failed:", e.message);
  }

  // Collaboration wiring (THIS is the important one)
  collab.registerCollaborationHandlers(io, socket, cursorStore, checkRateLimit);

  // Rooms lifecycle + state request (only if your frontend emits these)
  socket.on(DIARY_COLLAB_WS_EVENTS.JOIN_ENTRY_ROOM, async ({ entryId }) => {
    if (!entryId) return;
    await collab.joinEntryRoom(io, socket, userId, entryId);
  });

  socket.on(DIARY_COLLAB_WS_EVENTS.LEAVE_ENTRY_ROOM, async ({ entryId }) => {
    if (!entryId) return;
    await collab.leaveEntryRoom(io, socket, userId, entryId, cursorStore);
  });

<<<<<<<< HEAD:backend/realtime-service/websocket/registerLola.js
  socket.on(DIARY_COLLAB_WS_EVENTS.STATE_REQUEST, async ({ entryId }) => {
    if (!entryId) return;
    await collab.handleStateRequest(io, socket, userId, entryId);
  });

  registerNotifications(io, socket);

  // Disconnect cleanup
  socket.on("disconnect", async () => {
========
  socket.on(DIARY_COLLAB_WS_EVENTS.STATE_REQUEST, async ({ entryId }) => {
    if (!entryId) return;
    await collab.handleStateRequest(io, socket, userId, entryId);
  });

  registerNotificationHandlers(io, socket);

  // Disconnect cleanup
  socket.on("disconnect", async () => {
>>>>>>>> 040a8b1928d6342a2e5e500fe673f664630194de:backend/realtime-service/websocket/registerlala.js
    try {
      if (presence?.setUserOffline) await presence.setUserOffline(userId, io);
    } catch (e) {
      console.error("setUserOffline failed:", e.message);
    }
  });
};
