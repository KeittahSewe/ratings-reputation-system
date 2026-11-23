import { Card } from '../../components/Card.jsx'
import { EmptyState } from '../../components/EmptyState.jsx'
import { PageTitle } from '../../components/PageTitle.jsx'
import { AiTag } from '../../components/Tag.jsx'
import { formatScore, plural } from '../../lib/format.js'
import {
  jobsNote,
  mentionsLine,
  PERIOD_OPTIONS,
  ratingNote,
  reputationNote,
  reviewsNote,
  themeBreakdown,
  THEME_LABELS,
  trendTitle,
} from './insightsText.js'
import { SentimentTrendChart } from './SentimentTrendChart.jsx'
import styles from './Insights.module.css'

// /insights, Figure 4.12, drawn from the GET /api/me/insights response so the
// figure fixture can show it too. The screen's answer to literature gap 2:
// themes and suggestions come from the text of the user's own reviews, and
// each suggestion names the theme or trend it comes from.
//
// insights: the API response. selected: the period in the selector, which
// runs ahead of insights while a new period loads over the old one.
export function InsightsView({ insights, selected, onPeriod, loading = false }) {
  const period = insights.period.key
  const { summary, sentiment_by_month: months, themes, guidance, guidance_note: note } = insights
  const select = <PeriodSelect value={selected ?? period} onChange={onPeriod} disabled={loading} />

  if (summary.reviews.count === 0) {
    return (
      <>
        <PageTitle title="Your insights" />
        <Card>
          <EmptyState title="No insights yet">
            Insights are worked out from the reviews you receive, once both of you can see the review and DistilBERT has
            classified it.
            {summary.reviews.pending > 0
              ? ` ${plural(summary.reviews.pending, 'review')} ${summary.reviews.pending === 1 ? 'is' : 'are'} waiting for classification now.`
              : ' Complete a job and ask for a review to get started.'}
          </EmptyState>
        </Card>
      </>
    )
  }

  const inPeriod = months.reduce((sum, m) => sum + m.total, 0)
  return (
    <>
      <PageTitle title="Your insights" actions={select} />
      <div className={styles.summary} aria-busy={loading || undefined}>
        <SummaryCard
          ai
          label="Current reputation score"
          value={summary.reputation ? formatScore(summary.reputation.score) : 'None yet'}
          note={reputationNote(summary.reputation)}
          flag={summary.reputation?.provisional ? 'Provisional' : null}
        />
        <SummaryCard label="Total reviews" value={summary.reviews.count} note={reviewsNote(summary.reviews, period)} />
        <SummaryCard
          label="Average star rating"
          value={summary.average_rating.value === null ? 'None yet' : formatScore(summary.average_rating.value)}
          note={ratingNote(summary.average_rating, period)}
        />
        <SummaryCard label="Jobs completed" value={summary.jobs_completed.count} note={jobsNote(summary.jobs_completed, period)} />
      </div>

      <Card title={trendTitle(insights.period.months)} action={<AiTag>Classified by DistilBERT</AiTag>}>
        {inPeriod === 0 ? (
          <EmptyState title="No reviews in this period">
            None of your counted reviews fall in these months. Choose a longer period to see earlier ones.
          </EmptyState>
        ) : (
          <SentimentTrendChart months={months} />
        )}
        {insights.model_versions.length > 0 && (
          <p className={styles.helper}>Model version: {insights.model_versions.join(', ')}</p>
        )}
      </Card>

      <div className={styles.columns}>
        <Card title="Recurring themes in your reviews" action={<AiTag>Extracted from review text</AiTag>} ai>
          {themes.length === 0 ? (
            <EmptyState title="No recurring themes yet">
              A theme appears once a topic such as punctuality or pricing is mentioned in one of your reviews in this
              period.
            </EmptyState>
          ) : (
            <>
              <p className={styles.intro}>
                Topics mentioned across your {plural(inPeriod, 'review')} in this period, with the sentiment class of
                the sentences that mention them.
              </p>
              <ul className={styles.rows}>
                {themes.map((theme) => (
                  <li key={theme.key} className={styles.row}>
                    <div className={styles.rowText}>
                      <span className={styles.rowTitle}>{theme.name}</span>
                      <span className={styles.rowNote}>{mentionsLine(theme)}</span>
                      <span className={styles.rowNote}>{themeBreakdown(theme)}</span>
                    </div>
                    <ThemeTag sentiment={theme.sentiment} />
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>

        <Card title="Suggested improvements" action={<AiTag>Generated from your themes</AiTag>} ai>
          <p className={styles.intro}>{note}</p>
          {guidance.length === 0 ? (
            <EmptyState title="No suggestions yet">
              A suggestion appears once a theme comes up in at least 3 reviews, or once two months each hold 3 or more
              reviews and your negative share changes between them.
            </EmptyState>
          ) : (
            <ol className={styles.rows}>
              {guidance.map((item, i) => (
                <li key={`${item.kind}-${item.theme ?? i}`} className={`${styles.row} ${styles.guidance}`}>
                  <span className={styles.number}>{i + 1}.</span>
                  <div className={styles.rowText}>
                    <span className={styles.rowTitle}>{item.title}</span>
                    <span className={styles.rowNote}>{item.detail}</span>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>
    </>
  )
}

function SummaryCard({ label, value, note, flag, ai = false }) {
  return (
    <div className={`${styles.stat} ${ai ? styles.statAi : ''}`}>
      <span className={styles.statLabel}>{label}</span>
      <span className={styles.statValue}>
        {value}
        {flag && <span className={styles.flag}>{flag}</span>}
      </span>
      <span className={styles.statNote}>{note}</span>
    </div>
  )
}

// A theme's overall class in words on its fill. Mixed (the top two classes
// level) has no fill of its own and is drawn as an outline.
function ThemeTag({ sentiment }) {
  return <span className={`${styles.themeTag} ${styles[`tag_${sentiment}`]}`}>{THEME_LABELS[sentiment] ?? sentiment}</span>
}

function PeriodSelect({ value, onChange, disabled }) {
  return (
    <label className={styles.period}>
      <span>Period</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} className={styles.periodSelect}>
        {PERIOD_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}
