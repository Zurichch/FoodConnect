/**
 * LandingPage.jsx - the public home page.
 * The statistics section is loaded from GET /api/public/stats (real database counts).
 */
import {
  ArrowRight, BadgeCheck, Brain, Building2, CheckCircle2, ClipboardCheck, HandHeart, Leaf, ShieldCheck, Timer, Truck, Utensils,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { Spinner } from '../../components/ui'
import useApi from '../../hooks/useApi'
import { getPublicStats } from '../../services/publicService'
import { STATUS_INFO, NORMAL_FLOW } from '../../utils/constants'
import { formatNumber } from '../../utils/format'

// Default weights (the live values come from the backend's matching.py via /api/public/stats).
const DEFAULT_WEIGHTS = { location: 30, capacity: 20, category: 15, dietary: 15, deadline: 20 }

const WEIGHT_LABELS = {
  location: 'Location / service area',
  capacity: 'Collection capacity',
  category: 'Food category preference',
  dietary: 'Dietary compatibility',
  deadline: 'Pickup deadline feasibility',
}

export default function LandingPage() {
  const { data: stats, isLoading, error } = useApi(getPublicStats, [])

  return (
    <>
      {/* 1. Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-brand-50 to-white">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 md:grid-cols-2 md:py-24">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-800">
              <Leaf className="h-3.5 w-3.5" /> AI-enabled food waste reduction
            </span>
            <h1 className="mt-4 text-4xl font-extrabold leading-tight tracking-tight text-gray-900 md:text-5xl">
              Turn surplus food into <span className="text-brand-700">shared hope.</span>
            </h1>
            <p className="mt-4 text-lg text-gray-600">
              Restaurants, hotels, canteens and households throw away good food every day while
              nearby shelters struggle to feed people. FoodConnect matches surplus food with verified
              NGOs, checks it against time and safety rules, and tracks every donation until it is delivered.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/register?role=donor" className="btn-primary px-5 py-3 text-base">Donate surplus food <ArrowRight className="h-4 w-4" /></Link>
              <Link to="/register?role=ngo" className="btn-secondary px-5 py-3 text-base">Register your NGO</Link>
            </div>
            <p className="mt-4 text-sm text-gray-500">Already registered? <Link to="/login" className="font-semibold text-brand-700 hover:underline">Log in</Link></p>
          </div>
          <div className="card relative space-y-4 p-6 shadow-lg">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Example recommendation</p>
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 flex-col items-center justify-center rounded-full bg-brand-600 text-white">
                <span className="text-xl font-bold">95</span><span className="text-[10px]">/ 100</span>
              </div>
              <div>
                <p className="font-semibold">Helping Hands Food Bank</p>
                <p className="text-sm text-gray-500">for 30 servings of idli & chutney</p>
              </div>
            </div>
            <p className="rounded-lg bg-brand-50 p-3 text-sm text-brand-900">
              "Recommended because the NGO serves this area, has sufficient collection capacity,
              accepts vegetarian food, and can collect before the pickup deadline."
            </p>
            <p className="text-xs text-gray-400">Illustration. Real scores are calculated by the backend for each donation.</p>
          </div>
        </div>
      </section>

      {/* 2. Statistics from the database */}
      <section className="border-y border-gray-100 bg-white" aria-labelledby="stats-heading">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <h2 id="stats-heading" className="sr-only">Platform statistics</h2>
          {isLoading ? (
            <div className="flex justify-center"><Spinner /></div>
          ) : error ? (
            <p className="text-center text-sm text-gray-500">Live statistics are unavailable right now ({error}).</p>
          ) : (
            <>
              <dl className="grid grid-cols-2 gap-6 text-center md:grid-cols-4">
                {[
                  ['Donations delivered', stats.completed_donations],
                  ['Servings recovered', stats.servings_recovered],
                  ['Verified NGOs', stats.verified_ngos],
                  ['Registered donors', stats.active_donors],
                ].map(([text, value]) => (
                  <div key={text}>
                    <dd className="text-3xl font-extrabold text-brand-700">{formatNumber(value)}</dd>
                    <dt className="text-sm text-gray-500">{text}</dt>
                  </div>
                ))}
              </dl>
              <p className="mt-4 text-center text-xs text-gray-400">
                Live counts from the FoodConnect database. Estimated food recovered: about {formatNumber(stats.impact_estimate.estimated_food_kg)} kg
                (illustrative estimate - {stats.impact_estimate.assumptions})
              </p>
            </>
          )}
        </div>
      </section>

      {/* 3. How it works */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-center text-3xl font-bold">How it works in three steps</h2>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {[
            { icon: Utensils, title: '1. Donor lists surplus food', text: 'Enter what the food is, how many servings, when it was prepared, its use-by time and the pickup deadline. Safety checks run instantly.' },
            { icon: Brain, title: '2. Smart matching ranks NGOs', text: 'A transparent algorithm scores verified NGOs out of 100 on location, capacity, food preferences, diet and timing - and explains why.' },
            { icon: Truck, title: '3. NGO collects and delivers', text: 'The NGO requests or accepts the donation, schedules pickup, and updates the status until the food is delivered to people in need.' },
          ].map(({ icon: Icon, title, text }) => (
            <div key={title} className="card">
              <div className="mb-4 inline-flex rounded-xl bg-brand-100 p-3 text-brand-700"><Icon className="h-6 w-6" /></div>
              <h3 className="font-semibold">{title}</h3>
              <p className="mt-2 text-sm text-gray-600">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 4. Benefits */}
      <section className="bg-brand-50">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-16 md:grid-cols-2">
          <div className="card">
            <Building2 className="h-8 w-8 text-brand-700" />
            <h3 className="mt-3 text-xl font-semibold">For food donors</h3>
            <ul className="mt-3 space-y-2 text-sm text-gray-600">
              {['List surplus food in under two minutes', 'See which NGOs fit best, and why', 'Track pickup and delivery step by step', 'See your total servings recovered'].map((t) => (
                <li key={t} className="flex gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-brand-600" />{t}</li>
              ))}
            </ul>
          </div>
          <div className="card">
            <HandHeart className="h-8 w-8 text-brand-700" />
            <h3 className="mt-3 text-xl font-semibold">For NGOs</h3>
            <ul className="mt-3 space-y-2 text-sm text-gray-600">
              {['Get donations recommended for your area and capacity', 'Filter by category, diet, servings and deadline', 'Respect your dietary and storage rules automatically', 'Record servings received and distributed'].map((t) => (
                <li key={t} className="flex gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-brand-600" />{t}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* 5. Intelligent matching */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="grid gap-10 md:grid-cols-2">
          <div>
            <h2 className="text-3xl font-bold">Explainable intelligent matching</h2>
            <p className="mt-3 text-gray-600">
              No black box: every recommendation shows its score and the reason for each point. NGOs that are not
              verified, cannot store the food safely, lack capacity or cannot arrive in time are excluded before scoring.
            </p>
            <ul className="mt-4 space-y-2 text-sm text-gray-600">
              <li className="flex gap-2"><BadgeCheck className="h-4 w-4 text-brand-600" />Only administrator-verified NGOs are recommended</li>
              <li className="flex gap-2"><ShieldCheck className="h-4 w-4 text-brand-600" />Food-safety rules always override the score</li>
              <li className="flex gap-2"><Timer className="h-4 w-4 text-brand-600" />Area-based location matching (no GPS claims)</li>
            </ul>
          </div>
          <div className="card">
            <h3 className="mb-4 font-semibold">Score out of 100</h3>
            {Object.keys(WEIGHT_LABELS).map((key) => [key, stats?.matching_weights?.[key] ?? DEFAULT_WEIGHTS[key]]).map(([key, points]) => (
              <div key={key} className="mb-3">
                <div className="flex justify-between text-sm"><span>{WEIGHT_LABELS[key]}</span><span className="font-semibold">{points} pts</span></div>
                <div className="mt-1 h-2 rounded-full bg-gray-100"><div className="h-2 rounded-full bg-brand-500" style={{ width: `${points * 3.33}%` }} /></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. Sample workflow */}
      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-4 pb-16">
          <h2 className="text-center text-3xl font-bold">A donation's journey</h2>
          <ol className="mt-8 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {NORMAL_FLOW.map((status, index) => (
              <li key={status} className="rounded-xl border border-brand-100 bg-brand-50 p-4 text-center">
                <span className="text-xs font-bold text-brand-600">STEP {index + 1}</span>
                <p className="font-semibold text-gray-900">{STATUS_INFO[status].label}</p>
                <p className="mt-1 text-xs text-gray-500">{STATUS_INFO[status].meaning}</p>
              </li>
            ))}
          </ol>
          <div className="mt-10 rounded-2xl bg-brand-800 px-6 py-10 text-center text-white">
            <ClipboardCheck className="mx-auto h-10 w-10 text-brand-200" />
            <h2 className="mt-3 text-2xl font-bold">Ready to stop good food going to waste?</h2>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link to="/register" className="btn bg-white px-5 py-3 text-brand-800 hover:bg-brand-50">Create an account</Link>
              <Link to="/how-it-works" className="btn border border-brand-300 px-5 py-3 text-white hover:bg-brand-700">Learn more</Link>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
