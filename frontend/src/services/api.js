/**
 * api.js - The single Axios instance every page uses to talk to Flask.
 *
 * How React communicates with Flask:
 *   1. A page calls a function such as donationService.createDonation(form).
 *   2. That function calls api.post('/donations', form).
 *   3. The request interceptor below adds "Authorization: Bearer <token>".
 *   4. Vite forwards /api/... to http://127.0.0.1:5000/api/... (see vite.config.js).
 *   5. Flask answers with JSON: { success, message, data } or { success:false, error }.
 *   6. unwrap() returns just the `data` part to the page.
 */
import axios from 'axios'

const TOKEN_KEY = 'foodconnect_token'

export const tokenStorage = {
  get: () => {
    try {
      return localStorage.getItem(TOKEN_KEY)
    } catch {
      return null
    }
  },
  set: (token) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
}

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 15000,
})

// Attach the login token (if any) to every request.
api.interceptors.request.use((config) => {
  const token = tokenStorage.get()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// If the backend says our token is no longer valid, log the user out everywhere.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status
    const isLoginCall = error.config?.url?.includes('/auth/login')
    if (status === 401 && !isLoginCall && tokenStorage.get()) {
      tokenStorage.clear()
      window.dispatchEvent(new Event('foodconnect:logout'))
    }
    return Promise.reject(error)
  },
)

/** Wait for a request and return only the `data` part of the JSON response. */
export async function unwrap(requestPromise) {
  const response = await requestPromise
  return response.data.data
}

/** Same as unwrap, but also returns the backend's success message. */
export async function unwrapWithMessage(requestPromise) {
  const response = await requestPromise
  return { data: response.data.data, message: response.data.message }
}

/** A human-friendly message for any failed request. */
export function getErrorMessage(error) {
  if (error?.response?.data?.error?.message) return error.response.data.error.message
  if (error?.code === 'ECONNABORTED') return 'The server took too long to respond. Please try again.'
  if (error?.request && !error?.response) return 'Cannot reach the FoodConnect server. Is the backend running on port 5000?'
  return error?.message || 'Something went wrong.'
}

/** Per-field validation messages from the backend, e.g. { servings: "Must be at least 1." } */
export function getFieldErrors(error) {
  return error?.response?.data?.error?.details || {}
}

export default api
