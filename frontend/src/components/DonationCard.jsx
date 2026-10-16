// DonationCard.jsx - compact summary of a donation used in lists.
import { Clock, MapPin, Utensils } from 'lucide-react'
import { Link } from 'react-router-dom'
import { DIETARY_TYPES, FOOD_CATEGORIES, STORAGE_TYPES, label } from '../utils/constants'
import { formatDateTime, relativeTime } from '../utils/format'
import StatusBadge from './StatusBadge'

const DIET_COLORS = {
  vegetarian: 'bg-brand-50 text-brand-700 border-brand-200',
  vegan: 'bg-lime-50 text-lime-700 border-lime-200',
  non_vegetarian: 'bg-rose-50 text-rose-700 border-rose-200',
}

export default function DonationCard({ donation, to, actions, extra }) {
  return (
    <article className="card flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link to={to} className="font-semibold text-gray-900 hover:text-brand-700 hover:underline">
            {donation.food_name}
          </Link>
          <p className="text-xs text-gray-500">
            {label(FOOD_CATEGORIES, donation.category)} · by {donation.donor_name}
          </p>
        </div>
        <StatusBadge status={donation.status} />
      </div>
      <div className="flex flex-wrap gap-2 text-xs">
        <span className={`rounded-full border px-2 py-0.5 ${DIET_COLORS[donation.dietary_type]}`}>{label(DIETARY_TYPES, donation.dietary_type)}</span>
        <span className="rounded-full border border-gray-200 px-2 py-0.5 text-gray-600">{label(STORAGE_TYPES, donation.storage_type)}</span>
        <span className="rounded-full border border-gray-200 px-2 py-0.5 text-gray-600">{donation.is_packaged ? 'Packaged' : 'Unpackaged'}</span>
      </div>
      <dl className="grid grid-cols-1 gap-1 text-sm text-gray-600 sm:grid-cols-3">
        <div className="flex items-center gap-1.5"><Utensils className="h-4 w-4 text-brand-600" aria-hidden="true" /><dt className="sr-only">Servings</dt><dd>{donation.servings} servings · {donation.quantity} {donation.quantity_unit}</dd></div>
        <div className="flex items-center gap-1.5"><MapPin className="h-4 w-4 text-brand-600" aria-hidden="true" /><dt className="sr-only">Area</dt><dd>{donation.pickup_area} ({donation.pickup_postal_code})</dd></div>
        <div className="flex items-center gap-1.5" title={formatDateTime(donation.pickup_deadline)}>
          <Clock className="h-4 w-4 text-brand-600" aria-hidden="true" /><dt className="sr-only">Pickup deadline</dt>
          <dd>Pickup by {formatDateTime(donation.pickup_deadline)} <span className="text-gray-400">({relativeTime(donation.pickup_deadline)})</span></dd>
        </div>
      </dl>
      {extra}
      {actions && <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-3">{actions}</div>}
    </article>
  )
}
