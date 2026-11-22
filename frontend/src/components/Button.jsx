import styles from './Button.module.css'

// variant: primary (filled deep teal), secondary (outlined) or danger.
// busy disables the button and shows busyLabel, so a slow request cannot be
// sent twice.
export function Button({ variant = 'primary', busy = false, busyLabel, disabled, children, type = 'button', ...rest }) {
  return (
    <button
      type={type}
      className={`${styles.button} ${styles[variant]}`}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      {...rest}
    >
      {busy && busyLabel ? busyLabel : children}
    </button>
  )
}
