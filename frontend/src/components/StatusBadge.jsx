// StatusBadge.jsx - coloured pill showing a donation (or request) status.
import { REQUEST_STATUS_COLORS, STATUS_INFO } from '../utils/constants'

export default function StatusBadge({ status, type = 'donation' }) {
  if (type === 'request') {
    return (
      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${REQUEST_STATUS_COLORS[status] || 'bg-gray-100'}`}>
        {status}
      </span>
    )
  }
  const info = STATUS_INFO[status] || { label: status, color: 'bg-gray-100 text-gray-700', meaning: '' }
  return (
    <span title={info.meaning} className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${info.color}`}>
      {info.label}
    </span>
  )
}
