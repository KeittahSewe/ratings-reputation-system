import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'

const SEARCH_DELAY_MS = 300

// Filters and the selected job live in the address (?status=&category=&q=&job=),
// so a reload or a shared link shows the same view. The search box updates
// the address 300 ms after typing stops, not on every key.
export function useJobFilters(basePath) {
  const [params, setParams] = useSearchParams()
  const status = params.get('status') ?? ''
  const category = params.get('category') ?? ''
  const q = params.get('q') ?? ''
  const selectedId = params.get('job')
  const [typed, setTyped] = useState(q)

  useEffect(() => {
    if (typed === q) return undefined
    const timer = setTimeout(() => update({ q: typed }), SEARCH_DELAY_MS)
    return () => clearTimeout(timer)
    // update is rebuilt every render; only the typed text should restart the timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typed])

  function update(changes) {
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        for (const [key, value] of Object.entries(changes)) {
          if (value) next.set(key, value)
          else next.delete(key)
        }
        return next
      },
      { replace: true },
    )
  }

  const apiPath = useMemo(() => {
    const query = new URLSearchParams()
    if (status) query.set('status', status)
    if (category) query.set('category', category)
    if (q.trim()) query.set('q', q.trim())
    const text = query.toString()
    return text ? `${basePath}?${text}` : basePath
  }, [basePath, status, category, q])

  return {
    filters: { status, category, q: typed },
    filtered: Boolean(status || category || q),
    apiPath,
    selectedId,
    setFilters: (next) => {
      if (next.q !== typed) setTyped(next.q)
      if (next.status !== status || next.category !== category) update({ status: next.status, category: next.category })
    },
    select: (id) => update({ job: id }),
    close: () => update({ job: null }),
  }
}
