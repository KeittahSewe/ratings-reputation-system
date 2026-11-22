import { useState } from 'react'
import { Button } from '../../components/Button.jsx'
import { Card } from '../../components/Card.jsx'
import { EmptyState } from '../../components/EmptyState.jsx'
import { SelectField } from '../../components/SelectField.jsx'
import { Tag } from '../../components/Tag.jsx'
import { TextField } from '../../components/TextField.jsx'
import { CATEGORIES, categoryLabel } from '../../lib/categories.js'
import { LinkButton } from './LinkButton.jsx'
import styles from './Profile.module.css'

// The skills card of Figure 4.8: each skill with its category tag and Remove,
// and Add skill in the header. Without onAdd and onRemove (another worker's
// profile) the list is read only. The recommendation engine matches a job's
// required skills against these names, so the empty state says so.
export function SkillsCard({ skills, onAdd, onRemove }) {
  const editable = Boolean(onAdd)
  const [adding, setAdding] = useState(false)
  const [values, setValues] = useState({ skill_name: '', category: '' })
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const [removing, setRemoving] = useState(null)
  const [removeError, setRemoveError] = useState(null)

  function startAdding() {
    setValues({ skill_name: '', category: '' })
    setErrors({})
    setAdding(true)
  }

  async function add(event) {
    event.preventDefault()
    const found = {}
    if (!values.skill_name.trim()) found.skill_name = 'Enter the skill.'
    if (!values.category) found.category = 'Choose a category.'
    setErrors(found)
    if (Object.keys(found).length > 0) return
    setBusy(true)
    try {
      await onAdd({ skill_name: values.skill_name.trim(), category: values.category })
      setAdding(false)
    } catch (err) {
      setErrors(err.code === 'skill_exists' ? { skill_name: 'You already list this skill.' } : { form: err.message })
    } finally {
      setBusy(false)
    }
  }

  async function remove(skill) {
    setRemoving(skill.id)
    setRemoveError(null)
    try {
      await onRemove(skill)
    } catch (err) {
      setRemoveError(`${skill.skill_name} could not be removed. ${err.message}`)
    } finally {
      setRemoving(null)
    }
  }

  return (
    <Card title="Skills" aside={editable && !adding && <LinkButton onClick={startAdding}>Add skill</LinkButton>}>
      {adding && (
        <form className={styles.addSkill} onSubmit={add} noValidate>
          <TextField
            label="Skill"
            value={values.skill_name}
            onChange={(e) => setValues((v) => ({ ...v, skill_name: e.target.value }))}
            error={errors.skill_name}
            maxLength={60}
            helper="Name it the way clients would, for example Pipe fitting and repair."
          />
          <SelectField
            label="Category"
            value={values.category}
            onChange={(e) => setValues((v) => ({ ...v, category: e.target.value }))}
            options={CATEGORIES}
            placeholder="Choose a category"
            error={errors.category}
          />
          <div className={styles.addActions}>
            <Button type="submit" busy={busy} busyLabel="Adding">
              Add
            </Button>
            <Button variant="secondary" onClick={() => setAdding(false)} disabled={busy}>
              Cancel
            </Button>
          </div>
          {errors.form && (
            <p className={styles.formError} role="alert">
              {errors.form}
            </p>
          )}
        </form>
      )}
      {skills.length === 0 ? (
        <EmptyState title="No skills listed yet">
          {editable
            ? 'Clients are matched to workers by the skills listed here, so add the work you do.'
            : 'This worker has not listed any skills.'}
        </EmptyState>
      ) : (
        <ul className={styles.skillList}>
          {skills.map((skill) => (
            <li key={skill.id} className={styles.skillRow}>
              <span>{skill.skill_name}</span>
              <Tag quiet>{categoryLabel(skill.category)}</Tag>
              {editable && (
                <span className={styles.rowAction}>
                  <LinkButton small onClick={() => remove(skill)} disabled={removing === skill.id}>
                    {removing === skill.id ? 'Removing' : 'Remove'}
                    <span className="visually-hidden"> {skill.skill_name}</span>
                  </LinkButton>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      {removeError && (
        <p className={styles.formError} role="alert">
          {removeError}
        </p>
      )}
    </Card>
  )
}
