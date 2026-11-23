import { useState } from 'react'
import { Button } from '../../components/Button.jsx'
import { Card } from '../../components/Card.jsx'
import { SelectField } from '../../components/SelectField.jsx'
import { Tag } from '../../components/Tag.jsx'
import { TextArea } from '../../components/TextArea.jsx'
import { TextField } from '../../components/TextField.jsx'
import { apiFetch } from '../../lib/api.js'
import { CATEGORIES } from '../../lib/categories.js'
import { parseSkills } from '../../lib/skills.js'
import styles from './Jobs.module.css'

const MAX_SKILLS = 10

// Post a job. Not drawn in Figure 4.9, which shows only the button, so it is
// built from the shared form components. The required skills drive the
// recommendation engine's skill match (plan 3.5), which the helper says.
export function PostJobPanel({ onPosted, onClose }) {
  const [values, setValues] = useState({ title: '', description: '', category: '', skills: '' })
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const skills = parseSkills(values.skills)
  const set = (name) => (event) => setValues((v) => ({ ...v, [name]: event.target.value }))

  async function submit(event) {
    event.preventDefault()
    const found = {}
    if (!values.title.trim()) found.title = 'Give the job a title.'
    if (!values.description.trim()) found.description = 'Describe the job.'
    if (!values.category) found.category = 'Choose a category.'
    if (skills.length > MAX_SKILLS) found.skills = `List at most ${MAX_SKILLS} skills.`
    else if (skills.some((s) => s.length > 60)) found.skills = 'Keep each skill to 60 characters.'
    setErrors(found)
    if (Object.keys(found).length > 0) return
    setBusy(true)
    try {
      const { job } = await apiFetch('/jobs', {
        method: 'POST',
        body: { title: values.title.trim(), description: values.description.trim(), category: values.category, required_skills: skills },
      })
      onPosted(job)
    } catch (err) {
      setErrors({ form: err.message })
      setBusy(false)
    }
  }

  return (
    <Card title="Post a job" as="form" onSubmit={submit} noValidate>
      <div className={styles.postGrid}>
        <TextField label="Title" value={values.title} onChange={set('title')} error={errors.title} maxLength={120} />
        <SelectField
          label="Category"
          value={values.category}
          onChange={set('category')}
          options={CATEGORIES}
          placeholder="Choose a category"
          error={errors.category}
        />
      </div>
      <TextArea label="Description" value={values.description} onChange={set('description')} error={errors.description} maxLength={4000} rows={4} />
      <TextField
        label="Required skills (optional)"
        value={values.skills}
        onChange={set('skills')}
        error={errors.skills}
        helper="Separate skills with commas, for example Electrical wiring, Lighting installation. Workers are ranked by how many of these they list."
      />
      {skills.length > 0 && (
        <div className={styles.skillTags} aria-label="Skills that will be saved">
          {skills.map((skill) => (
            <Tag key={skill} quiet>
              {skill}
            </Tag>
          ))}
        </div>
      )}
      {errors.form && (
        <p className={styles.formError} role="alert">
          {errors.form}
        </p>
      )}
      <div className={styles.postActions}>
        <Button type="submit" busy={busy} busyLabel="Posting">
          Post job
        </Button>
        <Button variant="secondary" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
      </div>
    </Card>
  )
}
