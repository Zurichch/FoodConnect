/**
 * ProtectedRoute.jsx - only shows its pages to logged-in users with an allowed role.
 *
 * This only improves the user experience. Real security is on the backend:
 * every API route checks the token and role again.
 */
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { dashboardPathFor } from '../context/AuthContext'
import useAuth from '../hooks/useAuth'
import { PageLoader } from './ui'

export default function ProtectedRoute({ roles }) {
  const { user, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) return <PageLoader text="Checking your login..." />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (roles && !roles.includes(user.role)) return <Navigate to={dashboardPathFor(user.role)} replace />
  return <Outlet />
}
