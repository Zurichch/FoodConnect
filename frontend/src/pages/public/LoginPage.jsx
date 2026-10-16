// LoginPage.jsx - email + password login. On success, go to the dashboard for the user's role.
import { LogIn } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Alert, FormField, Spinner } from '../../components/ui'
import { dashboardPathFor } from '../../context/AuthContext'
import useAuth from '../../hooks/useAuth'
import { getErrorMessage } from '../../services/api'
import { validateLogin } from '../../utils/validation'

export default function LoginPage() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (user) return <Navigate to={dashboardPathFor(user.role)} replace />

  const handleSubmit = async (event) => {
    event.preventDefault()
    const formErrors = validateLogin(form)
    setErrors(formErrors)
    if (Object.keys(formErrors).length) return
    setIsSubmitting(true)
    setServerError('')
    try {
      const { user: loggedInUser } = await login(form.email, form.password)
      navigate(location.state?.from || dashboardPathFor(loggedInUser.role), { replace: true })
    } catch (error) {
      setServerError(getErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center bg-brand-50 px-4 py-12">
      <div className="w-full max-w-md">
        <form onSubmit={handleSubmit} className="card space-y-4 p-8" noValidate>
          <div className="text-center">
            <h1 className="text-2xl font-bold">Welcome back</h1>
            <p className="mt-1 text-sm text-gray-500">Log in to your FoodConnect account</p>
          </div>
          <Alert type="error">{serverError}</Alert>
          <FormField id="email" label="Email" error={errors.email} required>
            <input id="email" type="email" autoComplete="email" className="input" value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </FormField>
          <FormField id="password" label="Password" error={errors.password} required>
            <input id="password" type="password" autoComplete="current-password" className="input" value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </FormField>
          <button className="btn-primary w-full py-2.5" disabled={isSubmitting}>
            {isSubmitting ? <Spinner className="h-4 w-4 text-white" /> : <LogIn className="h-4 w-4" />} Log in
          </button>
          <p className="text-center text-sm text-gray-500">
            New here? <Link to="/register" className="font-semibold text-brand-700 hover:underline">Create an account</Link>
          </p>
        </form>
        <p className="mt-4 text-center text-xs text-gray-500">
          Demo accounts are listed in the project README (local demo passwords only).
        </p>
      </div>
    </div>
  )
}
