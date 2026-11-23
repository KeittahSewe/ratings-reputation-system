import { SelectField } from '../../components/SelectField.jsx'
import { TextField } from '../../components/TextField.jsx'
import { CATEGORIES } from '../../lib/categories.js'
import { STATUSES } from '../../lib/jobStatus.js'
import styles from './Jobs.module.css'

// The filter row of Figure 4.9: status, category and a title search.
// showStatus is false on Available Jobs, where every job is open.
export function JobFilters({ filters, onChange, showStatus = true }) {
  const set = (name) => (event) => onChange({ ...filters, [name]: event.target.value })
  return (
    <div className={`${styles.filters} ${showStatus ? '' : styles.filtersNoStatus}`} role="search">
      {showStatus && (
        <SelectField label="Status" value={filters.status} onChange={set('status')} options={STATUSES} placeholder="All statuses" />
      )}
      <SelectField label="Category" value={filters.category} onChange={set('category')} options={CATEGORIES} placeholder="All categories" />
      <TextField label="Search" type="search" value={filters.q} onChange={set('q')} placeholder="Search job titles" />
    </div>
  )
}
