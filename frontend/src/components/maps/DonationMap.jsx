/**
 * DonationMap.jsx - an interactive map of donations (Leaflet + free OpenStreetMap tiles).
 *
 * Each marker is a coloured circle:
 *   red    = pickup deadline within 2 hours (urgent)
 *   amber  = within 6 hours
 *   green  = later
 *   blue   = a collection already assigned to your NGO
 * "Approximate" markers also get a faint circle: they show the pickup AREA,
 * not the exact address (the exact pin is shared only after acceptance).
 *
 * Map tiles are downloaded from openstreetmap.org, so an internet connection is
 * needed for the background map. Markers still appear if the tiles fail to load.
 */
import { Fragment, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Circle, CircleMarker, MapContainer, Popup, TileLayer, Tooltip, useMap } from 'react-leaflet'
import { STATUS_INFO } from '../../utils/constants'
import { formatDateTime, relativeTime } from '../../utils/format'

export const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
export const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
export const CHENNAI_CENTER = { lat: 13.05, lng: 80.24 }

export const URGENCY_COLORS = { high: '#dc2626', medium: '#d97706', low: '#1e623c', mine: '#2563eb' }

/** Zooms the map so every marker is visible (runs whenever the markers change). */
function FitToMarkers({ points }) {
  const map = useMap()
  useEffect(() => {
    if (points.length === 1) map.setView(points[0], 14)
    else if (points.length > 1) map.fitBounds(points, { padding: [40, 40], maxZoom: 14 })
  }, [map, JSON.stringify(points)]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

/** Moves the map when the parent asks to focus on one marker (e.g. clicked in a list). */
function FlyTo({ target }) {
  const map = useMap()
  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lng], 15, { duration: 0.6 })
  }, [map, target])
  return null
}

export default function DonationMap({ markers = [], center = CHENNAI_CENTER, ngoBase, approximateRadius = 800, height = 480, focus, showPopups = true }) {
  const points = markers.map((m) => [m.lat, m.lng])
  if (ngoBase) points.push([ngoBase.lat, ngoBase.lng])

  return (
    // "relative z-0" keeps Leaflet's internal layers below our header and dialogs.
    <div className="relative z-0 overflow-hidden rounded-xl border border-gray-200" style={{ height }}>
      <MapContainer center={[center.lat, center.lng]} zoom={12} scrollWheelZoom className="h-full w-full">
        <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
        <FitToMarkers points={points} />
        <FlyTo target={focus} />

        {ngoBase && (
          <CircleMarker center={[ngoBase.lat, ngoBase.lng]} radius={9} pathOptions={{ color: '#1f2937', fillColor: '#ffffff', fillOpacity: 1, weight: 3 }}>
            <Tooltip direction="top">Your NGO base (approx.): {ngoBase.label}</Tooltip>
          </CircleMarker>
        )}

        {markers.map((marker) => {
          const color = marker.is_mine ? URGENCY_COLORS.mine : URGENCY_COLORS[marker.urgency] || URGENCY_COLORS.low
          return (
            <Fragment key={marker.donation_id ?? 'single'}>
              {marker.precision === 'approximate' && (
                <Circle center={[marker.lat, marker.lng]} radius={approximateRadius} pathOptions={{ color, weight: 1, fillOpacity: 0.08 }} />
              )}
              <CircleMarker center={[marker.lat, marker.lng]} radius={9} pathOptions={{ color: '#ffffff', fillColor: color, fillOpacity: 0.95, weight: 2 }}>
                {showPopups && marker.donation_id && (
                  <Popup>
                    <div className="space-y-1 text-sm">
                      <p className="font-semibold text-gray-900">{marker.food_name}</p>
                      <p>{marker.servings} servings · {marker.pickup_area}</p>
                      <p>Pickup by {formatDateTime(marker.pickup_deadline)} ({relativeTime(marker.pickup_deadline)})</p>
                      <p>Status: {STATUS_INFO[marker.status]?.label || marker.status}</p>
                      <p className="text-xs text-gray-500">{marker.precision === 'exact' ? 'Exact pickup point' : 'Approximate area (exact address after acceptance)'}</p>
                      <Link to={`/donations/${marker.donation_id}`} className="font-semibold text-brand-700">View details →</Link>
                    </div>
                  </Popup>
                )}
              </CircleMarker>
            </Fragment>
          )
        })}
      </MapContainer>
    </div>
  )
}

export function MapLegend({ showMine = false }) {
  const items = [
    ['high', 'Pickup within 2 h'],
    ['medium', 'Within 6 h'],
    ['low', 'Later'],
    ...(showMine ? [['mine', 'Your collection']] : []),
  ]
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600" aria-label="Map legend">
      {items.map(([key, text]) => (
        <li key={key} className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full border-2 border-white shadow" style={{ backgroundColor: URGENCY_COLORS[key] }} />
          {text}
        </li>
      ))}
      <li className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full border-2 border-gray-700 bg-white" />NGO base</li>
    </ul>
  )
}
