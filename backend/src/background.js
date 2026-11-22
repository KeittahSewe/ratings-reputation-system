// The one-minute background timer (decision of 18 November). server.js starts
// it when the API starts listening. The first tick runs straight away, which
// is also the catch-up after Render wakes the API, and then one runs every
// minute while the API is awake. Each tick runs its tasks in order:
//
//   1. the classification retry (src/reviews/classification.js)
//   2. the 14-day visibility sweep (src/reviews/visibilitySweep.js)
//
// The retry goes first, so a review it classifies is recomputed by the retry
// and the sweep does not find it. A task that fails is logged and the next
// one still runs: the sweep needs no inference service, so it carries on
// while the classifier is down.

export const TICK_INTERVAL_MS = 60_000

// tasks: [{ name, run }], where run() returns a promise.
// Returns a function that stops the timer. unref() lets the process exit
// without waiting for it.
export function startBackgroundTimer({ tasks, intervalMs = TICK_INTERVAL_MS, logger = console }) {
  let running = null

  async function runTasks() {
    for (const { name, run } of tasks) {
      try {
        await run()
      } catch (err) {
        logger.error(`${name} failed:`, err)
      }
    }
  }

  // A slow tick and the next one never overlap.
  const tick = () => {
    if (!running) running = runTasks().finally(() => (running = null))
    return running
  }

  const timer = setInterval(tick, intervalMs)
  timer.unref?.()
  tick()
  return () => clearInterval(timer)
}
