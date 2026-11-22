import { useId } from 'react'
import styles from './RoleTiles.module.css'

const ROLES = [
  { value: 'client', label: 'Client', description: 'Post jobs and hire workers' },
  { value: 'worker', label: 'Worker', description: 'Find jobs and build a reputation' },
]

// The role choice in Figure 4.6: two tiles rather than a dropdown, because
// role decides the whole account. They are radio buttons underneath, so the
// keyboard and screen readers treat them as one choice. The selected tile
// says "(selected)" in words as well as taking the fill and border, because
// the fill alone disappears in greyscale.
export function RoleTiles({ legend, value, onChange, error }) {
  const name = useId()
  const errorId = `${name}-error`
  return (
    <fieldset className={styles.fieldset} aria-describedby={error ? errorId : undefined}>
      <legend className={styles.legend}>{legend}</legend>
      <div className={styles.tiles}>
        {ROLES.map((role, index) => {
          const selected = value === role.value
          return (
            <label key={role.value} className={`${styles.tile} ${selected ? styles.selected : ''}`}>
              <input
                className="visually-hidden"
                type="radio"
                name={name}
                value={role.value}
                checked={selected}
                aria-invalid={error && index === 0 ? true : undefined}
                onChange={() => onChange(role.value)}
              />
              <span className={styles.label}>
                {role.label}
                {selected && ' (selected)'}
              </span>
              <span className={styles.description}>{role.description}</span>
            </label>
          )
        })}
      </div>
      {error && (
        <p id={errorId} className={styles.error}>
          {error}
        </p>
      )}
    </fieldset>
  )
}
