/**
 * DonationsMapPage.jsx - "Donations map" for NGOs (/ngo/map) and admins (/admin/map).
 *
 * Data: GET /api/donations/map (refreshed every 30 s).
 *   NGO:   open donations at their APPROXIMATE area + its own collections at the exact pin.
 *   Admin: open donations, or every active donation (scope toggle), at exact pins.
 * The list on the right is sorted by pickup deadline; clicking an item flies the map to it.
 */
import { MapPin, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import DonationMap, { MapLegend, URGENCY_COLORS } from '../../components/maps/DonationMap'
import StatusBadge from '../../components/StatusBadge'
import { Alert, EmptyState, PageHeader, PageLoader, Tabs } from '../../components/ui'
import useApi from '../../hooks/useApi'
import useAuth from '../../hooks/useAuth'
import { getDonationsMap } from '../../services/donationService'
import { relativeTime } from '../../utils/format'

export default function DonationsMapPage() {
  const { user } = useAuth()
  const isAdmin = user.role === 'admin'
  const [scope, setScope] = useState('open')
  const [focus, setFocus] = useState(null)
  const { data, isLoading, error, reload } = useApi(() => getDonationsMap(isAdmin ? { scope } : {}), [scope], { pollMs: 30000 })

  return (
    <div>
      <PageHeader
        title="Donations map"
        subtitle={isAdmin ? 'Where donations are waiting across the city.' : 'Open donations near you. Markers show the pickup area; the exact address is shared after the donor accepts.'}
        actions={<button className="btn-secondary" onClick={() => reload()}><RefreshCw className="h-4 w-4" /> Refresh</button>}
      />
      {isAdmin && (
        <Tabs tabs={[{ value: 'open', label: 'Open donations' }, { value: 'active', label: 'All active (incl. collections)' }]} active={scope} onChange={setScope} />
      )}

      {isLoading ? <PageLoader text="Loading map..." /> : error ? <Alert type="error">{error}</Alert> : (
        <div className="grid gap-4 lg:grid-cols-3">
          <section className="space-y-3 lg:col-span-2">
            <DonationMap markers={data.markers} center={data.center} ngoBase={data.ngo_base} approximateRadius={data.approximate_radius_m} focus={focus} height={520} />
            <MapLegend showMine={!isAdmin} />
            <p className="text-xs text-gray-500">
              {data.note} {data.unmapped_count > 0 && `${data.unmapped_count} donation(s) could not be placed on the map (unknown area and no pin).`}
              {' '}Map data © OpenStreetMap contributors (needs an internet connection).
            </p>
          </section>

          <section className="card max-h-[600px] overflow-y-auto p-0">
            <h2 className="sticky top-0 border-b border-gray-100 bg-white px-4 py-3 font-semibold">{data.markers.length} donation(s) on the map</h2>
            {data.markers.length === 0 ? (
              <div className="p-4"><EmptyState icon={MapPin} title="Nothing to show" message="There are no open donations right now." /></div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {data.markers.map((marker) => (
                  <li key={marker.donation_id}>
                    <button type="button" onClick={() => setFocus({ lat: marker.lat, lng: marker.lng, id: marker.donation_id })}
                      className={`flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-gray-50 ${focus?.id === marker.donation_id ? 'bg-brand-50' : ''}`}>
                      <span className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: marker.is_mine ? URGENCY_COLORS.mine : URGENCY_COLORS[marker.urgency] }} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-gray-900">{marker.food_name}</span>
                        <span className="block text-xs text-gray-500">{marker.servings} servings · {marker.pickup_area} · pickup {relativeTime(marker.pickup_deadline)}</span>
                        <span className="mt-1 flex items-center gap-2"><StatusBadge status={marker.status} />
                          <span className="text-[11px] text-gray-400">{marker.precision === 'exact' ? 'exact pin' : 'approx. area'}</span></span>
                      </span>
                    </button>
                    <div className="px-4 pb-3 pl-10"><Link to={`/donations/${marker.donation_id}`} className="text-xs font-semibold text-brand-700 hover:underline">Open details</Link></div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
