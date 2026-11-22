import { Card } from '../components/Card.jsx'
import { EmptyState } from '../components/EmptyState.jsx'
import { PageTitle } from '../components/PageTitle.jsx'

// Stands in for a screen until its issue builds it, so every sidebar link
// already leads somewhere.
export function PlaceholderPage({ title, figure, issue }) {
  return (
    <>
      <PageTitle title={title} />
      <Card>
        <EmptyState title="Not built yet">
          This screen follows Figure {figure} and arrives with issue #{issue}.
        </EmptyState>
      </Card>
    </>
  )
}
