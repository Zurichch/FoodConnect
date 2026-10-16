/**
 * CollectionsPage.jsx - the NGO's assigned donations.
 *   scope="active"    -> accepted, pickup scheduled, collected (status can be updated on the details page)
 *   scope="completed" -> delivered and other final outcomes
 * Data: GET /api/donations/collections?scope=...
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import DonationCard from '../../components/DonationCard'
import { Alert, EmptyState, PageHeader, PageLoader, Pagination } from '../../components/ui'
import useApi from '../../hooks/useApi'
import { getCollections } from '../../services/donationService'
import { formatDateTime } from '../../utils/format'

const NEXT_STEP = {
  ACCEPTED: 'Next: schedule the pickup',
  PICKUP_SCHEDULED: 'Next: mark as collected after pickup',
  COLLECTED: 'Next: mark as delivered after distribution',
}

export default function CollectionsPage({ scope }) {
  const [page, setPage] = useState(1)
  const { data, isLoading, error } = useApi(() => getCollections({ scope, page, per_page: 8 }), [scope, page], { pollMs: 20000 })
  const isActive = scope === 'active'

  return (
    <div>
      <PageHeader
        title={isActive ? 'Active collections' : 'Completed collections'}
        subtitle={isActive ? 'Donations assigned to your NGO that still need pickup or delivery.' : 'Finished donations: delivered, cancelled or expired.'}
      />
      {isLoading ? <PageLoader /> : error ? <Alert type="error">{error}</Alert> : data.items.length === 0 ? (
        <EmptyState title={isActive ? 'No active collections' : 'No completed collections yet'}
          message={isActive ? 'Request a donation or accept a donor offer to start a collection.' : 'Delivered donations will appear here.'}
          action={isActive && <Link to="/ngo/recommended" className="btn-primary">See recommendations</Link>} />
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            {data.items.map((donation) => (
              <DonationCard key={donation.id} donation={donation} to={`/donations/${donation.id}`}
                extra={
                  <div className="text-sm">
                    {isActive && <p className="font-medium text-brand-700">{NEXT_STEP[donation.status]}</p>}
                    {donation.scheduled_pickup_at && <p className="text-gray-500">Planned pickup: {formatDateTime(donation.scheduled_pickup_at)}</p>}
                    {donation.servings_distributed != null && <p className="text-gray-500">{donation.servings_distributed} servings distributed</p>}
                    <p className="text-gray-500">Pickup at: {donation.pickup_address} · Donor phone: {donation.donor_phone}</p>
                  </div>
                }
                actions={<Link to={`/donations/${donation.id}`} className={isActive ? 'btn-primary' : 'btn-secondary'}>{isActive ? 'Update status' : 'View timeline'}</Link>} />
            ))}
          </div>
          <Pagination page={data.page} pages={data.pages} onChange={setPage} />
        </>
      )}
    </div>
  )
}
