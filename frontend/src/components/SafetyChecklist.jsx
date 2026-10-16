// SafetyChecklist.jsx - the food safety checklist and the responsibility disclaimer.
import { AlertTriangle, CheckCircle2, HelpCircle, ShieldAlert } from 'lucide-react'
import { formatDateTime } from '../utils/format'

const ICONS = {
  ok: <CheckCircle2 className="h-4 w-4 text-brand-600" aria-label="OK" />,
  warning: <AlertTriangle className="h-4 w-4 text-amber-500" aria-label="Check" />,
  missing: <HelpCircle className="h-4 w-4 text-gray-400" aria-label="Missing" />,
}

const looksLikeDate = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)

export default function SafetyChecklist({ items = [], warnings = [], disclaimer }) {
  return (
    <div className="space-y-4">
      <ul className="divide-y divide-gray-100">
        {items.map((item) => (
          <li key={item.label} className="flex items-start gap-3 py-2">
            <span className="mt-0.5">{ICONS[item.status]}</span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-800">{item.label}</p>
              <p className="text-sm capitalize text-gray-500">{looksLikeDate(item.value) ? formatDateTime(item.value) : item.value}</p>
            </div>
          </li>
        ))}
      </ul>
      {warnings.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
          <p className="mb-1 text-sm font-semibold text-amber-800">Safety notes</p>
          <ul className="list-disc space-y-0.5 pl-5 text-sm text-amber-800">
            {warnings.map((warning) => <li key={warning}>{warning}</li>)}
          </ul>
        </div>
      )}
      {disclaimer && (
        <p className="flex gap-2 rounded-xl bg-gray-50 p-3 text-xs text-gray-600">
          <ShieldAlert className="h-4 w-4 shrink-0 text-gray-500" aria-hidden="true" />
          {disclaimer}
        </p>
      )}
    </div>
  )
}
