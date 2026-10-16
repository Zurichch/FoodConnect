/**
 * NgoVerificationPage.jsx - approve or reject NGO registrations.
 * Only verified NGOs can request donations or appear in matching recommendations.
 */
import { BadgeCheck, MapPin, XCircle } from 'lucide-react'
import { useState } from 'react'
import ConfirmDialog from '../../components/ConfirmDialog'
import { Alert, EmptyState, PageHeader, PageLoader, Pagination, Tabs, Toast } from '../../components/ui'
import useApi from '../../hooks/useApi'
import useToast from '../../hooks/useToast'
import { getNgos, rejectNgo, verifyNgo } from '../../services/adminService'
import { getErrorMessage } from '../../services/api'
import { FOOD_CATEGORIES, NGO_DIETARY_PREFERENCES, label } from '../../utils/constants'
import { formatDate } from '../../utils/format'

const STATUS_STYLE = { pending: 'bg-amber-100 text-amber-800', verified: 'bg-brand-100 text-brand-800', rejected: 'bg-red-100 text-red-700' }

export default function NgoVerificationPage() {
  const [status, setStatus] = useState('pending')
  const [page, setPage] = useState(1)
  const [dialog, setDialog] = useState(null)
  const { toast, showToast } = useToast()
  const { data, isLoading, error, reload } = useApi(() => getNgos({ status: status || undefined, page, per_page: 10 }), [status, page])

  const handleConfirm = async ({ text }) => {
    try {
      const result = dialog.type === 'verify' ? await verifyNgo(dialog.ngo.id, text) : await rejectNgo(dialog.ngo.id, text)
      showToast(result.message)
      setDialog(null)
      reload({ silent: true })
    } catch (err) {
      showToast(getErrorMessage(err), 'error')
    }
  }

  return (
    <div>
      <Toast toast={toast} />
      <PageHeader title="NGO verification" subtitle="Check each organisation's details before allowing it to receive food." />
      <Tabs tabs={[{ value: 'pending', label: 'Pending' }, { value: 'verified', label: 'Verified' }, { value: 'rejected', label: 'Rejected' }, { value: '', label: 'All' }]}
        active={status} onChange={(v) => { setStatus(v); setPage(1) }} />

      {isLoading ? <PageLoader /> : error ? <Alert type="error">{error}</Alert> : data.items.length === 0 ? (
        <EmptyState title="No NGOs in this list" message={status === 'pending' ? 'There are no verification requests waiting.' : ''} />
      ) : (
        <div className="space-y-4">
          {data.items.map((ngo) => (
            <article key={ngo.id} className="card">
              <div className="flex flex-col gap-3 md:flex-row md:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold">{ngo.organization_name}</h2>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${STATUS_STYLE[ngo.verification_status]}`}>{ngo.verification_status}</span>
                    {ngo.is_suspended && <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-semibold text-white">Account suspended</span>}
                  </div>
                  <p className="text-sm text-gray-500">Reg. no: {ngo.registration_number || 'not provided'} · {ngo.contact_email} · {ngo.contact_phone} · registered {formatDate(ngo.created_at)}</p>
                  {ngo.description && <p className="mt-2 text-sm text-gray-600">{ngo.description}</p>}
                  <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm text-gray-600 sm:grid-cols-2">
                    <div className="flex gap-1"><MapPin className="h-4 w-4 text-brand-600" /><dt className="sr-only">Areas</dt><dd>{ngo.service_areas.join(', ')} ({ngo.postal_codes.join(', ') || 'no PINs'})</dd></div>
                    <div><dt className="inline font-medium">Capacity: </dt><dd className="inline">{ngo.max_capacity_servings} servings · {ngo.pickup_lead_time_minutes} min travel</dd></div>
                    <div><dt className="inline font-medium">Diet: </dt><dd className="inline">{label(NGO_DIETARY_PREFERENCES, ngo.dietary_preference)}</dd></div>
                    <div><dt className="inline font-medium">Prefers: </dt><dd className="inline">{ngo.preferred_categories.length ? ngo.preferred_categories.map((c) => label(FOOD_CATEGORIES, c)).join(', ') : 'all categories'}</dd></div>
                  </dl>
                  {ngo.verification_note && <p className="mt-2 text-xs text-gray-500">Note: {ngo.verification_note}</p>}
                </div>
                <div className="flex shrink-0 gap-2 md:flex-col">
                  {ngo.verification_status !== 'verified' && <button className="btn-primary" onClick={() => setDialog({ type: 'verify', ngo })}><BadgeCheck className="h-4 w-4" /> Verify</button>}
                  {ngo.verification_status !== 'rejected' && <button className="btn-secondary text-red-700" onClick={() => setDialog({ type: 'reject', ngo })}><XCircle className="h-4 w-4" /> Reject</button>}
                </div>
              </div>
            </article>
          ))}
          <Pagination page={data.page} pages={data.pages} onChange={setPage} />
        </div>
      )}

      <ConfirmDialog open={Boolean(dialog)}
        title={dialog?.type === 'verify' ? `Verify ${dialog?.ngo.organization_name}?` : `Reject ${dialog?.ngo.organization_name}?`}
        message={dialog?.type === 'verify' ? 'The NGO will be able to request donations and appear in recommendations.' : 'The NGO will be removed from recommendations and told the reason.'}
        textLabel={dialog?.type === 'verify' ? 'Note (optional)' : 'Reason'} textRequired={dialog?.type === 'reject'}
        confirmLabel={dialog?.type === 'verify' ? 'Verify NGO' : 'Reject NGO'} tone={dialog?.type === 'verify' ? 'primary' : 'danger'}
        onConfirm={handleConfirm} onCancel={() => setDialog(null)} />
    </div>
  )
}
