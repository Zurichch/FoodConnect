// AboutPage.jsx - the problem, the solution and the project's honest limitations.
import { AlertTriangle, Lightbulb, Target } from 'lucide-react'

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-14">
      <h1 className="text-4xl font-extrabold">About FoodConnect</h1>
      <p className="mt-4 text-lg text-gray-600">
        FoodConnect is an end-semester engineering project that connects people and organisations with surplus food
        to NGOs and charities who can distribute it to people in need.
      </p>

      <div className="mt-10 grid gap-6 md:grid-cols-3">
        <div className="card">
          <AlertTriangle className="h-7 w-7 text-amber-500" />
          <h2 className="mt-3 font-semibold">The problem</h2>
          <p className="mt-2 text-sm text-gray-600">
            Large amounts of edible food are discarded by restaurants, hotels, canteens and events, while shelters
            and community kitchens nearby lack food. Coordination usually happens through phone calls and messaging
            groups, so donations are missed, arrive too late or go to an NGO that cannot use them.
          </p>
        </div>
        <div className="card">
          <Lightbulb className="h-7 w-7 text-brand-600" />
          <h2 className="mt-3 font-semibold">Our solution</h2>
          <p className="mt-2 text-sm text-gray-600">
            A single platform where donors list surplus food, the system checks time-based safety rules, an explainable
            algorithm ranks suitable verified NGOs, and both sides track the donation from listing to delivery.
          </p>
        </div>
        <div className="card">
          <Target className="h-7 w-7 text-sky-600" />
          <h2 className="mt-3 font-semibold">Objectives</h2>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-gray-600">
            <li>Reduce edible food waste</li>
            <li>Match food to the right NGO quickly</li>
            <li>Make every recommendation explainable</li>
            <li>Keep a transparent record of every donation</li>
          </ul>
        </div>
      </div>

      <h2 className="mt-12 text-2xl font-bold">Existing system limitations</h2>
      <ul className="mt-3 list-disc space-y-1 pl-6 text-gray-600">
        <li>Manual coordination by phone or messaging groups does not scale.</li>
        <li>No check that an NGO can store the food or collect it before it expires.</li>
        <li>No shared record of who collected what, and when.</li>
        <li>Donors cannot see the impact of their donations.</li>
      </ul>

      <h2 className="mt-12 text-2xl font-bold">What FoodConnect does not claim</h2>
      <ul className="mt-3 list-disc space-y-1 pl-6 text-gray-600">
        <li>It does <strong>not certify food safety</strong>. Donors are responsible for accurate information and for following local food-safety regulations.</li>
        <li>Location matching is <strong>area- and postal-code-based</strong>, not GPS distance.</li>
        <li>Tracking shows the <strong>donation status</strong> (accepted, collected ...), not a live vehicle location.</li>
        <li>Environmental impact numbers are <strong>illustrative estimates</strong>; food is not weighed.</li>
      </ul>
    </div>
  )
}
