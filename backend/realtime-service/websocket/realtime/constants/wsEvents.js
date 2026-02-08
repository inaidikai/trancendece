const WS_EVENTS = {
  /* Connection */
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  AUTHENTICATED: 'authenticated',
  RECONNECT: 'reconnect',

  /* System */
  HEARTBEAT: 'heartbeat',
  PONG: 'pong',
  ERROR: 'error',
  SESSION_EXPIRED: 'session_expired',
  FORCE_LOGOUT: 'force_logout',

  /* Presence Events */
  ONLINE: 'online',
  OFFLINE: 'offline',
  IDLE: 'idle',
  USER_JOINED: 'user_joined',
  USER_LEFT: 'user_left',
  PRESENCE_UPDATE: 'presence_update'
};

module.exports = WS_EVENTS;
