// PublicLayout.jsx - top navigation bar + footer for the public pages.
import { Menu, X } from 'lucide-react'
import { useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import Logo from '../components/Logo'
import { dashboardPathFor } from '../context/AuthContext'
import useAuth from '../hooks/useAuth'

const LINKS = [
  { to: '/', label: 'Home', end: true },
  { to: '/about', label: 'About' },
  { to: '/how-it-works', label: 'How it works' },
  { to: '/contact', label: 'Contact' },
]

export default function PublicLayout() {
  const { user } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const linkClass = ({ isActive }) =>
    `rounded-lg px-3 py-2 text-sm font-medium ${isActive ? 'text-brand-700' : 'text-gray-600 hover:text-gray-900'}`

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="sticky top-0 z-40 border-b border-gray-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Logo />
          <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
            {LINKS.map((link) => <NavLink key={link.to} {...link} className={linkClass}>{link.label}</NavLink>)}
          </nav>
          <div className="hidden items-center gap-2 md:flex">
            {user ? (
              <Link to={dashboardPathFor(user.role)} className="btn-primary">Go to dashboard</Link>
            ) : (
              <>
                <Link to="/login" className="btn-ghost">Log in</Link>
                <Link to="/register" className="btn-primary">Get started</Link>
              </>
            )}
          </div>
          <button className="rounded-lg p-2 md:hidden" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle menu" aria-expanded={menuOpen}>
            {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
        {menuOpen && (
          <nav className="border-t border-gray-100 px-4 py-3 md:hidden" aria-label="Mobile">
            <div className="flex flex-col gap-1" onClick={() => setMenuOpen(false)}>
              {LINKS.map((link) => <NavLink key={link.to} {...link} className={linkClass}>{link.label}</NavLink>)}
              {user ? (
                <Link to={dashboardPathFor(user.role)} className="btn-primary mt-2">Go to dashboard</Link>
              ) : (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Link to="/login" className="btn-secondary">Log in</Link>
                  <Link to="/register" className="btn-primary">Get started</Link>
                </div>
              )}
            </div>
          </nav>
        )}
      </header>

      <main className="flex-1"><Outlet /></main>

      <footer className="bg-brand-900 text-brand-100">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-3">
          <div>
            <Logo light />
            <p className="mt-3 text-sm text-brand-200">Turn surplus food into shared hope.</p>
          </div>
          <div>
            <h2 className="mb-2 text-sm font-semibold text-white">Explore</h2>
            <ul className="space-y-1 text-sm">
              {LINKS.map((link) => <li key={link.to}><Link to={link.to} className="hover:text-white">{link.label}</Link></li>)}
              <li><Link to="/register" className="hover:text-white">Register as donor or NGO</Link></li>
            </ul>
          </div>
          <div className="text-sm text-brand-200">
            <h2 className="mb-2 text-sm font-semibold text-white">About this project</h2>
            <p>An end-semester engineering project: React + Flask + SQLite with explainable NGO matching.</p>
            <p className="mt-2 text-xs">FoodConnect does not certify food safety. Donors must follow local food-safety regulations.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
