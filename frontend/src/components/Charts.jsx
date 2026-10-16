/**
 * Charts.jsx - the two chart types used by the dashboards (built with Recharts).
 * They only display numbers that the backend calculated from the database.
 */
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { FOOD_CATEGORIES, label } from '../utils/constants'

const monthLabel = (value) => {
  const [year, month] = value.split('-')
  return new Date(Number(year), Number(month) - 1).toLocaleString(undefined, { month: 'short' })
}

export function MonthlyTrendChart({ data }) {
  const hasData = data?.some((row) => row.created > 0)
  if (!hasData) return <p className="py-10 text-center text-sm text-gray-400">No donations in the last 6 months yet.</p>
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2ef" />
          <XAxis dataKey="month" tickFormatter={monthLabel} tick={{ fontSize: 12 }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
          <Tooltip labelFormatter={monthLabel} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="created" name="Donations created" fill="#8dd1a6" radius={[4, 4, 0, 0]} />
          <Bar dataKey="delivered" name="Delivered" fill="#1e623c" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function CategoryChart({ data }) {
  if (!data?.length) return <p className="py-10 text-center text-sm text-gray-400">No donations yet.</p>
  const rows = data.map((row) => ({ ...row, name: label(FOOD_CATEGORIES, row.category) }))
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 16, left: 30, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#eef2ef" />
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
          <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 12 }} />
          <Tooltip />
          <Bar dataKey="donations" name="Donations" fill="#35975d" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
