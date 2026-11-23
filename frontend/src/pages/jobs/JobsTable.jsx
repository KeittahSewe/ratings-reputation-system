import { Link } from 'react-router'
import { StatusPill } from '../../components/StatusPill.jsx'
import { categoryLabel } from '../../lib/categories.js'
import { formatShortDate } from '../../lib/format.js'
import styles from './Jobs.module.css'

// The job table of Figure 4.9. The selected row is marked three ways, so it
// still reads in greyscale: a light fill, a left bar and the words
// "Selected, details shown below". party is the column naming the other side:
// the worker for a client, the client for a worker.
export function JobsTable({ jobs, selectedId, party, onSelect, actionFor }) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">Job title</th>
            <th scope="col">Category</th>
            <th scope="col">{party === 'worker' ? 'Assigned worker' : 'Client'}</th>
            <th scope="col">Status</th>
            <th scope="col">Created</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => {
            const selected = job.id === selectedId
            const other = party === 'worker' ? job.worker : job.client
            const action = actionFor(job)
            return (
              <tr key={job.id} className={selected ? styles.selected : undefined} aria-selected={selected || undefined}>
                <td className={styles.titleCell}>
                  {selected && <span className={styles.selectedBar} aria-hidden="true" />}
                  <button type="button" className={styles.titleButton} onClick={() => onSelect(job.id)}>
                    {job.title}
                  </button>
                  {selected && <span className={styles.selectedNote}>Selected, details shown below</span>}
                </td>
                <td>{categoryLabel(job.category)}</td>
                <td className={other ? undefined : styles.muted}>
                  {other ? other.name : 'Not assigned'}
                </td>
                <td>
                  <StatusPill status={job.status} />
                </td>
                <td>{formatShortDate(job.created_at)}</td>
                <td>
                  {action.to ? (
                    <Link to={action.to} className={styles.action}>
                      {action.label}
                    </Link>
                  ) : (
                    <button type="button" className={styles.actionButton} onClick={() => onSelect(job.id)}>
                      {action.label}
                    </button>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
