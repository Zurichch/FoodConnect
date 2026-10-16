/**
 * MatchCard.jsx - shows one NGO recommendation (or one donation recommendation for an NGO)
 * with the total score and a bar for each of the 5 score components.
 * Every number here comes from the backend's matching.py - nothing is calculated in React.
 */
import { MapPin, Users } from 'lucide-react'

function scoreColor(score) {
  if (score >= 80) return 'bg-brand-600'
  if (score >= 60) return 'bg-brand-400'
  return 'bg-amber-400'
}

export function ScoreBreakdown({ components }) {
  return (
    <ul className="space-y-2">
      {components.map((component) => (
        <li key={component.key}>
          <div className="flex justify-between text-xs">
            <span className="font-medium text-gray-700">{component.label}</span>
            <span className="text-gray-500">{component.points} / {component.max_points}</span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-gray-100" aria-hidden="true">
            <div
              className={`h-2 rounded-full ${component.points === component.max_points ? 'bg-brand-600' : component.points > 0 ? 'bg-brand-400' : 'bg-red-300'}`}
              style={{ width: `${(component.points / component.max_points) * 100}%` }}
            />
          </div>
          <p className="mt-0.5 text-xs text-gray-500">{component.reason}</p>
        </li>
      ))}
    </ul>
  )
}

export function ScoreCircle({ score }) {
  return (
    <div className={`flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-full text-white ${scoreColor(score)}`}>
      <span className="text-xl font-bold leading-none">{score}</span>
      <span className="text-[10px] uppercase tracking-wide">/ 100</span>
    </div>
  )
}

export default function MatchCard({ match, footer }) {
  const ngo = match.ngo
  return (
    <article className="card">
      <div className="flex items-start gap-4">
        <ScoreCircle score={match.score} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {match.rank && <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-bold text-brand-800">#{match.rank}</span>}
            <h3 className="font-semibold text-gray-900">{ngo.organization_name}</h3>
          </div>
          <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
            <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{ngo.service_areas.join(', ')}</span>
            <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" />{match.available_capacity} servings capacity free</span>
          </p>
          <p className="mt-3 rounded-lg bg-brand-50 p-3 text-sm text-brand-900">{match.explanation}</p>
        </div>
      </div>
      <details className="mt-4">
        <summary className="cursor-pointer text-sm font-medium text-brand-700">See how the score was calculated</summary>
        <div className="mt-3"><ScoreBreakdown components={match.components} /></div>
      </details>
      {footer && <div className="mt-4 border-t border-gray-100 pt-4">{footer}</div>}
    </article>
  )
}
