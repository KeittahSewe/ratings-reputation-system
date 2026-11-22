import styles from './LinkButton.module.css'

// The text actions in card headers and rows of the figures: Edit, Add skill,
// Remove. They act on the page, so they are buttons, styled as links.
export function LinkButton({ children, small = false, ...rest }) {
  return (
    <button type="button" className={`${styles.link} ${small ? styles.small : ''}`} {...rest}>
      {children}
    </button>
  )
}
