/**
 * AvailableDonationsPage.jsx - every open donation with filters.
 * Filters are sent as URL query parameters to GET /api/donations/available,
 * so the filtering happens in the database, not in the browser.
 */
import { Filter, HandHeart, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import ConfirmDialog from '../../components/ConfirmDialog'
import DonationCard from '../../components/DonationCard'
import { Alert, EmptyState, PageHeader, PageLoader, Pagination, Toast } from '../../components/ui'
import useApi from '../../hooks/useApi'
import useToast from '../../hooks/useToast'
import { getErrorMessage } from '../../services/api'
import { getAvailableDonations, requestDonation } from '../../services/donationService'
import { DIETARY_TYPES, FOOD_CATEGORIES, STORAGE_TYPES } from '../../utils/constants'

const EMPTY_FILTERS = { my_area: false, area: '', category: '', dietary_type: '', storage_type: '', min_servings: '', max_servings: '', deadline_within_hours: '', sort: 'deadline' }

export default function AvailableDonationsPage() {
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [applied, setApplied] = useState(EMPTY_FILTERS)
  const [page, setPage] = useState(1)
  const [target, setTarget] = useState(null)
  const { toast, showToast } = useToast()

  // Only send filters that have a value.
  const params = Object.fromEntries(Object.entries({ ...applied, my_area: applied.my_area ? 'true' : '' }).filter(([, v]) => v !== '' && v !== false))
  const { data, isLoading, error, reload } = useApi(() => getAvailableDonations({ ...params, page, per_page: 8 }), [JSON.stringify(applied), page], { pollMs: 30000 })

  const set = (field) => (e) => setFilters({ ...filters, [field]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })
  const apply = (event) => { event.preventDefault(); setPage(1); setApplied(filters) }
  const reset = () => { setFilters(EMPTY_FILTERS); setApplied(EMPTY_FILTERS); setPage(1) }

  const handleRequest = async ({ text }) => {
    try {
      const { message } = await requestDonation(target.id, text)
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
      <PageHeader title="Available donations" subtitle="Open donations from all donors. Exact addresses are shared after a donor accepts your request." />

      <form onSubmit={apply} className="card mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Filters">
        <div><label htmlFor="area" className="label">Area or PIN</label><input id="area" className="input" placeholder="e.g. Adyar or 6000" value={filters.area} onChange={set('area')} /></div>
        <div><label htmlFor="category" className="label">Category</label>
          <select id="category" className="input" value={filters.category} onChange={set('category')}><option value="">All</option>{Object.entries(FOOD_CATEGORIES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
        <div><label htmlFor="dietary_type" className="label">Dietary type</label>
          <select id="dietary_type" className="input" value={filters.dietary_type} onChange={set('dietary_type')}><option value="">All</option>{Object.entries(DIETARY_TYPES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
        <div><label htmlFor="storage_type" className="label">Storage</label>
          <select id="storage_type" className="input" value={filters.storage_type} onChange={set('storage_type')}><option value="">All</option>{Object.entries(STORAGE_TYPES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
        <div className="grid grid-cols-2 gap-2">
          <div><label htmlFor="min_servings" className="label">Min servings</label><input id="min_servings" type="number" min="1" className="input" value={filters.min_servings} onChange={set('min_servings')} /></div>
          <div><label htmlFor="max_servings" className="label">Max servings</label><input id="max_servings" type="number" min="1" className="input" value={filters.max_servings} onChange={set('max_servings')} /></div>
        </div>
        <div><label htmlFor="deadline" className="label">Pickup deadline within</label>
          <select id="deadline" className="input" value={filters.deadline_within_hours} onChange={set('deadline_within_hours')}>
            <option value="">Any time</option><option value="2">2 hours</option><option value="6">6 hours</option><option value="24">24 hours</option>
          </select></div>
        <div><label htmlFor="sort" className="label">Sort by</label>
          <select id="sort" className="input" value={filters.sort} onChange={set('sort')}>
            <option value="deadline">Earliest deadline</option><option value="newest">Newest</option><option value="servings">Most servings</option>
          </select></div>
        <div className="flex flex-col justify-end gap-2">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-brand-700" checked={filters.my_area} onChange={set('my_area')} /> Only my service areas</label>
          <div className="flex gap-2">
            <button className="btn-primary flex-1"><Filter className="h-4 w-4" /> Apply</button>
            <button type="button" className="btn-secondary" onClick={reset} aria-label="Reset filters"><RotateCcw className="h-4 w-4" /></button>
          </div>
        </div>
      </form>

      {isLoading ? <PageLoader /> : error ? <Alert type="error">{error}</Alert> : data.items.length === 0 ? (
        <EmptyState title="No donations match these filters" message="Try widening your filters, or check back soon." />
      ) : (
        <>
          <p className="mb-3 text-sm text-gray-500">{data.total} donation(s) found</p>
          <div className="grid gap-4 lg:grid-cols-2">
            {data.items.map((donation) => (
              <DonationCard key={donation.id} donation={donation} to={`/donations/${donation.id}`}
                actions={
                  <>
                    {donation.already_requested
                      ? <span className="rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-600">Already requested</span>
                      : <button className="btn-primary" onClick={() => setTarget(donation)}><HandHeart className="h-4 w-4" /> Request</button>}
                    <Link to={`/donations/${donation.id}`} className="btn-secondary">Details</Link>
                  </>
                } />
            ))}
          </div>
          <Pagination page={data.page} pages={data.pages} onChange={setPage} />
        </>
      )}

      <ConfirmDialog open={Boolean(target)} title={`Request "${target?.food_name}"?`}
        message="The donor will be notified and can accept or reject your request." textLabel="Message to the donor (optional)"
        confirmLabel="Send request" onConfirm={handleRequest} onCancel={() => setTarget(null)} />
    </div>
  )
}
