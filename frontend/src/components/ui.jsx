/**
 * ui.jsx - Small reusable building blocks used on almost every page.
 * Keeping them together makes it easy to see the whole "design system" at once.
 */
import { AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, Info, Inbox, Loader2, X } from 'lucide-react'

export function Spinner({ className = 'h-5 w-5' }) {
  return <Loader2 className={`animate-spin text-brand-600 ${className}`} aria-hidden="true" />
}

export function PageLoader({ text = 'Loading...' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-gray-500" role="status">
      <Spinner className="h-8 w-8" />
      <p className="text-sm">{text}</p>
    </div>
  )
}

export function EmptyState({ title, message, action, icon: Icon = Inbox }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center">
      <Icon className="mb-3 h-10 w-10 text-brand-300" aria-hidden="true" />
      <h3 className="font-semibold text-gray-800">{title}</h3>
      {message && <p className="mt-1 max-w-md text-sm text-gray-500">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

const ALERT_STYLES = {
  error: { box: 'border-red-200 bg-red-50 text-red-800', Icon: AlertCircle },
  success: { box: 'border-brand-200 bg-brand-50 text-brand-800', Icon: CheckCircle2 },
  warning: { box: 'border-amber-200 bg-amber-50 text-amber-800', Icon: AlertCircle },
  info: { box: 'border-sky-200 bg-sky-50 text-sky-800', Icon: Info },
}

export function Alert({ type = 'info', children, onClose }) {
  if (!children) return null
  const { box, Icon } = ALERT_STYLES[type]
  return (
    <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${box}`} role={type === 'error' ? 'alert' : 'status'}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="flex-1">{children}</div>
      {onClose && (
        <button type="button" onClick={onClose} aria-label="Dismiss message" className="opacity-60 hover:opacity-100">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}

/** Floating message in the corner (used with the useToast hook). */
export function Toast({ toast }) {
  if (!toast) return null
  return (
    <div className="fixed bottom-4 right-4 z-50 w-[calc(100%-2rem)] max-w-sm shadow-lg" key={toast.id}>
      <Alert type={toast.type}>{toast.message}</Alert>
    </div>
  )
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export function StatCard({ label, value, hint, icon: Icon, tone = 'brand' }) {
  const tones = {
    brand: 'bg-brand-50 text-brand-700',
    amber: 'bg-amber-50 text-amber-700',
    sky: 'bg-sky-50 text-sky-700',
    violet: 'bg-violet-50 text-violet-700',
    gray: 'bg-gray-100 text-gray-700',
  }
  return (
    <div className="card flex items-start gap-4">
      {Icon && (
        <div className={`rounded-xl p-2.5 ${tones[tone]}`}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
      )}
      <div className="min-w-0">
        <p className="text-sm text-gray-500">{label}</p>
        <p className="mt-0.5 text-2xl font-bold text-gray-900">{value}</p>
        {hint && <p className="mt-0.5 text-xs text-gray-400">{hint}</p>}
      </div>
    </div>
  )
}

export function Pagination({ page, pages, onChange }) {
  if (!pages || pages <= 1) return null
  return (
    <nav className="mt-4 flex items-center justify-center gap-3" aria-label="Pagination">
      <button className="btn-secondary px-3" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Previous page">
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="text-sm text-gray-600">Page {page} of {pages}</span>
      <button className="btn-secondary px-3" disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label="Next page">
        <ChevronRight className="h-4 w-4" />
      </button>
    </nav>
  )
}

/** Label + input + error message, with the label correctly linked for screen readers. */
export function FormField({ id, label, error, hint, required, children }) {
  return (
    <div>
      <label htmlFor={id} className="label">
        {label} {required && <span className="text-red-500" aria-hidden="true">*</span>}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
      {error && <p className="field-error" id={`${id}-error`}>{error}</p>}
    </div>
  )
}

export function Tabs({ tabs, active, onChange }) {
  return (
    <div className="mb-4 flex flex-wrap gap-1 rounded-xl bg-gray-100 p-1" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          role="tab"
          aria-selected={active === tab.value}
          onClick={() => onChange(tab.value)}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
            active === tab.value ? 'bg-white text-brand-800 shadow-sm' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
