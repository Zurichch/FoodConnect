/**
 * MatchRecommendationsPage.jsx - ranked NGO recommendations for one donation.
 * Data: GET /api/donations/:id/matches  (calculated by backend/app/services/matching.py)
 * "Offer to this NGO" calls POST /api/donations/:id/offer.
 */
import { ArrowLeft, Send, XCircle } from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import ConfirmDialog from '../../components/ConfirmDialog'
import MatchCard from '../../components/MatchCard'
import StatusBadge from '../../components/StatusBadge'
import { Alert, EmptyState, PageHeader, PageLoader, Toast } from '../../components/ui'
import useApi from '../../hooks/useApi'
import useToast from '../../hooks/useToast'
import { getErrorMessage } from '../../services/api'
import { getMatches, offerToNgo } from '../../services/donationService'

export default function MatchRecommendationsPage() {
  const { donationId } = useParams()
  const location = useLocation()
  const { data, isLoading, error, reload } = useApi(() => getMatches(donationId), [donationId])
  const [offerTarget, setOfferTarget] = useState(null)
  const { toast, showToast } = useToast()

  if (isLoading) return <PageLoader text="Calculating matches..." />
  if (error) return <Alert type="error">{error}</Alert>

  const handleOffer = async ({ text }) => {
    try {
      const { message } = await offerToNgo(donationId, offerTarget.ngo.id, text)
      showToast(message)
      setOfferTarget(null)
      reload({ silent: true })
    } catch (err) {
      showToast(getErrorMessage(err), 'error')
    }
  }

  const donation = data.donation
  return (
    <div>
      <Toast toast={toast} />
      <Link to={`/donations/${donationId}`} className="mb-4 inline-flex items-center gap-1 text-sm text-brand-700 hover:underline"><ArrowLeft className="h-4 w-4" /> Back to donation</Link>
      {location.state?.justCreated && <div className="mb-4"><Alert type="success">Donation published! It passed the safety checks and is now visible to verified NGOs.</Alert></div>}
      <PageHeader
        title="Recommended NGOs"
        subtitle={`For "${donation.food_name}" - ${donation.servings} servings in ${donation.pickup_area} (${donation.pickup_postal_code})`}
        actions={<StatusBadge status={donation.status} />}
      />
      {data.message && <Alert type="info">{data.message}</Alert>}
      {data.location_basis && <p className="mb-4 text-xs text-gray-500">{data.location_basis}</p>}

      {data.recommendations.length === 0 && !data.message ? (
        <EmptyState title="No suitable NGO right now" message="No verified NGO passed all the safety, capacity, timing and area rules. NGOs can still find your donation in their 'Available donations' list." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {data.recommendations.map((match) => (
            <MatchCard
              key={match.ngo.id}
              match={match}
              footer={match.existing_request ? (
                <p className="text-sm text-gray-600">
                  Request status: <StatusBadge type="request" status={match.existing_request.status} />
                  {' '}({match.existing_request.initiated_by === 'donor' ? 'offered by you' : 'requested by NGO'})
                </p>
              ) : (
                <button className="btn-primary" onClick={() => setOfferTarget(match)}><Send className="h-4 w-4" /> Offer to this NGO</button>
              )}
            />
          ))}
        </div>
      )}

      {data.excluded?.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-semibold">Verified NGOs not recommended</h2>
          <div className="card divide-y divide-gray-100 p-0">
            {data.excluded.map((entry) => (
              <div key={entry.ngo.id} className="flex items-start gap-3 p-4">
                <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
                <div>
                  <p className="font-medium">{entry.ngo.organization_name}</p>
                  <p className="text-sm text-gray-500">{entry.exclusion_reasons.map((r) => r.reason).join('; ')}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-gray-500">Safety, capacity and timing rules are applied before scoring. A high score can never override them.</p>
        </section>
      )}

      <ConfirmDialog
        open={Boolean(offerTarget)}
        title={`Offer to ${offerTarget?.ngo.organization_name}?`}
        message="The NGO will be notified and can accept or decline. Once accepted, the donation is reserved for them."
        textLabel="Message to the NGO (optional)"
        confirmLabel="Send offer"
        onConfirm={handleOffer}
        onCancel={() => setOfferTarget(null)}
      />
    </div>
  )
}
