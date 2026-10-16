// useToast.js - show a short success/error message that disappears after a few seconds.
import { useCallback, useState } from 'react'

export default function useToast() {
  const [toast, setToast] = useState(null)
  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type, id: Date.now() })
    setTimeout(() => setToast(null), 4000)
  }, [])
  return { toast, showToast }
}
