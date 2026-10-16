/**
 * RecommendedDonationsPage.jsx - open donations ranked for THIS NGO by the same
 * matching algorithm used for donors (GET /api/donations/recommended).
 */
import { HandHeart } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import ConfirmDialog from '../../components/ConfirmDialog'
import { ScoreBreakdown, ScoreCircle } from '../../components/MatchCard'
import StatusBadge from '../../components/StatusBadge'
import { Alert, EmptyState, PageHeader, PageLoader, Toast } from '../../components/ui'
import useApi from '../../hooks/useApi'
import useToast from '../../hooks/useToast'
import { getErrorMessage } from '../../services/api'
import { getRecommendedDonations, requestDonation } from '../../services/donationService'
import { DIETARY_TYPES, FOOD_CATEGORIES, label } from '../../utils/constants'
import { formatDateTime, relativeTime } from '../../utils/format'

export default function RecommendedDonationsPage() {
  const { data, isLoading, error, reload } = useApi(getRecommendedDonations, [], { pollMs: 30000 })
  const [target, setTarget] = useState(null)
  const { toast, showToast } = useToast()

  const handleRequest = async ({ text }) => {
    try {
      const { message } = await requestDonation(target.donation.id, text)
      showToast(message)
      setTarget(null)
      reload({ silent: true })
    } catch (err) {
      showToast(getErrorMessage(err), 'error')
    }
  }

  return (
    <div>
      <Toast toast={toast} />
      <PageHeader title="Recommended for you" subtitle={data ? `Ranked by match score. Your free capacity: ${data.available_capacity} servings.` : ''} />
      {isLoading ? <PageLoader /> : error ? <Alert type="error">{error}</Alert> : data.items.length === 0 ? (
        <EmptyState title="No recommendations right now" message={data.message || 'No open donation currently fits your area, capacity, storage and dietary rules. Check "Available donations" to see everything.'}
          action={<Link to="/ngo/available" className="btn-secondary">Browse all donations</Link>} />
      ) : (
        <div className="space-y-4">
          {data.items.map((item) => (
            <article key={item.donation.id} className="card">
              <div className="flex flex-col gap-4 md:flex-row">
                <ScoreCircle score={item.score} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link to={`/donations/${item.donation.id}`} className="text-lg font-semibold hover:text-brand-700 hover:underline">{item.donation.food_name}</Link>
                    <StatusBadge status={item.donation.status} />
                  </div>
                  <p className="text-sm text-gray-500">
                    {label(FOOD_CATEGORIES, item.donation.category)} · {label(DIETARY_TYPES, item.donation.dietary_type)} · {item.donation.servings} servings · {item.donation.pickup_area} ({item.donation.pickup_postal_code}) · by {item.donation.donor_name}
                  </p>
                  <p className="text-sm text-gray-500">Pickup by {formatDateTime(item.donation.pickup_deadline)} ({relativeTime(item.donation.pickup_deadline)})</p>
                  <p className="mt-2 rounded-lg bg-brand-50 p-3 text-sm text-brand-900">{item.explanation.replace('the NGO', 'your NGO')}</p>
                  <details className="mt-3">
                    <summary className="cursor-pointer text-sm font-medium text-brand-700">Score breakdown</summary>
                    <div className="mt-3 max-w-xl"><ScoreBreakdown components={item.components} /></div>
                  </details>
                </div>
                <div className="flex shrink-0 flex-col gap-2">
                  <button className="btn-primary" onClick={() => setTarget(item)}><HandHeart className="h-4 w-4" /> Request</button>
                  <Link to={`/donations/${item.donation.id}`} className="btn-secondary">Details</Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      <ConfirmDialog open={Boolean(target)} title={`Request "${target?.donation.food_name}"?`}
        message="The donor will be notified and can accept or reject your request." textLabel="Message to the donor (optional)"
        confirmLabel="Send request" onConfirm={handleRequest} onCancel={() => setTarget(null)} />
    </div>
  )
}
