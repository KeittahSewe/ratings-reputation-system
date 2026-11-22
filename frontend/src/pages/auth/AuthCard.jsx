import styles from './AuthCard.module.css'

// The centred 560px card of Figure 4.6, with no sidebar: a heading, a line
// under it, the form, and a footer link to the other screen.
export function AuthCard({ title, subtitle, footer, children }) {
  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <header className={styles.heading}>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.subtitle}>{subtitle}</p>
        </header>
        {children}
        <p className={styles.footer}>{footer}</p>
      </div>
    </main>
  )
}
