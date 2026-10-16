// Logo.jsx - the FoodConnect wordmark.
import { Leaf } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function Logo({ to = '/', light = false }) {
  return (
    <Link to={to} className="inline-flex items-center gap-2" aria-label="FoodConnect home">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-700 text-white">
        <Leaf className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className={`text-lg font-extrabold tracking-tight ${light ? 'text-white' : 'text-gray-900'}`}>
        Food<span className={light ? 'text-brand-200' : 'text-brand-600'}>Connect</span>
      </span>
    </Link>
  )
}
