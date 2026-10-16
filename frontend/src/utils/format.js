// format.js - Date/time and number helpers.
// The backend sends UTC times like "2026-10-15T14:30:00Z"; the browser shows them in local time.

export function formatDateTime(isoString) {
  if (!isoString) return '-'
  return new Date(isoString).toLocaleString(undefined, {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export function formatDate(isoString) {
  if (!isoString) return '-'
  return new Date(isoString).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

/** "in 3 h 20 min" or "45 min ago" */
export function relativeTime(isoString) {
  if (!isoString) return ''
  const diffMinutes = Math.round((new Date(isoString).getTime() - Date.now()) / 60000)
  const abs = Math.abs(diffMinutes)
  let text
  if (abs < 1) return 'just now'
  if (abs < 60) text = `${abs} min`
  else if (abs < 60 * 24) text = `${Math.floor(abs / 60)} h ${abs % 60} min`
  else text = `${Math.floor(abs / 1440)} day${Math.floor(abs / 1440) > 1 ? 's' : ''}`
  return diffMinutes > 0 ? `in ${text}` : `${text} ago`
}

/** Date -> "YYYY-MM-DDTHH:mm" in LOCAL time, the format <input type="datetime-local"> needs. */
export function toInputDateTime(date) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** "YYYY-MM-DDTHH:mm" (local) -> UTC ISO string for the API, or '' if empty/invalid. */
export function inputToIso(value) {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString()
}

export function hoursFromNow(hours) {
  return toInputDateTime(new Date(Date.now() + hours * 3600 * 1000))
}

export function formatNumber(value) {
  return new Intl.NumberFormat().format(value ?? 0)
}
