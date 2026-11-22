import { useEffect } from 'react'
import styles from './PageTitle.module.css'

// The 28px page title, an optional tag beside it (such as the role tag on the
// profiles) and optional actions on the right (such as Post a job). It also
// sets the browser tab title.
export function PageTitle({ title, tag, actions }) {
  useEffect(() => {
    document.title = `${title} | Ratings and Reputation`
  }, [title])

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <h1 className={styles.title}>{title}</h1>
        {tag}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </header>
  )
}
