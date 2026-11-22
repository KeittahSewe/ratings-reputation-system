import { useState } from 'react'
import { Button } from '../../components/Button.jsx'
import { Card } from '../../components/Card.jsx'
import { TextArea } from '../../components/TextArea.jsx'
import { TextField } from '../../components/TextField.jsx'
import { formatMonthYear } from '../../lib/format.js'
import { DetailField } from './DetailField.jsx'
import { LinkButton } from './LinkButton.jsx'
import styles from './Profile.module.css'

// Account details, Figures 4.7 and 4.8: name, email and member since on the
// left; company name (clients) and bio on the right. With onSave, Edit turns
// the editable fields into inputs: name and bio for everyone, company name for
// clients.
// Email belongs to Supabase Auth and role is fixed at sign-up, so neither is
// editable. Without onSave (another user's profile) there is no Edit and no
// email.
export function AccountDetailsCard({ user, onSave }) {
  const [editing, setEditing] = useState(false)
  const [values, setValues] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const isClient = user.role === 'client'

  function startEditing() {
    setValues({ name: user.name, bio: user.bio ?? '', company_name: user.company_name ?? '' })
    setError(null)
    setEditing(true)
  }

  async function save(event) {
    event.preventDefault()
    if (!values.name.trim()) {
      setError('Enter your full name.')
      return
    }
    const changes = { name: values.name.trim(), bio: values.bio.trim() || null }
    if (isClient) changes.company_name = values.company_name.trim() || null
    setBusy(true)
    setError(null)
    try {
      await onSave(changes)
      setEditing(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const set = (name) => (event) => setValues((v) => ({ ...v, [name]: event.target.value }))

  if (editing) {
    return (
      <Card title="Account details" as="form" onSubmit={save} noValidate>
        <div className={styles.detailGrid}>
          <div className={styles.column}>
            <TextField label="Full name" value={values.name} onChange={set('name')} maxLength={100} autoComplete="name" />
            <DetailField label="Email address">{user.email}</DetailField>
          </div>
          <div className={styles.column}>
            {isClient && <TextField label="Company name" value={values.company_name} onChange={set('company_name')} maxLength={120} />}
            <TextArea label="Bio" value={values.bio} onChange={set('bio')} maxLength={1000} rows={5} />
          </div>
        </div>
        {error && (
          <p className={styles.formError} role="alert">
            {error}
          </p>
        )}
        <div className={styles.actions}>
          <Button type="submit" busy={busy} busyLabel="Saving">
            Save
          </Button>
          <Button variant="secondary" onClick={() => setEditing(false)} disabled={busy}>
            Cancel
          </Button>
        </div>
      </Card>
    )
  }

  return (
    <Card title="Account details" aside={onSave && <LinkButton onClick={startEditing}>Edit</LinkButton>}>
      <div className={styles.detailGrid}>
        <div className={styles.column}>
          <DetailField label="Full name">{user.name}</DetailField>
          {user.email && <DetailField label="Email address">{user.email}</DetailField>}
          <DetailField label="Member since">{formatMonthYear(user.created_at)}</DetailField>
        </div>
        <div className={styles.column}>
          {isClient && <DetailField label="Company name">{user.company_name}</DetailField>}
          <DetailField label="Bio" multiline>
            {user.bio}
          </DetailField>
        </div>
      </div>
    </Card>
  )
}
