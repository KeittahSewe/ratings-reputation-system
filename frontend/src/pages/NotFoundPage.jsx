import { Link } from 'react-router'
import { Card } from '../components/Card.jsx'
import { EmptyState } from '../components/EmptyState.jsx'
import { PageTitle } from '../components/PageTitle.jsx'

export function NotFoundPage() {
  return (
    <>
      <PageTitle title="Page not found" />
      <Card>
        <EmptyState title="There is no page at this address." action={<Link to="/jobs">Go to My Jobs</Link>} />
      </Card>
    </>
  )
}
