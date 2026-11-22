import { useId } from 'react'
import styles from './TextField.module.css'

// A labelled input. error replaces helper and marks the field invalid, so a
// screen reader announces the message with the field.
export function TextField({ label, error, helper, id, ...inputProps }) {
  const generated = useId()
  const inputId = id ?? generated
  const noteId = `${inputId}-note`
  const note = error || helper
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={inputId}>
        {label}
      </label>
      <input
        id={inputId}
        className={`${styles.input} ${error ? styles.inputError : ''}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={note ? noteId : undefined}
        {...inputProps}
      />
      {note && (
        <p id={noteId} className={error ? styles.error : styles.helper}>
          {note}
        </p>
      )}
    </div>
  )
}
