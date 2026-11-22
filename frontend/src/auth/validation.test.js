import assert from 'node:assert/strict'
import { test } from 'node:test'
import { authErrorMessage, MESSAGES, validateLogin, validateRegistration } from './validation.js'

const good = { name: 'Amina Wanjiru', email: 'amina.wanjiru@example.com', password: 'secret1', confirm: 'secret1', role: 'client' }

test('a complete registration passes', () => {
  assert.deepEqual(validateRegistration(good), {})
})

test('the figure 4.6 email error', () => {
  assert.deepEqual(validateRegistration({ ...good, email: 'amina.wanjiru@' }), { email: MESSAGES.email })
})

test('every registration rule', () => {
  const errors = validateRegistration({ name: '   ', email: 'no-at-sign', password: '12345', confirm: '1234', role: '' })
  assert.deepEqual(Object.keys(errors).sort(), ['confirm', 'email', 'name', 'password', 'role'])
  assert.equal(validateRegistration({ ...good, name: 'x'.repeat(101) }).name, MESSAGES.nameTooLong)
})

test('log in needs an email and a password', () => {
  assert.deepEqual(validateLogin({ email: ' amina.wanjiru@example.com ', password: 'x' }), {})
  assert.deepEqual(validateLogin({ email: '', password: '' }), { email: MESSAGES.email, password: MESSAGES.passwordMissing })
})

test('Supabase errors go under the right field', () => {
  assert.deepEqual(authErrorMessage({ code: 'user_already_exists', message: 'User already registered' }), {
    field: 'email',
    message: MESSAGES.emailInUse,
  })
  assert.deepEqual(authErrorMessage({ message: 'User already registered' }).field, 'email')
  assert.deepEqual(authErrorMessage({ code: 'weak_password', message: 'Password should be at least 8 characters.' }), {
    field: 'password',
    message: 'Password should be at least 8 characters.',
  })
  assert.deepEqual(authErrorMessage({ code: 'invalid_credentials', message: 'Invalid login credentials' }), {
    field: null,
    message: MESSAGES.credentials,
  })
  assert.equal(authErrorMessage({ message: 'Network down' }).message, 'Network down')
})
