import { Link, useParams } from 'react-router'
import { FIXTURES } from './fixtures.jsx'
import styles from './DevFiguresPage.module.css'

// Development only (left out of production builds): each screen drawn with
// the sample data of its Chapter 4 figure, corrected to the real formulas, so
// it can be compared with the Figma frame at 1440 wide. Live data is too thin
// for that comparison.
export default function DevFiguresPage() {
  const { figure } = useParams()
  const fixture = FIXTURES.find((f) => f.id === figure)

  if (!fixture) {
    return (
      <main className={styles.index}>
        <h1>Figure fixtures</h1>
        <p>Open one at 1440 wide (DevTools device toolbar) and compare it with its Figma frame.</p>
        <ul>
          {FIXTURES.map((f) => (
            <li key={f.id}>
              <Link to={`/dev/figures/${f.id}`}>{f.title}</Link>
            </li>
          ))}
        </ul>
      </main>
    )
  }
  return fixture.render()
}
