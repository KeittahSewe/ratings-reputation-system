import styles from './Card.module.css'

// A card with an 18px heading. action sits beside the heading (such as Edit),
// aside sits at the far right (such as Add skill). ai gives the card the
// AI-accent left rule and border used for engine output, as on the reputation
// card in Figures 4.7 and 4.8.
export function Card({ title, action, aside, ai = false, children, as: Tag = 'section', ...rest }) {
  return (
    <Tag className={`${styles.card} ${ai ? styles.ai : ''}`} {...rest}>
      {(title || action || aside) && (
        <div className={styles.header}>
          <div className={styles.headingGroup}>
            {title && <h2 className={styles.title}>{title}</h2>}
            {action}
          </div>
          {aside && <div className={styles.aside}>{aside}</div>}
        </div>
      )}
      {children}
    </Tag>
  )
}
