import { useId } from 'react'
import styles from './TextField.module.css'

// A labelled native select, styled like TextField.
export function SelectField({ label, error, options, placeholder, id, ...selectProps }) {
  const generated = useId()
  const selectId = id ?? generated
  const noteId = `${selectId}-note`
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={selectId}>
        {label}
      </label>
      <select
        id={selectId}
        className={`${styles.input} ${error ? styles.inputError : ''}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? noteId : undefined}
        {...selectProps}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && (
        <p id={noteId} className={styles.error}>
          {error}
        </p>
      )}
    </div>
  )
}
