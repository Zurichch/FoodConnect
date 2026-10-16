/**
 * ReportsPage.jsx - moderation: donation reports from users, and Contact-page messages.
 * Resolving a report can also remove the donation (status REJECTED); everything is audit-logged.
 */
import { CheckCircle2, Mail } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import StatusBadge from '../../components/StatusBadge'
import { Alert, EmptyState, PageHeader, PageLoader, Pagination, Tabs, Toast } from '../../components/ui'
import useApi from '../../hooks/useApi'
import useToast from '../../hooks/useToast'
import { getContactMessages, getReports, resolveReport } from '../../services/adminService'
import { getErrorMessage } from '../../services/api'
import { formatDateTime } from '../../utils/format'

function ResolveForm({ report, onDone, onCancel }) {
  const [outcome, setOutcome] = useState('resolved')
  const [note, setNote] = useState('')
  const [rejectDonation, setRejectDonation] = useState(false)
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    if (!note.trim()) return setError('Please write a resolution note.')
    setIsSaving(true)
    try {
      const { message } = await resolveReport(report.id, { outcome, note, reject_donation: rejectDonation })
      onDone(message)
    } catch (err) {
      setError(getErrorMessage(err))
      setIsSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="mt-3 space-y-3 rounded-xl bg-gray-50 p-4">
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2"><input type="radio" checked={outcome === 'resolved'} onChange={() => setOutcome('resolved')} className="accent-brand-700" /> Resolved (valid report)</label>
        <label className="flex items-center gap-2"><input type="radio" checked={outcome === 'dismissed'} onChange={() => setOutcome('dismissed')} className="accent-brand-700" /> Dismissed</label>
      </div>
      <label htmlFor={`note-${report.id}`} className="label">Resolution note</label>
      <textarea id={`note-${report.id}`} rows={2} className="input" value={note} onChange={(e) => setNote(e.target.value)} />
      <label className="flex items-center gap-2 text-sm text-red-700">
        <input type="checkbox" checked={rejectDonation} onChange={(e) => setRejectDonation(e.target.checked)} /> Also remove the donation from the platform
      </label>
      {error && <p className="field-error">{error}</p>}
      <div className="flex gap-2">
        <button className="btn-primary" disabled={isSaving}>Save decision</button>
        <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}

export default function ReportsPage() {
  const [tab, setTab] = useState('open')
  const [page, setPage] = useState(1)
  const [resolving, setResolving] = useState(null)
  const { toast, showToast } = useToast()
  const isMessages = tab === 'messages'
  const { data, isLoading, error, reload } = useApi(
    () => (isMessages ? getContactMessages({ page }) : getReports({ status: tab === 'all' ? undefined : tab, page })),
    [tab, page],
  )

  return (
    <div>
      <Toast toast={toast} />
      <PageHeader title="Reports & moderation" subtitle="Review flagged donations and messages from the contact page." />
      <Tabs tabs={[{ value: 'open', label: 'Open reports' }, { value: 'resolved', label: 'Resolved' }, { value: 'dismissed', label: 'Dismissed' }, { value: 'messages', label: 'Contact messages' }]}
        active={tab} onChange={(v) => { setTab(v); setPage(1) }} />

      {isLoading ? <PageLoader /> : error ? <Alert type="error">{error}</Alert> : data.items.length === 0 ? (
        <EmptyState icon={isMessages ? Mail : CheckCircle2} title={isMessages ? 'No messages' : 'Nothing to review'} />
      ) : isMessages ? (
        <ul className="space-y-3">
          {data.items.map((m) => (
            <li key={m.id} className="card">
              <p className="font-semibold">{m.subject}</p>
              <p className="text-xs text-gray-500">{m.name} · {m.email} · {formatDateTime(m.created_at)}</p>
              <p className="mt-2 whitespace-pre-line text-sm text-gray-700">{m.message}</p>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="space-y-3">
          {data.items.map((report) => (
            <li key={report.id} className="card">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-semibold">Report #{report.id}: <Link to={`/donations/${report.donation_id}`} className="text-brand-700 hover:underline">{report.donation_name}</Link></p>
                  <p className="text-xs text-gray-500">by {report.reporter_name} · {formatDateTime(report.created_at)}</p>
                  <p className="mt-2 text-sm text-gray-700">"{report.reason}"</p>
                  {report.resolution_note && <p className="mt-1 text-sm text-gray-500">Decision: {report.resolution_note}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={report.donation_status} />
                  {report.status === 'open' && resolving !== report.id && <button className="btn-primary" onClick={() => setResolving(report.id)}>Review</button>}
                </div>
              </div>
              {resolving === report.id && (
                <ResolveForm report={report} onCancel={() => setResolving(null)}
                  onDone={(message) => { showToast(message); setResolving(null); reload({ silent: true }) }} />
              )}
            </li>
          ))}
        </ul>
      )}
      {data && <Pagination page={data.page} pages={data.pages} onChange={setPage} />}
    </div>
  )
}
