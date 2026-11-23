import { statusLabel } from '../lib/jobStatus.js'
import { Tag } from './Tag.jsx'

// A job's status. Every status takes the same light fill, as on Figure 4.9:
// the word carries the meaning, so it reads the same in greyscale.
export function StatusPill({ status }) {
  return <Tag>{statusLabel(status)}</Tag>
}
