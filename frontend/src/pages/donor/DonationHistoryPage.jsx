/**
 * DonationHistoryPage.jsx - finished donations (delivered, cancelled, expired, rejected) in a table.
 * Data: GET /api/donations/mine?scope=history
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import StatusBadge from '../../components/StatusBadge'
import { Alert, EmptyState, PageHeader, PageLoader, Pagination } from '../../components/ui'
import useApi from '../../hooks/useApi'
import { getMyDonations } from '../../services/donationService'
import { FOOD_CATEGORIES, label } from '../../utils/constants'
import { formatDate } from '../../utils/format'

export default function DonationHistoryPage() {
  const [page, setPage] = useState(1)
  const { data, isLoading, error } = useApi(() => getMyDonations({ scope: 'history', page, per_page: 10 }), [page])

  return (
    <div>
      <PageHeader title="Donation history" subtitle="Completed and closed donations and their outcomes." />
      {isLoading ? <PageLoader /> : error ? <Alert type="error">{error}</Alert> : data.items.length === 0 ? (
        <EmptyState title="No finished donations yet" message="Delivered, cancelled or expired donations will appear here." />
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                <th className="table-head">Food</th><th className="table-head">Category</th><th className="table-head">Servings</th>
                <th className="table-head">Collected by</th><th className="table-head">Outcome</th><th className="table-head">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.items.map((d) => (
                <tr key={d.id} className="hover:bg-gray-50">
                  <td className="table-cell font-medium"><Link to={`/donations/${d.id}`} className="text-brand-700 hover:underline">{d.food_name}</Link></td>
                  <td className="table-cell">{label(FOOD_CATEGORIES, d.category)}</td>
                  <td className="table-cell">{d.servings}{d.servings_distributed != null && <span className="text-xs text-gray-400"> ({d.servings_distributed} distributed)</span>}</td>
                  <td className="table-cell">{d.assigned_ngo_name || '-'}</td>
                  <td className="table-cell"><StatusBadge status={d.status} />{d.cancel_reason && <p className="mt-1 text-xs text-gray-400">{d.cancel_reason}</p>}</td>
                  <td className="table-cell">{formatDate(d.created_at)}</td>
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
