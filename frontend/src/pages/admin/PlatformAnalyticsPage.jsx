/**
 * PlatformAnalyticsPage.jsx - platform-wide statistics (GET /api/analytics/admin).
 * Database counts and illustrative estimates are shown separately, with their formulas.
 */
import { CategoryChart, MonthlyTrendChart } from '../../components/Charts'
import { Alert, PageHeader, PageLoader, StatCard } from '../../components/ui'
import useApi from '../../hooks/useApi'
import { getAdminAnalytics } from '../../services/adminService'
import { STATUS_INFO } from '../../utils/constants'
import { formatNumber } from '../../utils/format'

export default function PlatformAnalyticsPage() {
  const { data, isLoading, error } = useApi(getAdminAnalytics, [])
  if (isLoading) return <PageLoader />
  if (error) return <Alert type="error">{error}</Alert>
  const { summary } = data

  return (
    <div className="space-y-6">
      <PageHeader title="Platform analytics" subtitle="All numbers are calculated live from the database." />

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Actual database counts</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total donations" value={summary.total_donations} hint="All donation rows" />
          <StatCard label="Delivered" value={summary.completed_donations} hint="Status DELIVERED" />
          <StatCard label="Servings recovered" value={formatNumber(summary.servings_recovered)} hint="Servings of COLLECTED + DELIVERED" />
          <StatCard label="Completion rate" value={`${summary.completion_rate}%`} hint="Delivered ÷ closed donations" />
        </div>
      </section>

      <section className="card">
        <h2 className="mb-3 font-semibold">Donations by status</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {Object.entries(STATUS_INFO).map(([status, info]) => (
            <div key={status} className="rounded-xl bg-gray-50 p-3">
              <p className="text-xs text-gray-500">{info.label}</p>
              <p className="text-xl font-bold">{summary.status_counts[status] || 0}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card"><h2 className="mb-3 font-semibold">Monthly trend (last 6 months)</h2><MonthlyTrendChart data={data.monthly_trends} /></section>
        <section className="card"><h2 className="mb-3 font-semibold">Most donated categories</h2><CategoryChart data={data.categories} /></section>
      </div>

      <section className="card overflow-x-auto">
        <h2 className="mb-3 font-semibold">NGO collection activity</h2>
        <table className="min-w-full divide-y divide-gray-100">
          <thead><tr><th className="table-head">NGO</th><th className="table-head">Verification</th><th className="table-head">Requests made</th><th className="table-head">Collections</th><th className="table-head">Servings collected</th></tr></thead>
          <tbody className="divide-y divide-gray-100">
            {data.ngo_activity.map((row) => (
              <tr key={row.ngo_id}>
                <td className="table-cell font-medium">{row.organization_name}</td>
                <td className="table-cell capitalize">{row.verification_status}</td>
                <td className="table-cell">{row.requests_made}</td>
                <td className="table-cell">{row.collections}</td>
                <td className="table-cell">{formatNumber(row.servings_collected)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card border-dashed bg-gray-50">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-gray-500">Illustrative environmental estimate (not measured)</h2>
        <p className="text-2xl font-bold text-gray-700">~{formatNumber(summary.impact_estimate.estimated_food_kg)} kg food · ~{formatNumber(summary.impact_estimate.estimated_co2e_kg)} kg CO2e</p>
        <p className="mt-1 text-sm text-gray-500">{summary.impact_estimate.assumptions}</p>
      </section>
    </div>
  )
}
