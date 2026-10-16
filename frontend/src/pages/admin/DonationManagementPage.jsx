/**
 * DonationManagementPage.jsx - every donation on the platform with filters.
 * Clicking a row opens the full details page (timeline, requests, safety checklist),
 * where admins can also remove a donation through moderation.
 */
import { Search } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import StatusBadge from '../../components/StatusBadge'
import { Alert, EmptyState, PageHeader, PageLoader, Pagination } from '../../components/ui'
import useApi from '../../hooks/useApi'
import { getAllDonations } from '../../services/adminService'
import { STATUS_INFO } from '../../utils/constants'
import { formatDateTime } from '../../utils/format'

export default function DonationManagementPage() {
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [page, setPage] = useState(1)
  const { data, isLoading, error } = useApi(
    () => getAllDonations({ status: status || undefined, search: search || undefined, page, per_page: 12 }),
    [status, search, page],
    { pollMs: 30000 },
  )

  return (
    <div>
      <PageHeader title="Donation management" subtitle="Inspect every donation, its requests and its status history." />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <form className="relative flex-1" onSubmit={(e) => { e.preventDefault(); setPage(1); setSearch(searchInput) }}>
          <label htmlFor="donation-search" className="sr-only">Search donations</label>
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <input id="donation-search" className="input pl-9" placeholder="Search food name or area and press Enter" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
        </form>
        <select aria-label="Status" className="input sm:w-56" value={status} onChange={(e) => { setPage(1); setStatus(e.target.value) }}>
          <option value="">All statuses</option>
          {Object.entries(STATUS_INFO).map(([value, info]) => <option key={value} value={value}>{info.label}</option>)}
        </select>
      </div>
      {isLoading ? <PageLoader /> : error ? <Alert type="error">{error}</Alert> : data.items.length === 0 ? <EmptyState title="No donations found" /> : (
        <div className="card overflow-x-auto p-0">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50"><tr><th className="table-head">#</th><th className="table-head">Food</th><th className="table-head">Donor</th><th className="table-head">Servings</th><th className="table-head">Area</th><th className="table-head">NGO</th><th className="table-head">Requests</th><th className="table-head">Status</th><th className="table-head">Created</th></tr></thead>
            <tbody className="divide-y divide-gray-100">
              {data.items.map((d) => (
                <tr key={d.id} className="hover:bg-gray-50">
                  <td className="table-cell text-gray-400">{d.id}</td>
                  <td className="table-cell font-medium"><Link to={`/donations/${d.id}`} className="text-brand-700 hover:underline">{d.food_name}</Link></td>
                  <td className="table-cell">{d.donor_name}</td>
                  <td className="table-cell">{d.servings}</td>
                  <td className="table-cell">{d.pickup_area}</td>
                  <td className="table-cell">{d.assigned_ngo_name || '-'}</td>
                  <td className="table-cell">{d.request_count}</td>
                  <td className="table-cell"><StatusBadge status={d.status} /></td>
                  <td className="table-cell whitespace-nowrap">{formatDateTime(d.created_at)}</td>
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
