import styles from './Button.module.css'

// variant: primary (filled deep teal), secondary (outlined) or danger.
// large is the 48px full-width button of the forms in Figure 4.6.
// busy disables the button and shows busyLabel, so a slow request cannot be
// sent twice.
export function Button({ variant = 'primary', large = false, busy = false, busyLabel, disabled, children, type = 'button', ...rest }) {
  return (
    <button
      type={type}
      className={`${styles.button} ${styles[variant]} ${large ? styles.large : ''}`}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      {...rest}
    >
      {busy && busyLabel ? busyLabel : children}
    </button>
  )
}
