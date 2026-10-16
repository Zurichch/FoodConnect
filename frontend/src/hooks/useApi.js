/**
 * useApi.js - load data from the backend with loading and error states.
 *
 *   const { data, isLoading, error, reload } = useApi(() => getMyDonations({ page }), [page])
 *
 * `reload()` fetches again (used after an action, e.g. accepting a request).
 * Pass { pollMs: 15000 } to refresh automatically every 15 s (near-real-time tracking).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { getErrorMessage } from '../services/api'

export default function useApi(loader, dependencies = [], { pollMs } = {}) {
  const [data, setData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const loaderRef = useRef(loader)
  loaderRef.current = loader

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setIsLoading(true)
    try {
      const result = await loaderRef.current()
      setData(result)
      setError('')
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      if (!silent) setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies)

  useEffect(() => {
    if (!pollMs) return undefined
    const timer = setInterval(() => load({ silent: true }), pollMs)
    return () => clearInterval(timer)
  }, [pollMs, load])

  return { data, isLoading, error, reload: load, setData }
}
