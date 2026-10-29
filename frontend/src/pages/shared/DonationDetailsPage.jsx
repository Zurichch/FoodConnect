/**
 * DonationDetailsPage.jsx - full details, live status timeline, safety checklist and actions.
 *
 * Data: GET /api/donations/:id (refreshed every 15 s = near-real-time status tracking).
 * The backend also sends `allowed_actions` for the current user, so only valid buttons
 * are shown. Each action is still checked again by the backend when clicked.
 */
import {
  ArrowLeft, Ban, CalendarClock, Check, ClipboardCheck, Flag, HandHeart, MapPin, Pencil, PackageCheck, Phone, RefreshCw, Sparkles, Truck, X,
} from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import ConfirmDialog from '../../components/ConfirmDialog'
import DonationTimeline from '../../components/DonationTimeline'
import DonationMap from '../../components/maps/DonationMap'
import SafetyChecklist from '../../components/SafetyChecklist'
import StatusBadge from '../../components/StatusBadge'
import { Alert, PageLoader, Toast } from '../../components/ui'
import useApi from '../../hooks/useApi'
import useAuth from '../../hooks/useAuth'
import useToast from '../../hooks/useToast'
import { moderateDonation } from '../../services/adminService'
import { getErrorMessage } from '../../services/api'
import { cancelDonation, getDonation, reportDonation, requestDonation, updateStatus } from '../../services/donationService'
import { acceptRequest, rejectRequest } from '../../services/requestService'
import { DIETARY_TYPES, FOOD_CATEGORIES, STATUS_INFO, STORAGE_TYPES, label } from '../../utils/constants'
import { formatDateTime, inputToIso, relativeTime } from '../../utils/format'

// What each action button looks like and which dialog it opens.
const ACTIONS = {
  request: { text: 'Request collection', icon: HandHeart, tone: 'primary', dialog: { title: 'Request this donation?', message: 'The donor will be notified and can accept or reject your request.', textLabel: 'Message to the donor (optional)', confirmLabel: 'Send request' } },
  set_pickup_scheduled: { text: 'Schedule pickup', icon: CalendarClock, tone: 'primary', dialog: { title: 'Schedule pickup', message: 'Choose when your team will collect the food (before the pickup deadline).', dateTimeLabel: 'Planned pickup time', textLabel: 'Note (optional)', confirmLabel: 'Schedule' } },
  set_collected: { text: 'Mark as collected', icon: Truck, tone: 'primary', dialog: { title: 'Mark as collected?', message: 'Confirm that your team has picked up the food from the donor.', textLabel: 'Note (optional)', confirmLabel: 'Mark collected' } },
  set_delivered: { text: 'Mark as delivered', icon: PackageCheck, tone: 'primary', dialog: { title: 'Mark as delivered?', message: 'Confirm that the food was distributed to people in need.', numberLabel: 'Servings distributed', textLabel: 'Note (optional)', confirmLabel: 'Mark delivered' } },
  cancel: { text: 'Cancel donation', icon: Ban, tone: 'danger', dialog: { title: 'Cancel this donation?', message: 'NGOs with pending or accepted requests will be notified. This cannot be undone.', textLabel: 'Reason', textRequired: true, confirmLabel: 'Cancel donation', tone: 'danger' } },
  report: { text: 'Report', icon: Flag, tone: 'secondary', dialog: { title: 'Report this donation', message: 'Tell the administrators what is wrong (e.g. unsafe, misleading or fraudulent).', textLabel: 'Reason', textRequired: true, confirmLabel: 'Send report', tone: 'danger' } },
  moderate_reject: { text: 'Remove (moderation)', icon: Ban, tone: 'danger', dialog: { title: 'Remove this donation?', message: 'The donation will be marked REJECTED and the donor notified. This is recorded in the audit log.', textLabel: 'Reason', textRequired: true, confirmLabel: 'Remove', tone: 'danger' } },
}

function InfoRow({ label: title, children }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">{title}</dt>
      <dd className="mt-0.5 text-sm text-gray-800">{children}</dd>
    </div>
  )
}

export default function DonationDetailsPage() {
  const { donationId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const { toast, showToast } = useToast()
  const [activeAction, setActiveAction] = useState(null)
  const [requestDialog, setRequestDialog] = useState(null)
  const [lastRefreshed, setLastRefreshed] = useState(new Date())
  const { data, isLoading, error, reload } = useApi(
    async () => { const result = await getDonation(donationId); setLastRefreshed(new Date()); return result },
    [donationId],
    { pollMs: 15000 },
  )

  if (isLoading) return <PageLoader />
  if (error) return <Alert type="error">{error}</Alert>

  const { donation, history, requests, allowed_actions: allowedActions } = data
  const backLink = { donor: '/donor/donations', ngo: '/ngo/available', admin: '/admin/donations' }[user.role]

  const runAction = async ({ text, dateTime, number }) => {
    try {
      let result
      if (activeAction === 'request') result = await requestDonation(donationId, text)
      else if (activeAction === 'cancel') result = await cancelDonation(donationId, text)
      else if (activeAction === 'report') result = await reportDonation(donationId, text)
      else if (activeAction === 'moderate_reject') result = await moderateDonation(donationId, text)
      else if (activeAction === 'set_pickup_scheduled') result = await updateStatus(donationId, { status: 'PICKUP_SCHEDULED', scheduled_pickup_at: inputToIso(dateTime), note: text })
      else if (activeAction === 'set_collected') result = await updateStatus(donationId, { status: 'COLLECTED', note: text })
      else if (activeAction === 'set_delivered') result = await updateStatus(donationId, { status: 'DELIVERED', servings_distributed: number === '' ? undefined : Number(number), note: text })
      showToast(result.message)
      setActiveAction(null)
      reload({ silent: true })
    } catch (err) {
      showToast(getErrorMessage(err), 'error')
    }
  }

  const runRequestDecision = async ({ text }) => {
    try {
      const action = requestDialog.type === 'accept' ? acceptRequest : rejectRequest
      const { message } = await action(requestDialog.request.id, text)
      showToast(message)
    } catch (err) {
      showToast(getErrorMessage(err), 'error')
    }
    setRequestDialog(null)
    reload({ silent: true })
  }

  const dialogConfig = activeAction ? ACTIONS[activeAction].dialog : null
  const buttonClass = (tone) => ({ primary: 'btn-primary', danger: 'btn-danger', secondary: 'btn-secondary' }[tone])

  return (
    <div>
      <Toast toast={toast} />
      <button onClick={() => (window.history.length > 1 ? navigate(-1) : navigate(backLink))} className="mb-4 inline-flex items-center gap-1 text-sm text-brand-700 hover:underline">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      {/* Header */}
      <div className="card mb-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="page-title">{donation.food_name}</h1>
              <StatusBadge status={donation.status} />
            </div>
            <p className="mt-1 text-sm text-gray-500">{STATUS_INFO[donation.status]?.meaning} · Donation #{donation.id} by {donation.donor_name}</p>
            <p className="mt-1 flex items-center gap-1 text-xs text-gray-400">
              <RefreshCw className="h-3 w-3" /> Auto-refreshes every 15 s · last checked {lastRefreshed.toLocaleTimeString()} · {data.tracking_note}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {allowedActions.includes('view_matches') && <Link to={`/donor/donations/${donation.id}/matches`} className="btn-primary"><Sparkles className="h-4 w-4" /> Recommended NGOs</Link>}
            {allowedActions.includes('edit') && <Link to={`/donor/donations/${donation.id}/edit`} className="btn-secondary"><Pencil className="h-4 w-4" /> Edit</Link>}
            {Object.keys(ACTIONS).filter((key) => allowedActions.includes(key)).map((key) => {
              const { text, icon: Icon, tone } = ACTIONS[key]
              return <button key={key} className={buttonClass(tone)} onClick={() => setActiveAction(key)}><Icon className="h-4 w-4" /> {text}</button>
            })}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="card">
            <h2 className="mb-4 flex items-center gap-2 font-semibold"><ClipboardCheck className="h-5 w-5 text-brand-700" /> Tracking timeline</h2>
            <DonationTimeline status={donation.status} history={history} />
          </section>

          <section className="card">
            <h2 className="mb-4 font-semibold">Food details</h2>
            <dl className="grid gap-4 sm:grid-cols-3">
              <InfoRow label="Category">{label(FOOD_CATEGORIES, donation.category)}</InfoRow>
              <InfoRow label="Quantity">{donation.quantity} {donation.quantity_unit}</InfoRow>
              <InfoRow label="Servings">{donation.servings}{donation.servings_distributed != null && ` (${donation.servings_distributed} distributed)`}</InfoRow>
              <InfoRow label="Dietary type">{label(DIETARY_TYPES, donation.dietary_type)}</InfoRow>
              <InfoRow label="Storage">{label(STORAGE_TYPES, donation.storage_type)}</InfoRow>
              <InfoRow label="Packaging">{donation.is_packaged ? 'Packaged' : 'Unpackaged'}</InfoRow>
              <InfoRow label="Prepared">{formatDateTime(donation.prepared_at)}</InfoRow>
              <InfoRow label="Use-by / expiry">{formatDateTime(donation.expires_at)}</InfoRow>
              <InfoRow label="Pickup deadline">{formatDateTime(donation.pickup_deadline)} <span className="text-gray-400">({relativeTime(donation.pickup_deadline)})</span></InfoRow>
              {donation.scheduled_pickup_at && <InfoRow label="Planned pickup">{formatDateTime(donation.scheduled_pickup_at)}</InfoRow>}
              {donation.assigned_ngo_name && <InfoRow label="Collecting NGO">{donation.assigned_ngo_name}</InfoRow>}
              {donation.cancel_reason && <InfoRow label="Reason">{donation.cancel_reason}</InfoRow>}
            </dl>
            {donation.description && <p className="mt-4 text-sm text-gray-600">{donation.description}</p>}
            {donation.notes && <p className="mt-2 rounded-lg bg-gray-50 p-3 text-sm text-gray-600"><strong>Notes:</strong> {donation.notes}</p>}
          </section>

          {requests.length > 0 && (
            <section className="card">
              <h2 className="mb-3 font-semibold">Collection requests</h2>
              <ul className="divide-y divide-gray-100">
                {requests.map((request) => {
                  const iCanDecide = request.status === 'pending' && (
                    (user.role === 'donor' && request.initiated_by === 'ngo') || (user.role === 'ngo' && request.initiated_by === 'donor'))
                  return (
                    <li key={request.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-medium">{request.ngo_name} <span className="text-xs text-gray-400">({request.initiated_by === 'ngo' ? 'requested by NGO' : 'offered by donor'})</span></p>
                        <p className="text-xs text-gray-500">{formatDateTime(request.created_at)}{request.match_score != null && ` · match score ${request.match_score}/100`}</p>
                        {request.message && <p className="text-sm italic text-gray-600">"{request.message}"</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge type="request" status={request.status} />
                        {iCanDecide && (
                          <>
                            <button className="btn-primary px-3 py-1.5" onClick={() => setRequestDialog({ type: 'accept', request })}><Check className="h-4 w-4" /> Accept</button>
                            <button className="btn-secondary px-3 py-1.5" onClick={() => setRequestDialog({ type: 'reject', request })}><X className="h-4 w-4" /> Reject</button>
                          </>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}
        </div>

        <aside className="space-y-6">
          <section className="card">
            <h2 className="mb-3 font-semibold">Pickup</h2>
            <p className="flex items-start gap-2 text-sm text-gray-700"><MapPin className="mt-0.5 h-4 w-4 text-brand-600" />
              {donation.pickup_address ? `${donation.pickup_address}, ` : ''}{donation.pickup_area} - {donation.pickup_postal_code}
            </p>
            {!donation.pickup_address && <p className="mt-2 text-xs text-gray-400">The exact address and phone number are shown to the NGO after the donor accepts its request.</p>}
            {donation.donor_phone && <p className="mt-2 flex items-center gap-2 text-sm text-gray-700"><Phone className="h-4 w-4 text-brand-600" /> Donor: {donation.donor_phone}</p>}
            {donation.assigned_ngo_phone && <p className="mt-2 flex items-center gap-2 text-sm text-gray-700"><Phone className="h-4 w-4 text-brand-600" /> NGO: {donation.assigned_ngo_phone}</p>}
            {data.map_location && (
              <div className="mt-4">
                <DonationMap height={200} showPopups={false}
                  markers={[{ ...data.map_location, donation_id: donation.id, urgency: 'low' }]} />
                <p className="mt-1 text-xs text-gray-400">
                  {data.map_location.precision === 'exact' ? 'Exact pickup point.' : 'Approximate area only - exact point shared after acceptance.'}
                  {' '}© OpenStreetMap contributors
                </p>
              </div>
            )}
          </section>
          <section className="card">
            <h2 className="mb-3 font-semibold">Food safety checklist</h2>
            <SafetyChecklist items={data.safety_checklist} warnings={donation.safety_warnings} disclaimer={data.safety_disclaimer} />
          </section>
        </aside>
      </div>

      <ConfirmDialog open={Boolean(activeAction)} {...(dialogConfig || {})} numberDefault={activeAction === 'set_delivered' ? donation.servings : undefined}
        onConfirm={runAction} onCancel={() => setActiveAction(null)} />
      <ConfirmDialog
        open={Boolean(requestDialog)}
        title={requestDialog?.type === 'accept' ? `Accept ${requestDialog?.request.ngo_name}?` : 'Reject this request?'}
        message={requestDialog?.type === 'accept' ? 'The donation will be reserved for this NGO. Other pending requests will be closed automatically.' : 'The NGO will be notified.'}
        textLabel="Note (optional)"
        confirmLabel={requestDialog?.type === 'accept' ? 'Accept' : 'Reject'}
        tone={requestDialog?.type === 'accept' ? 'primary' : 'danger'}
        onConfirm={runRequestDecision}
        onCancel={() => setRequestDialog(null)}
      />
    </div>
  )
}
