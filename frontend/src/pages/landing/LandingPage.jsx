import { Link } from 'react-router'
import { AiTag } from '../../components/Tag.jsx'
import { RecommendationCard } from '../recommendations/RecommendationCard.jsx'
import { EXAMPLE_JOB, EXAMPLE_RECOMMENDATIONS, MATCH_WEIGHTS, REPUTATION_WEIGHTS } from './landingExamples.js'
import styles from './Landing.module.css'

// The public front page at /. Signed-out visitors land here before log in or
// registration; signed-in users skip it (HomeRoute). It explains the hiring
// model before asking anyone to sign up: workers do not apply, clients choose
// from a ranked list, and a worker's place on that list comes from skills and
// track record. The example ranking uses the real RecommendationCard, so the
// page shows the product rather than describing it.
export function LandingPage() {
  return (
    <div className={styles.page}>
      <header className={styles.topBar}>
        <p className={styles.brand}>Ratings and Reputation</p>
        <nav className={styles.topLinks} aria-label="Account">
          <Link to="/login" className={styles.textLink}>
            Log in
          </Link>
          <Link to="/register" className={styles.buttonLink}>
            Create account
          </Link>
        </nav>
      </header>

      <main className={styles.main}>
        <section className={styles.hero} aria-labelledby="landing-title">
          <h1 id="landing-title" className={styles.display}>
            Your next job starts with how you did the last one.
          </h1>
          <p className={styles.lead}>
            Clients see a ranked list of workers for every job they post. Matching skills put you on that list. Where you
            land on it depends on your track record, which we read from both the stars and the words in your reviews.
            Every ranking shows how it was worked out, and no one can pay to move up.
          </p>
          <div className={styles.ctaRow}>
            <Link to="/register?role=client" className={styles.buttonLink}>
              Find a worker
            </Link>
            <Link to="/register?role=worker" className={styles.secondaryButtonLink}>
              Find work
            </Link>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="landing-picked">
          <h2 id="landing-picked" className={styles.heading}>
            How a worker gets picked
          </h2>
          <p className={styles.body}>
            Workers don&apos;t apply or bid for jobs here. When a client posts a job, the recommendation engine ranks the
            workers who are available for it and the client chooses from that list. Below is part of the list a client
            would see for an electrical job, {EXAMPLE_JOB}.
          </p>
          <div className={styles.examples}>
            <p className={styles.exampleLabel}>Example ranking</p>
            {EXAMPLE_RECOMMENDATIONS.map((rec) => (
              <RecommendationCard key={rec.worker.id} rec={rec} jobTitle={EXAMPLE_JOB} showProfileLink={false} />
            ))}
          </div>
          <p className={styles.callout}>
            Peter has worked for this client before and has a strong record. Esther still ranks first, because she holds
            both skills the job needs.
          </p>
        </section>

        <section className={styles.section} aria-labelledby="landing-order">
          <h2 id="landing-order" className={styles.heading}>
            What decides the order
          </h2>
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
              note="A DistilBERT model reads the words of every review and labels it positive, neutral or negative. So a five-star review that complains about lateness counts for less than one full of praise."
            />
          </div>
          <p className={styles.body}>
            Every score in the app is shown with this breakdown beside it, and no worker can pay to rank higher.
          </p>
        </section>

        <section className={styles.section} aria-labelledby="landing-pays">
          <h2 id="landing-pays" className={styles.heading}>
            Why good work pays off
          </h2>
          <div className={styles.twoColumns}>
            <div className={styles.panel}>
              <h3 className={styles.panelTitle}>Both sides review each other</h3>
              <p className={styles.body}>
                After a job is finished the client and the worker fill in the same review form. A review stays hidden until
                the other person has reviewed too, or until 14 days pass. Clients carry a reputation score of their own,
                which workers see on every job they are assigned.
              </p>
            </div>
            <div className={styles.panel}>
              <h3 className={styles.panelTitle}>Feedback you can act on</h3>
              <p className={styles.body}>
                Star ratings alone don&apos;t tell a worker what to change. Each worker gets an insights page that picks
                out what clients keep mentioning, such as punctuality or communication, and turns it into specific
                suggestions.
              </p>
            </div>
          </div>
        </section>

        <section className={styles.closing} aria-labelledby="landing-start">
          <h2 id="landing-start" className={styles.heading}>
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
        </section>
      </main>

      <footer className={styles.footer}>
        <p>
          UCS62 capstone project, Strathmore University. Names and figures in the example are sample data.
        </p>
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
