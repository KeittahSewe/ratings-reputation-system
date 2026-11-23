import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useAuth } from '../../auth/useAuth.js'
import { Card } from '../../components/Card.jsx'
import { EmptyState } from '../../components/EmptyState.jsx'
import { ErrorState } from '../../components/ErrorState.jsx'
import { LoadingState } from '../../components/LoadingState.jsx'
import { PageTitle } from '../../components/PageTitle.jsx'
import { apiFetch, wakeInference } from '../../lib/api.js'
import { useApi } from '../../lib/useApi.js'
import { ReviewForm } from './ReviewForm.jsx'
import { ReviewOutcome } from './ReviewOutcome.jsx'
import { validateReview } from './reviewRules.js'

// /jobs/:id/review, Figure 4.10, for both roles. Once the review is written
// the page shows it with its classification, and where the other party's
// review stands.
export function ReviewPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { me } = useAuth()
  const job = useApi(`/jobs/${id}`)
  const reviews = useApi(`/jobs/${id}/reviews`, { keepPrevious: true })
  const [values, setValues] = useState({ rating: 0, text: '' })
  const [errors, setErrors] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [formError, setFormError] = useState(null)
  const [busy, setBusy] = useState(false)

  // The user spends a minute writing; long enough for a sleeping inference
  // service to wake, so the review is classified on submit, not left pending.
  useEffect(() => wakeInference(), [])

  if (job.status === 'error' || reviews.status === 'error') {
    const error = job.error ?? reviews.error
    return (
      <>
        <PageTitle title="Leave a review" />
        <ErrorState
          title={error.status === 404 ? 'This job is not available to you' : 'The review could not be loaded'}
          error={error.status === 404 ? null : error}
          onRetry={error.status === 404 ? undefined : () => (job.error ? job.reload() : reviews.reload())}
        />
      </>
    )
  }
  if (!job.data || !reviews.data) return <LoadingState label="Loading the job" />

  const theJob = job.data.job
  const isClient = me.user.role === 'client'
  const reviewee = isClient ? theJob.worker : theJob.client
  const revieweeRole = isClient ? 'worker' : 'client'
  const { written, received, can_review: canReview } = reviews.data

  if (written) {
    return (
      <>
        <PageTitle title="Your review" />
        <ReviewOutcome written={written} received={received} revieweeName={reviewee.name} justSubmitted={submitted} jobId={id} />
      </>
    )
  }
  if (!canReview) {
    return (
      <>
        <PageTitle title="Leave a review" />
        <Card>
          <EmptyState title="This job cannot be reviewed yet" action={<Link to={`/jobs?job=${id}`}>Back to the job</Link>}>
            A review can be written once the client has marked the job complete.
          </EmptyState>
        </Card>
      </>
    )
  }

  function change(name, value) {
    const next = { ...values, [name]: value }
    setValues(next)
    if (Object.keys(errors).length > 0) setErrors(validateReview(next))
  }

  async function submit(event) {
    event.preventDefault()
    const found = validateReview(values)
    setErrors(found)
    setFormError(null)
    if (Object.keys(found).length > 0) return
    setBusy(true)
    try {
      await apiFetch(`/jobs/${id}/reviews`, { method: 'POST', body: { rating: values.rating, review_text: values.text.trim() } })
      setSubmitted(true)
      reviews.reload()
    } catch (err) {
      if (err.code === 'already_reviewed') reviews.reload()
      else setFormError(err.message)
      setBusy(false)
    }
  }

  return (
    <>
      <PageTitle title="Leave a review" />
      <ReviewForm
        job={theJob}
        reviewee={reviewee}
        revieweeRole={revieweeRole}
        completedAt={theJob.completed_at}
        values={values}
        errors={errors}
        formError={formError}
        busy={busy}
        onChange={change}
        onSubmit={submit}
        onCancel={() => navigate(`/jobs?job=${id}`)}
      />
    </>
  )
}
