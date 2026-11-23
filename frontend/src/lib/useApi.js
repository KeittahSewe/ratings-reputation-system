import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from './api.js'

// Loads one API path for a screen. Returns { status, data, error, reload }
// where status is loading, ready or error. A null path loads nothing. The
// request is cancelled if the screen closes or the path changes first.
// keepPrevious: while a new path loads, data still holds the last result,
// so a filtered table does not blank out on every keystroke.
export function useApi(path, { keepPrevious = false } = {}) {
  const [result, setResult] = useState({ key: null, status: 'loading', data: null, error: null })
  const [attempt, setAttempt] = useState(0)
  const key = path ? `${path}#${attempt}` : null

  useEffect(() => {
    if (!path) return undefined
    const controller = new AbortController()
    apiFetch(path, { signal: controller.signal })
      .then((data) => setResult({ key, status: 'ready', data, error: null }))
      .catch((error) => {
        if (!controller.signal.aborted) setResult({ key, status: 'error', data: null, error })
      })
    return () => controller.abort()
  }, [path, key])

  const reload = useCallback(() => setAttempt((n) => n + 1), [])
  // A result for an older path or attempt counts as still loading.
  const stale = keepPrevious && result.status === 'ready' ? result.data : null
  const current = result.key === key ? result : { status: path ? 'loading' : 'idle', data: stale, error: null }
  return { status: current.status, data: current.data, error: current.error, reload }
}
