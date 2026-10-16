/**
 * AuditLogPage.jsx - read-only record of important admin actions (GET /api/admin/audit-logs).
 */
import { ScrollText } from 'lucide-react'
import { useState } from 'react'
import { Alert, EmptyState, PageHeader, PageLoader, Pagination } from '../../components/ui'
import useApi from '../../hooks/useApi'
import { getAuditLogs } from '../../services/adminService'
import { formatDateTime } from '../../utils/format'

const ACTIONS = ['NGO_VERIFIED', 'NGO_REJECTED', 'USER_SUSPENDED', 'USER_REACTIVATED', 'DONATION_REJECTED', 'REPORT_RESOLVED', 'REPORT_DISMISSED']

export default function AuditLogPage() {
  const [action, setAction] = useState('')
  const [page, setPage] = useState(1)
  const { data, isLoading, error } = useApi(() => getAuditLogs({ action: action || undefined, page, per_page: 15 }), [action, page])

  return (
    <div>
      <PageHeader title="Audit log" subtitle="Every important administrative action is recorded here and cannot be edited."
        actions={
          <select aria-label="Filter by action" className="input" value={action} onChange={(e) => { setAction(e.target.value); setPage(1) }}>
            <option value="">All actions</option>{ACTIONS.map((a) => <option key={a} value={a}>{a.replace(/_/g, ' ').toLowerCase()}</option>)}
          </select>
        } />
      {isLoading ? <PageLoader /> : error ? <Alert type="error">{error}</Alert> : data.items.length === 0 ? <EmptyState icon={ScrollText} title="No audit entries" /> : (
        <div className="card overflow-x-auto p-0">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50"><tr><th className="table-head">When</th><th className="table-head">Admin</th><th className="table-head">Action</th><th className="table-head">Target</th><th className="table-head">Details</th></tr></thead>
            <tbody className="divide-y divide-gray-100">
              {data.items.map((entry) => (
                <tr key={entry.id}>
                  <td className="table-cell whitespace-nowrap">{formatDateTime(entry.created_at)}</td>
                  <td className="table-cell">{entry.actor_name}</td>
                  <td className="table-cell"><span className="rounded bg-gray-100 px-2 py-0.5 font-mono text-xs">{entry.action}</span></td>
                  <td className="table-cell">{entry.target_type} #{entry.target_id}</td>
                  <td className="table-cell text-gray-600">{entry.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && <Pagination page={data.page} pages={data.pages} onChange={setPage} />}
    </div>
  )
}
