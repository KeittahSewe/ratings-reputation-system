import { Link } from 'react-router'
import { SentimentBar } from '../../components/SentimentBar.jsx'
import { SentimentTag } from '../../components/SentimentTag.jsx'
import { StarRating } from '../../components/StarRating.jsx'
import { AiTag } from '../../components/Tag.jsx'
import { RecommendationCard } from '../recommendations/RecommendationCard.jsx'
import {
  EXAMPLE_GUIDANCE,
  EXAMPLE_JOB,
  EXAMPLE_RECOMMENDATIONS,
  EXAMPLE_REVIEW_PAIR,
  HIRING_STEPS,
  MATCH_WEIGHTS,
  REPUTATION_WEIGHTS,
} from './landingExamples.js'
import styles from './Landing.module.css'

// The public front page at /. Signed-out visitors land here before log in or
// registration; signed-in users skip it (HomeRoute). The hero sits on a
// full-width primary band and uses the product itself as its picture: the
// top of Esther's ranking card and a classified review, drawn from the same
// sample data as Figures 4.8 and 4.11. The rest of the page explains the
// hiring model (workers do not apply; clients choose from a ranked list),
// what decides the order, and what each side gets back from reviews.
export function LandingPage() {
  const [esther, peter] = EXAMPLE_RECOMMENDATIONS
  return (
    <div className={styles.page}>
      <div className={styles.band}>
        <header className={styles.topBar}>
          <p className={styles.brand}>
            <span className={styles.mark} aria-hidden="true" />
            Ratings and Reputation
          </p>
          <nav className={styles.topLinks} aria-label="Account">
            <Link to="/login" className={styles.onBandLink}>
              Log in
            </Link>
            <Link to="/register" className={styles.onBandButton}>
              Create account
            </Link>
          </nav>
        </header>

        <section className={styles.hero} aria-labelledby="landing-title">
          <div className={styles.heroText}>
            <h1 id="landing-title" className={styles.display}>
              Your next job starts with how you did the last one.
            </h1>
            <p className={styles.lead}>
              Clients get a ranked list of workers for every job they post. Your place on it comes from your skills and
              from what past clients wrote about your work, which an AI model reads. Every score shows how it was worked
              out, and nobody can pay to move up.
            </p>
            <div className={styles.ctaRow}>
              <Link to="/register?role=client" className={styles.onBandButton}>
                Find a worker
              </Link>
              <Link to="/register?role=worker" className={styles.onBandOutline}>
                Find work
              </Link>
            </div>
          </div>

          <div className={styles.heroVisual} aria-hidden="true">
            <svg className={styles.blob} viewBox="0 0 600 520" preserveAspectRatio="none">
              <path d="M88 64C168-8 330 8 448 40s170 120 140 236-70 188-196 220S152 520 72 438-12 300 8 196 30 112 88 64Z" />
            </svg>
            <span className={`${styles.dot} ${styles.dotA}`} />
            <span className={`${styles.dot} ${styles.dotB}`} />
            <span className={`${styles.dot} ${styles.dotC}`} />
            <span className={`${styles.dot} ${styles.dotD}`} />

            <div className={styles.heroCard}>
              <p className={styles.heroCardJob}>Ranked for {EXAMPLE_JOB}</p>
              <div className={styles.heroCardHead}>
                <span className={styles.rank}>1</span>
                <div>
                  <p className={styles.heroName}>{esther.worker.name}</p>
                  <p className={styles.heroMeta}>
                    {esther.completed_jobs} jobs completed, reputation {esther.reputation.score.toFixed(1)} / 5.0
                  </p>
                </div>
                <AiTag>Match {esther.match}</AiTag>
              </div>
              <SentimentBar counts={esther.reputation.sentiment_counts} />
              <p className={styles.heroWhy}>
                <strong>Why this ranking:</strong> {esther.explanation[0]}
              </p>
            </div>

            <div className={styles.heroReview}>
              <div className={styles.heroReviewHead}>
                <span className={styles.heroReviewer}>{EXAMPLE_REVIEW_PAIR[0].from}</span>
                <StarRating value={EXAMPLE_REVIEW_PAIR[0].rating} />
              </div>
              <p className={styles.heroReviewText}>{EXAMPLE_REVIEW_PAIR[0].short}</p>
              <SentimentTag sentiment={EXAMPLE_REVIEW_PAIR[0].sentiment} />
            </div>
          </div>
        </section>
      </div>

      <main className={styles.main}>
        <section className={styles.section} aria-labelledby="landing-steps">
          <h2 id="landing-steps" className={styles.heading}>
            How hiring works here
          </h2>
          <p className={styles.body}>
            Workers don&apos;t apply or bid. The client posts a job and chooses from a list the system has already
            ranked.
          </p>
          <ol className={styles.steps}>
            {HIRING_STEPS.map((step, i) => (
              <li key={step.title} className={styles.step}>
                <span className={styles.stepNumber}>{i + 1}</span>
                <h3 className={styles.stepTitle}>{step.title}</h3>
                <p className={styles.stepText}>{step.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className={styles.section} aria-labelledby="landing-picked">
          <div className={styles.sectionIntro}>
            <h2 id="landing-picked" className={styles.heading}>
              See a ranking before you sign up
            </h2>
            <p className={styles.body}>
              This is the top of the list a client sees for an electrical job, {EXAMPLE_JOB}. Peter has worked for
              this client before and has a strong record. Esther still ranks first, because she holds both skills the
              job needs.
            </p>
          </div>
          <div className={styles.examples}>
            {[esther, peter].map((rec) => (
              <RecommendationCard key={rec.worker.id} rec={rec} jobTitle={EXAMPLE_JOB} showProfileLink={false} />
            ))}
          </div>
        </section>

        <section className={`${styles.section} ${styles.tinted}`} aria-labelledby="landing-order">
          <div className={styles.sectionIntro}>
            <h2 id="landing-order" className={styles.heading}>
              What decides the order
            </h2>
            <p className={styles.body}>
              Two scores sit behind every ranking. Both are shown with this breakdown wherever they appear in the app.
            </p>
          </div>
          <div className={styles.twoColumns}>
            <WeightsCard
              title="Match score, out of 100"
              tag="Recommendation engine"
              rows={MATCH_WEIGHTS}
              note="A worker with no reviews yet still appears on the list and ranks on skills alone until reviews come in."
            />
            <WeightsCard
              title="Reputation score, out of 5"
              tag="Scoring engine"
              rows={REPUTATION_WEIGHTS}
              note="A DistilBERT model reads every review and labels it positive, neutral or negative. A five-star review that complains about lateness counts for less than one full of praise."
            />
          </div>
        </section>

        <section className={styles.section} aria-labelledby="landing-pays">
          <h2 id="landing-pays" className={styles.heading}>
            Why good work pays off
          </h2>

          <div className={styles.feature}>
            <div className={styles.featureText}>
              <h3 className={styles.featureTitle}>Both sides review each other</h3>
              <p className={styles.body}>
                When a job is finished, the client and the worker fill in the same review form. Neither can see the
                other&apos;s review until both are in, or until 14 days pass. Clients carry a score too, and workers see
                it on every job they are assigned.
              </p>
            </div>
            <div className={styles.pair}>
              {EXAMPLE_REVIEW_PAIR.map((r) => (
                <article key={r.from} className={styles.miniReview}>
                  <div className={styles.miniHead}>
                    <span>
                      <strong>{r.from}</strong> reviewed {r.to}
                    </span>
                    <StarRating value={r.rating} />
                  </div>
                  <p className={styles.miniText}>{r.text}</p>
                  <SentimentTag sentiment={r.sentiment} />
                </article>
              ))}
            </div>
          </div>

          <div className={`${styles.feature} ${styles.featureFlip}`}>
            <div className={styles.featureText}>
              <h3 className={styles.featureTitle}>Feedback you can act on</h3>
              <p className={styles.body}>
                Stars alone don&apos;t tell a worker what to change. The insights page picks out what clients keep
                mentioning and turns it into a specific suggestion. This is Peter&apos;s.
              </p>
            </div>
            <div className={styles.insightPanel}>
              <div className={styles.insight}>
                <div className={styles.insightHead}>
                  <AiTag>Suggestion from your reviews</AiTag>
                  <span className={styles.insightTitle}>{EXAMPLE_GUIDANCE.title}</span>
                </div>
                <p className={styles.miniText}>{EXAMPLE_GUIDANCE.detail}</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <section className={styles.closing} aria-labelledby="landing-start">
        <div className={styles.closingInner}>
          <h2 id="landing-start" className={styles.closingHeading}>
            Start building your record
          </h2>
          <div className={styles.ctaRow}>
            <Link to="/register?role=client" className={styles.buttonLink}>
              Find a worker
            </Link>
            <Link to="/register?role=worker" className={styles.secondaryButtonLink}>
              Find work
            </Link>
            <span className={styles.helper}>
              Already have an account?
              <Link to="/login" className={styles.inlineLink}>
                Log in
              </Link>
            </span>
          </div>
        </div>
      </section>

      <footer className={styles.footer}>
        <p>UCS62 capstone project, Strathmore University. Names and figures on this page are sample data.</p>
      </footer>
    </div>
  )
}

// One weighting as labelled rows. Each row has its percentage in words and a
// bar, so the weights read the same in greyscale.
function WeightsCard({ title, tag, rows, note }) {
  return (
    <div className={styles.panel}>
      <div className={styles.panelHead}>
        <h3 className={styles.panelTitle}>{title}</h3>
        <AiTag>{tag}</AiTag>
      </div>
      <ul className={styles.weights}>
        {rows.map((row) => (
          <li key={row.label} className={styles.weightRow}>
            <span className={styles.weightLabel}>{row.label}</span>
            <span className={styles.weightTrack} aria-hidden="true">
              <span className={styles.weightFill} style={{ width: `${row.weight}%` }} />
            </span>
            <span className={styles.weightValue}>{row.weight} percent</span>
          </li>
        ))}
      </ul>
      <p className={styles.note}>{note}</p>
    </div>
  )
}
