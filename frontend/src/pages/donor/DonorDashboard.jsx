/**
 * DonorDashboard.jsx - summary cards + charts (GET /api/analytics/donor)
 * and the donor's active donations (GET /api/donations/mine?scope=active).
 */
import { CheckCircle2, Clock, HandHeart, Inbox, Leaf, PlusCircle, Utensils } from 'lucide-react'
import { Link } from 'react-router-dom'
import { CategoryChart, MonthlyTrendChart } from '../../components/Charts'
import DonationCard from '../../components/DonationCard'
import { Alert, EmptyState, PageHeader, PageLoader, StatCard } from '../../components/ui'
import useApi from '../../hooks/useApi'
import useAuth from '../../hooks/useAuth'
import { getMyDonations } from '../../services/donationService'
import { getDonorAnalytics } from '../../services/publicService'
import { formatNumber } from '../../utils/format'

export default function DonorDashboard() {
  const { user } = useAuth()
  const analytics = useApi(getDonorAnalytics, [])
  const active = useApi(() => getMyDonations({ scope: 'active', per_page: 4 }), [], { pollMs: 20000 })

  if (analytics.isLoading) return <PageLoader />
  if (analytics.error) return <Alert type="error">{analytics.error}</Alert>
  const summary = analytics.data.summary

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Hello, ${user.name}`}
        subtitle="Here is the impact of your food donations so far."
        actions={<Link to="/donor/donations/new" className="btn-primary"><PlusCircle className="h-4 w-4" /> Donate food</Link>}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Utensils} label="Total donations" value={summary.total_donations} hint="All donations you created" />
        <StatCard icon={Inbox} tone="amber" label="Open for NGOs" value={summary.available_donations} hint="Available or requested" />
        <StatCard icon={Clock} tone="sky" label="Awaiting collection" value={summary.awaiting_collection} hint="Accepted or pickup scheduled" />
        <StatCard icon={CheckCircle2} label="Delivered" value={summary.completed_donations} hint={`Completion rate ${summary.completion_rate}%`} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <StatCard icon={HandHeart} label="Servings recovered" value={formatNumber(summary.servings_recovered)} hint="Servings of collected + delivered donations" />
        <StatCard icon={Leaf} tone="gray" label="Estimated food recovered (illustrative)" value={`~${summary.impact_estimate.estimated_food_kg} kg`} hint={summary.impact_estimate.assumptions} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card"><h2 className="mb-3 font-semibold">Monthly donations</h2><MonthlyTrendChart data={analytics.data.monthly_trends} /></section>
        <section className="card"><h2 className="mb-3 font-semibold">What you donate most</h2><CategoryChart data={analytics.data.categories} /></section>
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Active donations</h2>
          <Link to="/donor/donations" className="text-sm font-semibold text-brand-700 hover:underline">View all</Link>
        </div>
        {active.isLoading ? <PageLoader /> : active.error ? <Alert type="error">{active.error}</Alert> : active.data.items.length === 0 ? (
          <EmptyState title="No active donations" message="When you have surplus food, list it here and we will find the best NGO."
            action={<Link to="/donor/donations/new" className="btn-primary">Donate food</Link>} />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {active.data.items.map((donation) => (
              <DonationCard key={donation.id} donation={donation} to={`/donations/${donation.id}`}
                extra={donation.pending_requests > 0 && <p className="text-sm font-medium text-amber-700">{donation.pending_requests} pending request(s) to review</p>}
                actions={<Link to={`/donations/${donation.id}`} className="btn-secondary">Track</Link>} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
