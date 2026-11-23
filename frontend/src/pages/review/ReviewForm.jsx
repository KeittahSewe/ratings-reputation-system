import { Button } from '../../components/Button.jsx'
import { Card } from '../../components/Card.jsx'
import { StarInput } from '../../components/StarInput.jsx'
import { AiTag } from '../../components/Tag.jsx'
import { TextArea } from '../../components/TextArea.jsx'
import { ReviewContext } from './ReviewContext.jsx'
import styles from './Review.module.css'

import { REVIEW_MAX } from './reviewRules.js'

// The form of Figure 4.10, drawn from props so the figure fixture can show
// it. The same form serves both roles. The panel says what happens on submit
// as the system really does it: the review stays hidden from the other party
// until they review back or 14 days pass, and only then counts towards their
// score (decision of 18 November), so the figure's "shown publicly" and
// "recalculated immediately" are reworded.
export function ReviewForm({ job, reviewee, revieweeRole, completedAt, values, errors, formError, busy, onChange, onSubmit, onCancel }) {
  const name = reviewee.name
  return (
    <form className={styles.form} onSubmit={onSubmit} noValidate>
      <ReviewContext title={job.title} reviewee={name} revieweeRole={revieweeRole} completedAt={completedAt} />
      <Card plain>
        <StarInput label="Your rating" value={values.rating} onChange={(rating) => onChange('rating', rating)} error={errors.rating} />
        <TextArea
          label="Your review"
          value={values.text}
          onChange={(event) => onChange('text', event.target.value)}
          error={errors.text}
          helper="Describe what the job was like. Specific detail helps other people more than a score alone."
          maxLength={REVIEW_MAX}
          rows={6}
        />
        <section className={styles.steps} aria-labelledby="submit-steps">
          <div className={styles.stepsHead}>
            <h2 id="submit-steps" className={styles.stepsTitle}>
              What happens when you submit
            </h2>
            <AiTag>Automated</AiTag>
          </div>
          <ol className={styles.stepList}>
            <li>Your review text is classified by DistilBERT as positive, neutral or negative, with a confidence score.</li>
            <li>
              The classification is stored with your star rating. {name} sees your review once they have reviewed you back, or
              14 days from now, whichever comes first.
            </li>
            <li>From then on it counts towards {name}&apos;s reputation score, which is recalculated straight away.</li>
            <li>It also counts towards the recurring themes on their insights dashboard.</li>
          </ol>
          <p className={styles.final}>
            Reviews cannot be edited after submission. Both parties see each other&apos;s review once the pair is complete.
          </p>
        </section>
      </Card>
      {formError && (
        <p className={styles.formError} role="alert">
          {formError}
        </p>
      )}
      <div className={styles.buttons}>
        <Button variant="secondary" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" busy={busy} busyLabel="Submitting and classifying">
          Submit review
        </Button>
      </div>
    </form>
  )
}
