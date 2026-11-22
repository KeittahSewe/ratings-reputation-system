// Checks for the registration and log-in forms (Figure 4.6), and the
// translation of Supabase Auth errors into a message for the right field.
// Pure functions, tested in validation.test.js.

export const PASSWORD_MIN = 6 // Supabase Auth's default minimum
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const MESSAGES = {
  nameMissing: 'Enter your full name.',
  nameTooLong: 'Use 100 characters or fewer.',
  email: 'Enter a valid email address, for example name@example.com',
  passwordShort: `Use at least ${PASSWORD_MIN} characters.`,
  passwordMissing: 'Enter your password.',
  confirm: 'The passwords do not match.',
  role: 'Choose Client or Worker.',
  emailInUse: 'An account with this email already exists. Log in instead.',
  credentials: 'Email or password is incorrect.',
}

// Returns { field: message } for every problem, or {} when the form is fine.
export function validateRegistration({ name, email, password, confirm, role }) {
  const errors = {}
  const trimmed = name.trim()
  if (!trimmed) errors.name = MESSAGES.nameMissing
  else if (trimmed.length > 100) errors.name = MESSAGES.nameTooLong
  if (!EMAIL.test(email.trim())) errors.email = MESSAGES.email
  if (password.length < PASSWORD_MIN) errors.password = MESSAGES.passwordShort
  if (confirm !== password) errors.confirm = MESSAGES.confirm
  if (role !== 'client' && role !== 'worker') errors.role = MESSAGES.role
  return errors
}

export function validateLogin({ email, password }) {
  const errors = {}
  if (!EMAIL.test(email.trim())) errors.email = MESSAGES.email
  if (!password) errors.password = MESSAGES.passwordMissing
  return errors
}

// Supabase Auth errors carry a code. Returns { field, message }, where field
// is the input the message belongs under, or null for a message above the
// button.
export function authErrorMessage(error) {
  const code = error?.code
  const message = error?.message ?? ''
  if (code === 'user_already_exists' || /already registered/i.test(message)) {
    return { field: 'email', message: MESSAGES.emailInUse }
  }
  if (code === 'weak_password') return { field: 'password', message }
  if (code === 'email_address_invalid' || code === 'validation_failed') return { field: 'email', message: MESSAGES.email }
  if (code === 'invalid_credentials') return { field: null, message: MESSAGES.credentials }
  return { field: null, message: message || 'Something went wrong. Try again.' }
}
