/**
 * DonationTimeline.jsx - the visual progress tracker on the donation details page.
 *
 * Top: the 6 normal steps, coloured up to the current status.
 * Bottom: the real history rows from the database (who changed what, and when).
 * This is STATUS tracking, not GPS location tracking.
 */
import { CheckCircle2, Circle, XCircle } from 'lucide-react'
import { NORMAL_FLOW, STATUS_INFO } from '../utils/constants'
import { formatDateTime } from '../utils/format'

export default function DonationTimeline({ status, history }) {
  const isAlternativeEnding = !NORMAL_FLOW.includes(status)
  // For CANCELLED/EXPIRED/REJECTED, show how far the donation got before it ended.
  const reachedStatuses = history.map((h) => h.new_status)
  const lastNormalIndex = Math.max(...NORMAL_FLOW.map((s, i) => (reachedStatuses.includes(s) ? i : -1)))
  const currentIndex = isAlternativeEnding ? lastNormalIndex : NORMAL_FLOW.indexOf(status)

  return (
    <div>
      <ol className="grid grid-cols-3 gap-y-4 sm:grid-cols-6" aria-label="Donation progress">
        {NORMAL_FLOW.map((step, index) => {
          const done = index <= currentIndex
          const isCurrent = index === currentIndex && !isAlternativeEnding
          return (
            <li key={step} className="flex flex-col items-center text-center">
              <div className="flex w-full items-center">
                <div className={`h-0.5 flex-1 ${index === 0 ? 'invisible' : done ? 'bg-brand-500' : 'bg-gray-200'}`} />
                {done ? (
                  <CheckCircle2 className={`h-7 w-7 ${isCurrent ? 'text-brand-700' : 'text-brand-500'}`} aria-hidden="true" />
                ) : (
                  <Circle className="h-7 w-7 text-gray-300" aria-hidden="true" />
                )}
                <div className={`h-0.5 flex-1 ${index === NORMAL_FLOW.length - 1 ? 'invisible' : index < currentIndex ? 'bg-brand-500' : 'bg-gray-200'}`} />
              </div>
              <span className={`mt-1 text-xs ${isCurrent ? 'font-bold text-brand-800' : done ? 'text-gray-700' : 'text-gray-400'}`}>
                {STATUS_INFO[step].label}
              </span>
            </li>
          )
        })}
      </ol>

      {isAlternativeEnding && (
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          <XCircle className="h-4 w-4" aria-hidden="true" />
          Ended as <strong>{STATUS_INFO[status]?.label}</strong>: {STATUS_INFO[status]?.meaning}
        </div>
      )}

      <h3 className="mb-3 mt-6 text-sm font-semibold text-gray-700">Status history (from the database)</h3>
      <ol className="relative space-y-4 border-l-2 border-brand-100 pl-5">
        {history.map((entry) => (
          <li key={entry.id} className="relative">
            <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-white bg-brand-500" aria-hidden="true" />
            <p className="text-sm font-semibold text-gray-800">
              {entry.old_status ? `${STATUS_INFO[entry.old_status]?.label} → ` : 'Created as '}
              {STATUS_INFO[entry.new_status]?.label || entry.new_status}
            </p>
            <p className="text-xs text-gray-500">
              {formatDateTime(entry.created_at)} · by {entry.changed_by_name} ({entry.changed_by_role})
            </p>
            {entry.note && <p className="mt-0.5 text-sm text-gray-600">{entry.note}</p>}
          </li>
        ))}
      </ol>
    </div>
  )
}
