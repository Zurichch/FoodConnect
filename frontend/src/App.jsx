/**
 * App.jsx - every URL of the application and which page it shows.
 *
 * <ProtectedRoute roles={[...]}> blocks users who are not logged in or have
 * the wrong role (the backend ALSO checks this on every API call).
 */
import { Route, Routes } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import DashboardLayout from './layouts/DashboardLayout'
import PublicLayout from './layouts/PublicLayout'

// Public pages
import AboutPage from './pages/public/AboutPage'
import ContactPage from './pages/public/ContactPage'
import HowItWorksPage from './pages/public/HowItWorksPage'
import LandingPage from './pages/public/LandingPage'
import LoginPage from './pages/public/LoginPage'
import NotFoundPage from './pages/public/NotFoundPage'
import RegisterPage from './pages/public/RegisterPage'
// Shared (all logged-in users)
import DonationDetailsPage from './pages/shared/DonationDetailsPage'
import NotificationsPage from './pages/shared/NotificationsPage'
import ProfilePage from './pages/shared/ProfilePage'
// Donor
import CreateDonationPage from './pages/donor/CreateDonationPage'
import DonationHistoryPage from './pages/donor/DonationHistoryPage'
import DonorDashboard from './pages/donor/DonorDashboard'
import DonorRequestsPage from './pages/donor/DonorRequestsPage'
import MatchRecommendationsPage from './pages/donor/MatchRecommendationsPage'
import MyDonationsPage from './pages/donor/MyDonationsPage'
// NGO
import AvailableDonationsPage from './pages/ngo/AvailableDonationsPage'
import CollectionsPage from './pages/ngo/CollectionsPage'
import NgoDashboard from './pages/ngo/NgoDashboard'
import NgoProfilePage from './pages/ngo/NgoProfilePage'
import NgoRequestsPage from './pages/ngo/NgoRequestsPage'
import RecommendedDonationsPage from './pages/ngo/RecommendedDonationsPage'
// Admin
import AdminDashboard from './pages/admin/AdminDashboard'
import AuditLogPage from './pages/admin/AuditLogPage'
import DonationManagementPage from './pages/admin/DonationManagementPage'
import NgoVerificationPage from './pages/admin/NgoVerificationPage'
import PlatformAnalyticsPage from './pages/admin/PlatformAnalyticsPage'
import ReportsPage from './pages/admin/ReportsPage'
import UserManagementPage from './pages/admin/UserManagementPage'

export default function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/how-it-works" element={<HowItWorksPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>

      {/* Any logged-in user */}
      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/donations/:donationId" element={<DonationDetailsPage />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute roles={['donor']} />}>
        <Route element={<DashboardLayout />}>
          <Route path="/donor" element={<DonorDashboard />} />
          <Route path="/donor/donations" element={<MyDonationsPage />} />
          <Route path="/donor/donations/new" element={<CreateDonationPage />} />
          <Route path="/donor/donations/:donationId/edit" element={<CreateDonationPage />} />
          <Route path="/donor/donations/:donationId/matches" element={<MatchRecommendationsPage />} />
          <Route path="/donor/requests" element={<DonorRequestsPage />} />
          <Route path="/donor/history" element={<DonationHistoryPage />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute roles={['ngo']} />}>
        <Route element={<DashboardLayout />}>
          <Route path="/ngo" element={<NgoDashboard />} />
          <Route path="/ngo/recommended" element={<RecommendedDonationsPage />} />
          <Route path="/ngo/available" element={<AvailableDonationsPage />} />
          <Route path="/ngo/requests" element={<NgoRequestsPage />} />
          <Route path="/ngo/active" element={<CollectionsPage scope="active" />} />
          <Route path="/ngo/completed" element={<CollectionsPage scope="completed" />} />
          <Route path="/ngo/profile" element={<NgoProfilePage />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute roles={['admin']} />}>
        <Route element={<DashboardLayout />}>
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/users" element={<UserManagementPage />} />
          <Route path="/admin/ngos" element={<NgoVerificationPage />} />
          <Route path="/admin/donations" element={<DonationManagementPage />} />
          <Route path="/admin/reports" element={<ReportsPage />} />
          <Route path="/admin/analytics" element={<PlatformAnalyticsPage />} />
          <Route path="/admin/audit-log" element={<AuditLogPage />} />
        </Route>
      </Route>

      <Route element={<PublicLayout />}>
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
