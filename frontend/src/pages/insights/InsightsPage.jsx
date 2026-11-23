import { useSearchParams } from 'react-router'
import { ErrorState } from '../../components/ErrorState.jsx'
import { LoadingState } from '../../components/LoadingState.jsx'
import { PageTitle } from '../../components/PageTitle.jsx'
import { useApi } from '../../lib/useApi.js'
import { DEFAULT_PERIOD, periodFromSearch } from './insightsText.js'
import { InsightsView } from './InsightsView.jsx'

// /insights for workers and clients alike. The period lives in the address
// (?period=3m) so a refresh or a shared link keeps it. Nothing is stored: the
// API works the dashboard out from the reviews on every request.
export function InsightsPage() {
  const [params, setParams] = useSearchParams()
  const period = periodFromSearch(params.get('period'))
  const insights = useApi(`/me/insights?period=${period}`, { keepPrevious: true })

  function choose(next) {
    setParams(next === DEFAULT_PERIOD ? {} : { period: next }, { replace: true })
  }

  if (insights.status === 'error') {
    return (
      <>
        <PageTitle title="Your insights" />
        <ErrorState title="Your insights could not be loaded" error={insights.error} onRetry={insights.reload} />
      </>
    )
  }
  if (!insights.data) return <LoadingState label="Working out your insights" />

  return (
    <InsightsView
      insights={insights.data}
      selected={period}
      onPeriod={choose}
      loading={insights.status === 'loading'}
    />
  )
}
