import { useId } from 'react'
import fieldStyles from './TextField.module.css'
import styles from './TextArea.module.css'

// A labelled multi-line field. With maxLength it shows a character counter,
// as on the review form in Figure 4.10.
export function TextArea({ label, error, helper, id, value = '', maxLength, rows = 5, ...rest }) {
  const generated = useId()
  const inputId = id ?? generated
  const noteId = `${inputId}-note`
  const note = error || helper
  return (
    <div className={fieldStyles.field}>
      <label className={fieldStyles.label} htmlFor={inputId}>
        {label}
      </label>
      <textarea
        id={inputId}
        className={`${fieldStyles.input} ${styles.textarea} ${error ? fieldStyles.inputError : ''}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={note ? noteId : undefined}
        value={value}
        maxLength={maxLength}
        rows={rows}
        {...rest}
      />
      <div className={styles.footer}>
        {note ? (
          <p id={noteId} className={error ? fieldStyles.error : fieldStyles.helper}>
            {note}
          </p>
        ) : (
          <span />
        )}
        {maxLength && (
          <p className={fieldStyles.helper}>
            {value.length} / {maxLength}
          </p>
        )}
      </div>
    </div>
  )
}
