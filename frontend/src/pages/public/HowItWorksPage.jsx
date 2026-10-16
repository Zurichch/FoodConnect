// HowItWorksPage.jsx - step-by-step explanation for donors, NGOs and admins, plus the scoring formula.
import { Link } from 'react-router-dom'
import { NORMAL_FLOW, STATUS_INFO } from '../../utils/constants'

const SECTIONS = [
  {
    title: 'For food donors',
    steps: [
      'Register as a donor (restaurant, hotel, canteen, bakery, supermarket, caterer or individual).',
      'Click "Donate food" and fill in the food details, preparation time, use-by time and pickup deadline.',
      'The backend checks the times. Expired or impossible donations are blocked; risky ones get warnings.',
      'See ranked NGO recommendations with a score out of 100 and the reason behind every point.',
      'Offer the donation to an NGO, or accept a request that an NGO sends you.',
      'Follow the timeline as the NGO schedules pickup, collects and delivers the food.',
    ],
  },
  {
    title: 'For NGOs',
    steps: [
      'Register your organisation with service areas, capacity, food preferences and storage abilities.',
      'Wait for an administrator to verify your NGO (unverified NGOs are never recommended).',
      'Open "Recommended for you" or browse and filter all available donations.',
      'Request a donation, or accept an offer from a donor.',
      'Schedule the pickup, mark it collected, then delivered with the servings distributed.',
    ],
  },
  {
    title: 'For administrators',
    steps: [
      'Verify or reject NGO registrations.',
      'Suspend fraudulent accounts and remove inappropriate donations.',
      'Review reports, monitor analytics and read the audit log of admin actions.',
    ],
  },
]

export default function HowItWorksPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-14">
      <h1 className="text-4xl font-extrabold">How FoodConnect works</h1>
      <div className="mt-10 grid gap-6 md:grid-cols-3">
        {SECTIONS.map((section) => (
          <div key={section.title} className="card">
            <h2 className="text-lg font-semibold text-brand-800">{section.title}</h2>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-gray-600">
              {section.steps.map((step) => <li key={step}>{step}</li>)}
            </ol>
          </div>
        ))}
      </div>

      <h2 className="mt-14 text-2xl font-bold">The matching score</h2>
      <div className="card mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b"><th className="table-head">Factor</th><th className="table-head">Max points</th><th className="table-head">How it is judged</th></tr></thead>
          <tbody className="divide-y">
            <tr><td className="table-cell">Location</td><td className="table-cell">30</td><td className="table-cell">30 if the NGO serves the pickup area or postal code, 15 if it works in the same postal district (same first 3 PIN digits).</td></tr>
            <tr><td className="table-cell">Capacity</td><td className="table-cell">20</td><td className="table-cell">20 if free capacity is at least 2x the servings, 15 if 1.25x, 10 if just enough.</td></tr>
            <tr><td className="table-cell">Food category</td><td className="table-cell">15</td><td className="table-cell">15 if preferred (or the NGO accepts all), otherwise 6.</td></tr>
            <tr><td className="table-cell">Dietary</td><td className="table-cell">15</td><td className="table-cell">15 when compatible; 7 when a "prefers vegetarian" NGO gets non-veg food.</td></tr>
            <tr><td className="table-cell">Pickup deadline</td><td className="table-cell">20</td><td className="table-cell">Spare time after the NGO's travel time: 3 h+ = 20, 1 h+ = 14, less = 8.</td></tr>
          </tbody>
        </table>
        <p className="mt-3 text-xs text-gray-500">
          NGOs are excluded completely if they are unverified or suspended, break a declared dietary or storage rule,
          lack capacity, cannot arrive before the deadline, or are outside the postal district.
        </p>
      </div>

      <h2 className="mt-14 text-2xl font-bold">Donation statuses</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[...NORMAL_FLOW, 'CANCELLED', 'EXPIRED', 'REJECTED'].map((status) => (
          <div key={status} className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="font-semibold">{STATUS_INFO[status].label}</p>
            <p className="text-sm text-gray-500">{STATUS_INFO[status].meaning}</p>
          </div>
        ))}
      </div>
      <p className="mt-4 text-sm text-gray-500">
        Tracking means following these statuses, refreshed automatically every few seconds. It is not live GPS tracking.
      </p>

      <div className="mt-10 text-center">
        <Link to="/register" className="btn-primary px-6 py-3">Join FoodConnect</Link>
      </div>
    </div>
  )
}
