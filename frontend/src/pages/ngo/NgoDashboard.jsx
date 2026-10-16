/**
 * NgoDashboard.jsx - NGO summary: verification status, capacity, servings received
 * and distributed, charts and the top recommended donations.
 * Data: GET /api/ngo/dashboard and GET /api/donations/recommended
 */
import { BadgeCheck, Clock, Gauge, HandHeart, Inbox, PackageCheck, Sparkles, Utensils } from 'lucide-react'
import { Link } from 'react-router-dom'
import { CategoryChart, MonthlyTrendChart } from '../../components/Charts'
import { ScoreCircle } from '../../components/MatchCard'
import { Alert, EmptyState, PageHeader, PageLoader, StatCard } from '../../components/ui'
import useApi from '../../hooks/useApi'
import { getRecommendedDonations } from '../../services/donationService'
import { getNgoDashboard } from '../../services/ngoService'
import { formatDateTime, formatNumber, relativeTime } from '../../utils/format'

export default function NgoDashboard() {
  const dashboard = useApi(getNgoDashboard, [], { pollMs: 30000 })
  const recommended = useApi(getRecommendedDonations, [], { pollMs: 30000 })

  if (dashboard.isLoading) return <PageLoader />
  if (dashboard.error) return <Alert type="error">{dashboard.error}</Alert>
  const { profile, summary, available_capacity: availableCapacity } = dashboard.data
  const isVerified = profile.verification_status === 'verified'

  return (
    <div className="space-y-6">
      <PageHeader title={profile.organization_name} subtitle={`Serving ${profile.service_areas.join(', ')}`}
        actions={<Link to="/ngo/available" className="btn-primary"><HandHeart className="h-4 w-4" /> Browse donations</Link>} />

      {isVerified ? (
        <Alert type="success"><span className="inline-flex items-center gap-1"><BadgeCheck className="h-4 w-4" /> Verified NGO - you can request donations and appear in donor recommendations.</span></Alert>
      ) : (
        <Alert type="warning">
          Verification status: <strong>{profile.verification_status}</strong>. {profile.verification_note || 'An administrator will review your organisation soon.'} Until then you cannot request donations.
          {profile.verification_status === 'rejected' && <> Update your <Link to="/ngo/profile" className="underline">profile</Link> to request re-verification.</>}
        </Alert>
      )}

      {summary.pending_offers > 0 && (
        <Alert type="info">{summary.pending_offers} donor offer(s) are waiting for your decision. <Link to="/ngo/requests" className="font-semibold underline">Review offers</Link></Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Gauge} label="Free capacity" value={`${availableCapacity} / ${profile.max_capacity_servings}`} hint="Servings you can still accept" />
        <StatCard icon={Inbox} tone="amber" label="Pending requests / offers" value={`${summary.pending_requests} / ${summary.pending_offers}`} hint="Sent by you / offered to you" />
        <StatCard icon={Clock} tone="sky" label="Active collections" value={summary.awaiting_collection + summary.collected_not_delivered} hint="Accepted, scheduled or collected" />
        <StatCard icon={PackageCheck} label="Completed" value={summary.completed_donations} hint={`Completion rate ${summary.completion_rate}%`} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard icon={Utensils} label="Servings received" value={formatNumber(summary.servings_received)} hint="Collected + delivered donations" />
        <StatCard icon={HandHeart} tone="violet" label="Servings distributed" value={formatNumber(summary.servings_distributed)} hint="As reported when marking delivered" />
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold"><Sparkles className="h-5 w-5 text-brand-600" /> Top matches for you</h2>
          <Link to="/ngo/recommended" className="text-sm font-semibold text-brand-700 hover:underline">See all</Link>
        </div>
        {recommended.isLoading ? <PageLoader /> : recommended.error ? <Alert type="error">{recommended.error}</Alert> : recommended.data.items.length === 0 ? (
          <EmptyState title="No matching donations right now" message={recommended.data.message || 'New donations that fit your area, capacity and preferences will appear here.'} />
        ) : (
          <div className="grid gap-3 md:grid-cols-3">
            {recommended.data.items.slice(0, 3).map((item) => (
              <Link key={item.donation.id} to={`/donations/${item.donation.id}`} className="card flex items-center gap-3 transition hover:border-brand-300">
                <ScoreCircle score={item.score} />
                <div className="min-w-0">
                  <p className="truncate font-semibold">{item.donation.food_name}</p>
                  <p className="text-xs text-gray-500">{item.donation.servings} servings · {item.donation.pickup_area}</p>
                  <p className="text-xs text-gray-400" title={formatDateTime(item.donation.pickup_deadline)}>Pickup {relativeTime(item.donation.pickup_deadline)}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card"><h2 className="mb-3 font-semibold">Monthly collections</h2><MonthlyTrendChart data={dashboard.data.monthly_trends} /></section>
        <section className="card"><h2 className="mb-3 font-semibold">Food categories received</h2><CategoryChart data={dashboard.data.categories} /></section>
      </div>
    </div>
  )
}
