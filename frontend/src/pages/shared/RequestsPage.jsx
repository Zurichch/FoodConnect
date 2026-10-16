/**
 * RequestsPage.jsx - collection requests, used by BOTH donors and NGOs.
 *
 * Tab 1 "Waiting for your decision" -> GET /api/requests/incoming
 *    donor: requests NGOs sent for the donor's food
 *    NGO:   offers donors sent to the NGO
 * Tab 2 "Sent by you" -> GET /api/requests/sent
 *
 * Accept calls POST /api/requests/:id/accept. The backend makes sure only one
 * NGO can ever be accepted per donation (a second accept gets "409 already claimed").
 */
import { Check, Undo2, X } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import ConfirmDialog from '../../components/ConfirmDialog'
import StatusBadge from '../../components/StatusBadge'
import { Alert, EmptyState, PageHeader, PageLoader, Pagination, Tabs, Toast } from '../../components/ui'
import useApi from '../../hooks/useApi'
import useToast from '../../hooks/useToast'
import { getErrorMessage } from '../../services/api'
import { acceptRequest, getIncomingRequests, getSentRequests, rejectRequest, withdrawRequest } from '../../services/requestService'
import { formatDateTime, relativeTime } from '../../utils/format'

const TEXT = {
  donor: {
    title: 'NGO requests',
    subtitle: 'NGOs that want to collect your food, and offers you sent to NGOs.',
    incoming: 'Requests from NGOs', sent: 'Offers you sent',
    emptyIncoming: 'No NGO requests are waiting for you.',
  },
  ngo: {
    title: 'Requests & offers',
    subtitle: 'Donations offered to your NGO, and requests your NGO has sent.',
    incoming: 'Offers from donors', sent: 'Requests you sent',
    emptyIncoming: 'No donor offers are waiting for you.',
  },
}

export default function RequestsPage({ role }) {
  const text = TEXT[role]
  const [tab, setTab] = useState('incoming')
  const [statusFilter, setStatusFilter] = useState('pending')
  const [page, setPage] = useState(1)
  const [dialog, setDialog] = useState(null) // { type: 'accept' | 'reject' | 'withdraw', request }
  const { toast, showToast } = useToast()
  const { data, isLoading, error, reload } = useApi(
    () => (tab === 'incoming' ? getIncomingRequests : getSentRequests)({ status: statusFilter, page, per_page: 10 }),
    [tab, statusFilter, page],
    { pollMs: 15000 },
  )

  const runAction = async ({ text: note }) => {
    const { type, request } = dialog
    try {
      const action = { accept: acceptRequest, reject: rejectRequest, withdraw: withdrawRequest }[type]
      const { message } = await action(request.id, note)
      showToast(message)
    } catch (err) {
      showToast(getErrorMessage(err), 'error')
    }
    setDialog(null)
    reload({ silent: true })
  }

  return (
    <div>
      <Toast toast={toast} />
      <PageHeader title={text.title} subtitle={text.subtitle} />
      <div className="flex flex-col justify-between gap-2 sm:flex-row">
        <Tabs tabs={[{ value: 'incoming', label: text.incoming }, { value: 'sent', label: text.sent }]} active={tab} onChange={(v) => { setTab(v); setPage(1) }} />
        <div>
          <label htmlFor="request-status" className="sr-only">Request status</label>
          <select id="request-status" className="input" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}>
            <option value="pending">Pending</option><option value="accepted">Accepted</option>
            <option value="rejected">Rejected</option><option value="withdrawn">Withdrawn</option><option value="all">All</option>
          </select>
        </div>
      </div>

      {isLoading ? <PageLoader /> : error ? <Alert type="error">{error}</Alert> : data.items.length === 0 ? (
        <EmptyState title="Nothing here" message={tab === 'incoming' && statusFilter === 'pending' ? text.emptyIncoming : 'No requests match this filter.'} />
      ) : (
        <div className="space-y-3">
          {data.items.map((request) => (
            <article key={request.id} className="card">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <Link to={`/donations/${request.donation.id}`} className="font-semibold text-gray-900 hover:text-brand-700 hover:underline">{request.donation.food_name}</Link>
                  <p className="text-sm text-gray-500">
                    {request.donation.servings} servings · {request.donation.pickup_area} · pickup by {formatDateTime(request.donation.pickup_deadline)} ({relativeTime(request.donation.pickup_deadline)})
                  </p>
                  <p className="mt-1 text-sm text-gray-700">
                    {role === 'donor' ? <>NGO: <strong>{request.ngo_name}</strong></> : <>Donor: <strong>{request.donation.donor_name}</strong></>}
                    {request.match_score != null && <span className="ml-2 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">Match score {request.match_score}/100</span>}
                  </p>
                  {request.message && <p className="mt-2 rounded-lg bg-gray-50 p-2 text-sm italic text-gray-600">"{request.message}"</p>}
                  {request.response_note && <p className="mt-1 text-xs text-gray-500">Note: {request.response_note}</p>}
                  <p className="mt-1 text-xs text-gray-400">Sent {formatDateTime(request.created_at)}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <StatusBadge type="request" status={request.status} />
                  <StatusBadge status={request.donation.status} />
                </div>
              </div>
              {request.status === 'pending' && (
                <div className="mt-3 flex flex-wrap gap-2 border-t border-gray-100 pt-3">
                  {tab === 'incoming' ? (
                    <>
                      <button className="btn-primary" onClick={() => setDialog({ type: 'accept', request })}><Check className="h-4 w-4" /> Accept</button>
                      <button className="btn-secondary" onClick={() => setDialog({ type: 'reject', request })}><X className="h-4 w-4" /> Reject</button>
                    </>
                  ) : (
                    <button className="btn-secondary" onClick={() => setDialog({ type: 'withdraw', request })}><Undo2 className="h-4 w-4" /> Withdraw</button>
                  )}
                </div>
              )}
            </article>
          ))}
          <Pagination page={data.page} pages={data.pages} onChange={setPage} />
        </div>
      )}

      <ConfirmDialog
        open={Boolean(dialog)}
        title={{ accept: 'Accept this request?', reject: 'Reject this request?', withdraw: 'Withdraw this request?' }[dialog?.type]}
        message={{
          accept: 'The donation will be reserved for this NGO and all other pending requests will be closed.',
          reject: 'The other party will be notified.',
          withdraw: 'Your pending request will be cancelled.',
        }[dialog?.type]}
        textLabel={dialog?.type === 'withdraw' ? undefined : 'Note (optional)'}
        confirmLabel={{ accept: 'Accept', reject: 'Reject', withdraw: 'Withdraw' }[dialog?.type]}
        tone={dialog?.type === 'accept' ? 'primary' : 'danger'}
        onConfirm={runAction}
        onCancel={() => setDialog(null)}
      />
    </div>
  )
}
