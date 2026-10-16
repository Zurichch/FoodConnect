/**
 * AdminDashboard.jsx - platform overview for administrators (GET /api/admin/dashboard).
 */
import { BadgeCheck, CheckCircle2, Clock, FileWarning, HandHeart, Inbox, Users, Utensils } from 'lucide-react'
import { Link } from 'react-router-dom'
import { MonthlyTrendChart } from '../../components/Charts'
import StatusBadge from '../../components/StatusBadge'
import { Alert, PageHeader, PageLoader, StatCard } from '../../components/ui'
import useApi from '../../hooks/useApi'
import { getAdminDashboard } from '../../services/adminService'
import { formatNumber, relativeTime } from '../../utils/format'

export default function AdminDashboard() {
  const { data, isLoading, error } = useApi(getAdminDashboard, [], { pollMs: 30000 })
  if (isLoading) return <PageLoader />
  if (error) return <Alert type="error">{error}</Alert>
  const { summary, users } = data

  return (
    <div className="space-y-6">
      <PageHeader title="Admin dashboard" subtitle="Monitor donations, NGOs and platform activity." />

      {(users.pending_ngos > 0 || data.open_reports > 0) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {users.pending_ngos > 0 && <Alert type="warning">{users.pending_ngos} NGO(s) waiting for verification. <Link to="/admin/ngos" className="font-semibold underline">Review now</Link></Alert>}
          {data.open_reports > 0 && <Alert type="error">{data.open_reports} open donation report(s). <Link to="/admin/reports" className="font-semibold underline">Moderate</Link></Alert>}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Utensils} label="Total donations" value={summary.total_donations} />
        <StatCard icon={Inbox} tone="amber" label="Available / requested" value={summary.available_donations} />
        <StatCard icon={Clock} tone="sky" label="Awaiting collection" value={summary.awaiting_collection} />
        <StatCard icon={CheckCircle2} label="Delivered" value={summary.completed_donations} hint={`Completion rate ${summary.completion_rate}%`} />
        <StatCard icon={HandHeart} label="Servings recovered" value={formatNumber(summary.servings_recovered)} />
        <StatCard icon={Users} tone="gray" label="Donors / NGOs" value={`${users.donors} / ${users.ngos}`} hint={`${users.suspended} suspended`} />
        <StatCard icon={BadgeCheck} tone="violet" label="Verified NGOs" value={users.verified_ngos} hint={`${users.pending_ngos} pending`} />
        <StatCard icon={FileWarning} tone="amber" label="Open reports" value={data.open_reports} />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <section className="card lg:col-span-3"><h2 className="mb-3 font-semibold">Monthly donations</h2><MonthlyTrendChart data={data.monthly_trends} /></section>
        <section className="card lg:col-span-2">
          <h2 className="mb-3 font-semibold">Recent status changes</h2>
          <ul className="space-y-3">
            {data.recent_activity.map((entry) => (
              <li key={entry.id} className="text-sm">
                <Link to={`/donations/${entry.donation_id}`} className="font-medium text-gray-800 hover:text-brand-700 hover:underline">{entry.food_name}</Link>
                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                  <StatusBadge status={entry.new_status} /> by {entry.changed_by_name} · {relativeTime(entry.created_at)}
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
