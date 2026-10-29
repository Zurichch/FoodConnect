/**
 * LocationPicker.jsx - lets the donor drop an (optional) pin for the exact pickup point.
 *
 * Click on the map to place the pin, or use "Use my current location" (browser GPS,
 * asked only once, only when clicked). The pin is saved with the donation as
 * pickup_latitude / pickup_longitude. Other NGOs see only the approximate area.
 */
import { Crosshair, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import { CHENNAI_CENTER, TILE_ATTRIBUTION, TILE_URL } from './DonationMap'

function ClickToPlace({ onPick }) {
  useMapEvents({
    click(event) {
      onPick({ lat: Number(event.latlng.lat.toFixed(6)), lng: Number(event.latlng.lng.toFixed(6)) })
    },
  })
  return null
}

/** Moves the map once when `position` changes (e.g. after "Use my current location"). */
function Recenter({ position }) {
  const map = useMap()
  useEffect(() => {
    if (position) map.setView([position.lat, position.lng], Math.max(map.getZoom(), 15))
  }, [map, position])
  return null
}

export default function LocationPicker({ value, onChange }) {
  const [message, setMessage] = useState('')
  const [recenterTo, setRecenterTo] = useState(null)
  const hasPin = value && value.lat !== '' && value.lng !== '' && value.lat != null && value.lng != null
  const start = hasPin ? { lat: Number(value.lat), lng: Number(value.lng) } : CHENNAI_CENTER

  const useCurrentLocation = () => {
    if (!navigator.geolocation) return setMessage('Your browser cannot share its location.')
    setMessage('Finding your location...')
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const position = { lat: Number(coords.latitude.toFixed(6)), lng: Number(coords.longitude.toFixed(6)) }
        onChange(position)
        setRecenterTo(position)
        setMessage('')
      },
      () => setMessage('Location permission was denied. Click on the map instead.'),
      { timeout: 10000 },
    )
  }

  return (
    <div className="space-y-2">
      <div className="relative z-0 h-64 overflow-hidden rounded-xl border border-gray-200">
        <MapContainer center={[start.lat, start.lng]} zoom={hasPin ? 15 : 11} scrollWheelZoom className="h-full w-full">
          <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
          <ClickToPlace onPick={onChange} />
          {recenterTo && <Recenter position={recenterTo} />}
          {hasPin && (
            <CircleMarker center={[Number(value.lat), Number(value.lng)]} radius={10} pathOptions={{ color: '#ffffff', fillColor: '#1e623c', fillOpacity: 1, weight: 3 }} />
          )}
        </MapContainer>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <button type="button" className="btn-secondary px-3 py-1.5" onClick={useCurrentLocation}><Crosshair className="h-4 w-4" /> Use my current location</button>
        {hasPin && (
          <>
            <span className="text-gray-600">Pin: {Number(value.lat).toFixed(4)}, {Number(value.lng).toFixed(4)}</span>
            <button type="button" className="btn-ghost px-2 py-1 text-red-600" onClick={() => onChange({ lat: '', lng: '' })}><Trash2 className="h-4 w-4" /> Remove pin</button>
          </>
        )}
      </div>
      <p className="text-xs text-gray-500">
        {message || 'Optional: click the map to mark the exact pickup point. NGOs see only the approximate area until you accept them.'}
      </p>
    </div>
  )
}
