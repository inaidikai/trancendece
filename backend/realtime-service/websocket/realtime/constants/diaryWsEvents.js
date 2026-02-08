const DIARY_WS_EVENTS = {
  /* Diary Entries */
  ENTRY_CREATE: 'entry_create',
  ENTRY_UPDATE: 'entry_update',
  ENTRY_DELETE: 'entry_delete',
  ENTRY_FETCH: 'entry_fetch',
  ENTRY_SYNC: 'entry_sync',

  /* Autosave */
  AUTOSAVE: 'autosave',
  SAVE_SUCCESS: 'save_success',
  SAVE_FAILED: 'save_failed',
  CONFLICT_DETECTED: 'conflict_detected',

  /* Metadata */
  TAG_ADD: 'tag_add',
  TAG_REMOVE: 'tag_remove',
  MOOD_UPDATE: 'mood_update',

  /* Entry Lifecycle */
  ENTRY_OPENED: 'entry_opened',
  ENTRY_CLOSED: 'entry_closed'
};

module.exports = DIARY_WS_EVENTS;
