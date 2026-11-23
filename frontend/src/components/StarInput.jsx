import { useId } from 'react'
import styles from './StarInput.module.css'

const STAR = 'M15 1.7l3.9 8.36 9.17 1.12-6.77 6.28 1.8 9.06L15 22.04 6.9 26.52l1.8-9.06-6.77-6.28 9.17-1.12z'

// The star input of Figure 4.10: five radio buttons drawn as stars, so arrow
// keys move between them and a screen reader announces "3 stars". The words
// "3 of 5 selected" repeat the choice in text.
export function StarInput({ label, value, onChange, error }) {
  const name = useId()
  const errorId = `${name}-error`
  return (
    <fieldset className={styles.fieldset} aria-describedby={error ? errorId : undefined}>
      <legend className={styles.legend}>{label}</legend>
      <div className={styles.row}>
        <div className={styles.stars}>
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className={styles.star}>
              <input
                className="visually-hidden"
                type="radio"
                name={name}
                value={n}
                checked={value === n}
                onChange={() => onChange(n)}
                aria-invalid={error && n === 1 ? true : undefined}
              />
              <svg viewBox="0 0 30 30" width="30" height="30" aria-hidden="true" className={n <= value ? styles.filled : styles.empty}>
                <path d={STAR} />
              </svg>
              <span className="visually-hidden">
                {n} {n === 1 ? 'star' : 'stars'}
              </span>
            </label>
          ))}
        </div>
        <span className={styles.selected}>{value ? `${value} of 5 selected` : 'No rating yet'}</span>
        <span className={styles.hint}>Choose a star to change your rating</span>
      </div>
      {error && (
        <p id={errorId} className={styles.error}>
          {error}
        </p>
      )}
    </fieldset>
  )
}
