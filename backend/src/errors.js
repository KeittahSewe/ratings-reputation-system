// An error the API means to send. The error handler in app.js turns it into
// { error: { code, message } } with this status.
export class ApiError extends Error {
  constructor(status, code, message) {
    super(message)
    this.status = status
    this.code = code
  }
}
