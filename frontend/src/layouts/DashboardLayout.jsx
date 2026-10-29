/**
 * DashboardLayout.jsx - sidebar + top bar shared by the donor, NGO and admin areas.
 * The sidebar links change with the logged-in user's role.
 * The bell polls the backend every 20 seconds for the unread notification count.
 */
import {
  BarChart3, Bell, BadgeCheck, ClipboardList, FileWarning, Gauge, HandHeart, History, Inbox, LogOut,
  Map as MapIcon, Menu, PackageCheck, PlusCircle, ScrollText, Sparkles, Truck, User, Users, X,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import Logo from '../components/Logo'
import useAuth from '../hooks/useAuth'
import { getUnreadCount } from '../services/notificationService'

const NAV_BY_ROLE = {
  donor: [
    { to: '/donor', label: 'Dashboard', icon: Gauge, end: true },
    { to: '/donor/donations/new', label: 'Donate food', icon: PlusCircle },
    { to: '/donor/donations', label: 'My donations', icon: ClipboardList, end: true },
    { to: '/donor/requests', label: 'NGO requests', icon: Inbox },
    { to: '/donor/history', label: 'Donation history', icon: History },
    { to: '/notifications', label: 'Notifications', icon: Bell },
    { to: '/profile', label: 'Profile settings', icon: User },
  ],
  ngo: [
    { to: '/ngo', label: 'Dashboard', icon: Gauge, end: true },
    { to: '/ngo/recommended', label: 'Recommended for you', icon: Sparkles },
    { to: '/ngo/available', label: 'Available donations', icon: HandHeart },
    { to: '/ngo/map', label: 'Donations map', icon: MapIcon },
    { to: '/ngo/requests', label: 'Requests & offers', icon: Inbox },
    { to: '/ngo/active', label: 'Active collections', icon: Truck },
    { to: '/ngo/completed', label: 'Completed collections', icon: PackageCheck },
    { to: '/notifications', label: 'Notifications', icon: Bell },
    { to: '/ngo/profile', label: 'NGO profile & capacity', icon: User },
  ],
  admin: [
    { to: '/admin', label: 'Dashboard', icon: Gauge, end: true },
    { to: '/admin/users', label: 'User management', icon: Users },
    { to: '/admin/ngos', label: 'NGO verification', icon: BadgeCheck },
    { to: '/admin/donations', label: 'Donations', icon: ClipboardList },
    { to: '/admin/map', label: 'Donations map', icon: MapIcon },
    { to: '/admin/reports', label: 'Reports & moderation', icon: FileWarning },
    { to: '/admin/analytics', label: 'Platform analytics', icon: BarChart3 },
    { to: '/admin/audit-log', label: 'Audit log', icon: ScrollText },
    { to: '/notifications', label: 'Notifications', icon: Bell },
  ],
}

const ROLE_LABEL = { donor: 'Food donor', ngo: 'NGO', admin: 'Administrator' }

export default function DashboardLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [unread, setUnread] = useState(0)

  // Poll the unread count (simple "near real-time" without WebSockets).
  useEffect(() => {
    let active = true
    const load = () => getUnreadCount().then((d) => active && setUnread(d.unread)).catch(() => {})
    load()
    const timer = setInterval(load, 20000)
    return () => { active = false; clearInterval(timer) }
  }, [location.pathname])

  useEffect(() => setSidebarOpen(false), [location.pathname])

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const links = NAV_BY_ROLE[user.role] || []
  const displayName = user.ngo_profile?.organization_name || user.name

  const sidebar = (
    <nav className="flex flex-col gap-1" aria-label="Dashboard">
      {links.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
              isActive ? 'bg-brand-700 text-white' : 'text-gray-600 hover:bg-brand-50 hover:text-brand-800'
            }`
          }
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
          <span className="flex-1">{label}</span>
          {to === '/notifications' && unread > 0 && (
            <span className="rounded-full bg-red-500 px-1.5 text-xs font-bold text-white">{unread}</span>
          )}
        </NavLink>
      ))}
    </nav>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-gray-200 bg-white p-4 lg:flex">
        <Logo to="/" />
        <div className="mt-8 flex-1 overflow-y-auto">{sidebar}</div>
        <button onClick={handleLogout} className="btn-ghost justify-start text-gray-600"><LogOut className="h-4 w-4" /> Log out</button>
      </aside>

      {/* Mobile sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setSidebarOpen(false)} aria-hidden="true" />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col bg-white p-4 shadow-xl">
            <div className="flex items-center justify-between">
              <Logo to="/" />
              <button onClick={() => setSidebarOpen(false)} aria-label="Close menu"><X className="h-5 w-5" /></button>
            </div>
            <div className="mt-6 flex-1 overflow-y-auto">{sidebar}</div>
            <button onClick={handleLogout} className="btn-ghost justify-start text-gray-600"><LogOut className="h-4 w-4" /> Log out</button>
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-gray-200 bg-white/90 px-4 py-3 backdrop-blur sm:px-6">
          <button className="rounded-lg p-2 lg:hidden" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
          <div className="hidden text-sm text-gray-500 lg:block">{ROLE_LABEL[user.role]} workspace</div>
          <div className="flex items-center gap-3">
            <Link to="/notifications" className="relative rounded-lg p-2 text-gray-600 hover:bg-gray-100" aria-label={`Notifications, ${unread} unread`}>
              <Bell className="h-5 w-5" />
              {unread > 0 && <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-red-500" />}
            </Link>
            <div className="text-right">
              <p className="max-w-[12rem] truncate text-sm font-semibold text-gray-800">{displayName}</p>
              <p className="text-xs text-gray-500">{ROLE_LABEL[user.role]}</p>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
