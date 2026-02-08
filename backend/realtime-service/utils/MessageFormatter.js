class MessageFormatter {
  /**
   * Create a structured WebSocket message
   * @param {string} event - Event name
   * @param {object} payload - Event payload
   * @param {object} options - Optional metadata
   * @param {string} [options.userId] - Sender's user ID
   * @param {string} [options.roomId] - Room or entry ID
   * @param {object} [options.metadata] - Additional metadata
   * @returns {string} JSON string
   */
  static create(event, payload, { userId = null, roomId = null, metadata = {} } = {}) {
    return JSON.stringify({
      event,
      payload,
      timestamp: Date.now(),
      metadata: {
        ...metadata,
        userId,
        roomId,
      },
    });
  }

  /**
   * Parse a WebSocket message safely
   * @param {string} message
   * @returns {object} { event, payload, timestamp, metadata }
   */
  static parse(message) {
    try {
      const parsed = JSON.parse(message);
      return {
        event: parsed.event,
        payload: parsed.payload,
        timestamp: parsed.timestamp || Date.now(),
        metadata: parsed.metadata || {},
      };
    } catch (error) {
      throw new Error('Invalid message format');
    }
  }

  /**
   * Success response
   * @param {string} event - Event name
   * @param {object} payload - Payload
   * @param {object} options - Optional metadata/userId
   * @returns {string}
   */
  static success(event, payload, options = {}) {
    return this.create(event, payload, {
      ...options,
      metadata: { ...(options.metadata || {}), status: 'success' },
    });
  }

  /**
   * Error response
   * @param {string} message - Error message
   * @param {string} code - Optional error code
   * @param {object} options - Optional metadata/userId
   * @returns {string}
   */
  static error(message, code = 'ERROR', options = {}) {
    return this.create(
      'error',
      { message, code },
      { ...options, metadata: { ...(options.metadata || {}), status: 'error' } }
    );
  }
}

module.exports = MessageFormatter;
