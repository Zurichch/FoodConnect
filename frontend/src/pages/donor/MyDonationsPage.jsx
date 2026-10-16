/**
 * MyDonationsPage.jsx - all of the donor's donations with a status filter, search and pagination.
 * Data: GET /api/donations/mine
 */
import { PlusCircle, Search } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import DonationCard from '../../components/DonationCard'
import { Alert, EmptyState, PageHeader, PageLoader, Pagination } from '../../components/ui'
import useApi from '../../hooks/useApi'
import { getMyDonations } from '../../services/donationService'
import { STATUS_INFO } from '../../utils/constants'

export default function MyDonationsPage() {
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const { data, isLoading, error } = useApi(
    () => getMyDonations({ page, per_page: 8, status: status || undefined, search: search || undefined }),
    [page, status, search],
    { pollMs: 20000 },
  )

  return (
    <div>
      <PageHeader title="My donations" subtitle="Every donation you have listed, newest first."
        actions={<Link to="/donor/donations/new" className="btn-primary"><PlusCircle className="h-4 w-4" /> Donate food</Link>} />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <form className="relative flex-1" onSubmit={(e) => { e.preventDefault(); setPage(1); setSearch(searchInput) }}>
          <label htmlFor="search" className="sr-only">Search by food name</label>
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <input id="search" className="input pl-9" placeholder="Search by food name and press Enter" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
        </form>
        <label htmlFor="status" className="sr-only">Filter by status</label>
        <select id="status" className="input sm:w-56" value={status} onChange={(e) => { setPage(1); setStatus(e.target.value) }}>
          <option value="">All statuses</option>
          {Object.entries(STATUS_INFO).map(([value, info]) => <option key={value} value={value}>{info.label}</option>)}
        </select>
      </div>

      {isLoading ? <PageLoader /> : error ? <Alert type="error">{error}</Alert> : data.items.length === 0 ? (
        <EmptyState title="No donations found" message="Try another filter, or create your first donation." />
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            {data.items.map((donation) => (
              <DonationCard key={donation.id} donation={donation} to={`/donations/${donation.id}`}
                extra={donation.pending_requests > 0 && <p className="text-sm font-medium text-amber-700">{donation.pending_requests} pending request(s)</p>}
                actions={
                  <>
                    <Link to={`/donations/${donation.id}`} className="btn-secondary">Details & tracking</Link>
                    {['AVAILABLE', 'REQUESTED'].includes(donation.status) && <Link to={`/donor/donations/${donation.id}/matches`} className="btn-ghost">View matches</Link>}
                  </>
                } />
            ))}
          </div>
          <Pagination page={data.page} pages={data.pages} onChange={setPage} />
        </>
      )}
    </div>
  )
}
