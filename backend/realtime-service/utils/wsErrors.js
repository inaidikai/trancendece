class WSBaseError extends Error {
  constructor(message, code = "WS_ERROR") {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    Error.captureStackTrace(this, this.constructor);
  }
}

class AuthError extends WSBaseError {
  constructor(message = "Authentication failed") {
    super(message, "AUTH_ERROR");
  }
}

class NotFoundError extends WSBaseError {
  constructor(resource = "Resource") {
    super(`${resource} not found`, "NOT_FOUND");
  }
}

class ValidationError extends WSBaseError {
  constructor(message = "Invalid data") {
    super(message, "VALIDATION_ERROR");
  }
}

module.exports = { WSBaseError, AuthError, NotFoundError, ValidationError };
