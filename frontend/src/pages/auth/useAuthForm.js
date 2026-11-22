import { useState } from 'react'
import { authErrorMessage } from '../../auth/validation.js'
import { focusFirstError } from './focusFirstError.js'

// Form state shared by registration and log in. Errors appear after the
// first submit and then update as the user types, so a fixed field clears
// at once. A Supabase error lands under the field it is about.
export function useAuthForm({ initial, validate, submit }) {
  const [values, setValues] = useState(initial)
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState(null)
  const [submitted, setSubmitted] = useState(false)
  const [busy, setBusy] = useState(false)

  function onChange(name, value) {
    const next = { ...values, [name]: value }
    setValues(next)
    if (submitted) setErrors(validate(next))
  }

  async function onSubmit(event) {
    event.preventDefault()
    const form = event.currentTarget
    setSubmitted(true)
    setFormError(null)
    const found = validate(values)
    setErrors(found)
    if (Object.keys(found).length > 0) {
      focusFirstError(form)
      return
    }
    setBusy(true)
    try {
      await submit(values)
      // On success AuthProvider loads the account and PublicOnly moves on,
      // so the button stays busy until the page changes.
    } catch (err) {
      const { field, message } = authErrorMessage(err)
      if (field) {
        setErrors({ [field]: message })
        focusFirstError(form)
      } else {
        setFormError(message)
      }
      setBusy(false)
    }
  }

  return { values, errors, formError, busy, onChange, onSubmit }
}
