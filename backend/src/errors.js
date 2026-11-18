// An error the API means to send. The error handler in app.js turns it into
// { error: { code, message } } with this status.
export class ApiError extends Error {
  constructor(status, code, message) {
    super(message)
    this.status = status
    this.code = code
  }
}

// A 400 for a body or parameter that fails a check. The message names the field.
export function validationError(message) {
  return new ApiError(400, 'validation_failed', message)
}
