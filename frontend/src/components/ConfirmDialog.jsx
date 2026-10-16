/**
 * ConfirmDialog.jsx - "Are you sure?" pop-up for important actions.
 *
 * Optional extra inputs: a text box (e.g. a cancellation reason) and/or a
 * date-time picker (e.g. the planned pickup time). onConfirm receives
 * { text, dateTime } so the page can send them to the backend.
 */
import { useEffect, useRef, useState } from 'react'
import { Spinner } from './ui'

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  tone = 'primary',
  textLabel,
  textRequired = false,
  dateTimeLabel,
  numberLabel,
  numberDefault,
  onConfirm,
  onCancel,
}) {
  const [text, setText] = useState('')
  const [dateTime, setDateTime] = useState('')
  const [number, setNumber] = useState('')
  const [isWorking, setIsWorking] = useState(false)
  const [error, setError] = useState('')
  const firstInputRef = useRef(null)

  useEffect(() => {
    if (open) {
      setText('')
      setDateTime('')
      setNumber(numberDefault ?? '')
      setError('')
      setTimeout(() => firstInputRef.current?.focus(), 50)
    }
  }, [open, numberDefault])

  useEffect(() => {
    if (!open) return undefined
    const onKey = (event) => event.key === 'Escape' && !isWorking && onCancel()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, isWorking, onCancel])

  if (!open) return null

  const handleConfirm = async () => {
    if (textRequired && !text.trim()) return setError(`${textLabel} is required.`)
    if (dateTimeLabel && !dateTime) return setError(`${dateTimeLabel} is required.`)
    setIsWorking(true)
    try {
      await onConfirm({ text: text.trim(), dateTime, number })
    } finally {
      setIsWorking(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 id="confirm-title" className="text-lg font-semibold text-gray-900">{title}</h2>
        {message && <p className="mt-2 text-sm text-gray-600">{message}</p>}

        {dateTimeLabel && (
          <div className="mt-4">
            <label htmlFor="confirm-datetime" className="label">{dateTimeLabel}</label>
            <input ref={firstInputRef} id="confirm-datetime" type="datetime-local" className="input" value={dateTime} onChange={(e) => setDateTime(e.target.value)} />
          </div>
        )}
        {numberLabel && (
          <div className="mt-4">
            <label htmlFor="confirm-number" className="label">{numberLabel}</label>
            <input id="confirm-number" type="number" min="0" className="input" value={number} onChange={(e) => setNumber(e.target.value)} />
          </div>
        )}
        {textLabel && (
          <div className="mt-4">
            <label htmlFor="confirm-text" className="label">{textLabel}{textRequired && ' *'}</label>
            <textarea
              ref={dateTimeLabel ? undefined : firstInputRef}
              id="confirm-text"
              rows={3}
              className="input"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>
        )}
        {error && <p className="field-error">{error}</p>}

        <div className="mt-6 flex justify-end gap-2">
          <button className="btn-secondary" onClick={onCancel} disabled={isWorking}>Go back</button>
          <button className={tone === 'danger' ? 'btn-danger' : 'btn-primary'} onClick={handleConfirm} disabled={isWorking}>
            {isWorking && <Spinner className="h-4 w-4 text-white" />} {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
