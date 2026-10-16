/**
 * RegisterPage.jsx - sign up as a food donor or an NGO.
 * NGO accounts start as "pending" until an administrator verifies them.
 */
import { Building2, HandHeart, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { Alert, FormField, Spinner } from '../../components/ui'
import { dashboardPathFor } from '../../context/AuthContext'
import useAuth from '../../hooks/useAuth'
import { getErrorMessage, getFieldErrors } from '../../services/api'
import { DONOR_TYPES, FOOD_CATEGORIES, NGO_DIETARY_PREFERENCES } from '../../utils/constants'
import { validateRegistration } from '../../utils/validation'

const INITIAL = {
  role: 'donor', name: '', email: '', password: '', confirm_password: '', phone: '', address: '', area: '', postal_code: '',
  donor_type: 'restaurant',
  organization_name: '', registration_number: '', service_areas: '', postal_codes: '', max_capacity_servings: 100,
  pickup_lead_time_minutes: 60, dietary_preference: 'any', preferred_categories: [], can_store_refrigerated: false,
  can_store_frozen: false, accepts_unpackaged: true,
}

export default function RegisterPage() {
  const { user, register } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [form, setForm] = useState({ ...INITIAL, role: searchParams.get('role') === 'ngo' ? 'ngo' : 'donor' })
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (user) return <Navigate to={dashboardPathFor(user.role)} replace />

  const set = (field, value) => setForm((previous) => ({ ...previous, [field]: value }))
  const bind = (field) => ({ id: field, value: form[field], onChange: (e) => set(field, e.target.value), className: 'input' })
  const toggleCategory = (category) => set('preferred_categories', form.preferred_categories.includes(category)
    ? form.preferred_categories.filter((c) => c !== category)
    : [...form.preferred_categories, category])

  const handleSubmit = async (event) => {
    event.preventDefault()
    const formErrors = validateRegistration(form)
    setErrors(formErrors)
    if (Object.keys(formErrors).length) return
    setIsSubmitting(true)
    setServerError('')
    try {
      const { confirm_password: _unused, ...payload } = form
      const { user: newUser } = await register(payload)
      navigate(dashboardPathFor(newUser.role), { replace: true })
    } catch (error) {
      setErrors(getFieldErrors(error))
      setServerError(getErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  const isNgo = form.role === 'ngo'

  return (
    <div className="bg-brand-50 px-4 py-12">
      <form onSubmit={handleSubmit} className="card mx-auto max-w-2xl space-y-6 p-8" noValidate>
        <div className="text-center">
          <h1 className="text-2xl font-bold">Create your FoodConnect account</h1>
          <p className="mt-1 text-sm text-gray-500">Choose how you will use FoodConnect</p>
        </div>

        <fieldset className="grid grid-cols-2 gap-3">
          <legend className="sr-only">Account type</legend>
          {[
            { value: 'donor', label: 'I have surplus food', sub: 'Food donor', Icon: Building2 },
            { value: 'ngo', label: 'We distribute food', sub: 'NGO / charity', Icon: HandHeart },
          ].map(({ value, label, sub, Icon }) => (
            <label key={value} className={`cursor-pointer rounded-xl border-2 p-4 text-center transition ${form.role === value ? 'border-brand-600 bg-brand-50' : 'border-gray-200 hover:border-brand-300'}`}>
              <input type="radio" name="role" value={value} checked={form.role === value} onChange={() => set('role', value)} className="sr-only" />
              <Icon className="mx-auto h-6 w-6 text-brand-700" />
              <span className="mt-2 block font-semibold">{label}</span>
              <span className="text-xs text-gray-500">{sub}</span>
            </label>
          ))}
        </fieldset>

        <Alert type="error">{serverError}</Alert>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="name" label={isNgo ? 'Contact person name' : 'Name / business name'} error={errors.name} required><input {...bind('name')} /></FormField>
          <FormField id="email" label="Email" error={errors.email} required><input type="email" autoComplete="email" {...bind('email')} /></FormField>
          <FormField id="password" label="Password" error={errors.password} hint="8+ characters, letters and numbers" required><input type="password" autoComplete="new-password" {...bind('password')} /></FormField>
          <FormField id="confirm_password" label="Confirm password" error={errors.confirm_password} required><input type="password" autoComplete="new-password" {...bind('confirm_password')} /></FormField>
          <FormField id="phone" label="Phone" error={errors.phone} required><input type="tel" {...bind('phone')} /></FormField>
          {!isNgo && (
            <FormField id="donor_type" label="Donor type" error={errors.donor_type}>
              <select {...bind('donor_type')}>{Object.entries(DONOR_TYPES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            </FormField>
          )}
          <FormField id="area" label="Area / locality" error={errors.area} hint="e.g. Adyar" required><input {...bind('area')} /></FormField>
          <FormField id="postal_code" label="Postal (PIN) code" error={errors.postal_code} required><input inputMode="numeric" {...bind('postal_code')} /></FormField>
          <div className="sm:col-span-2"><FormField id="address" label="Address" error={errors.address}><input {...bind('address')} /></FormField></div>
        </div>

        {isNgo && (
          <div className="space-y-4 rounded-xl border border-brand-100 bg-brand-50/50 p-4">
            <h2 className="font-semibold text-brand-800">Organisation details (used for matching)</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="organization_name" label="Organisation name" error={errors.organization_name} required><input {...bind('organization_name')} /></FormField>
              <FormField id="registration_number" label="Registration number" error={errors.registration_number}><input {...bind('registration_number')} /></FormField>
              <FormField id="service_areas" label="Service areas" hint="Comma separated, e.g. Adyar, Besant Nagar" error={errors.service_areas} required><input {...bind('service_areas')} /></FormField>
              <FormField id="postal_codes" label="Service postal codes" hint="Comma separated" error={errors.postal_codes}><input {...bind('postal_codes')} /></FormField>
              <FormField id="max_capacity_servings" label="Max servings you can collect" error={errors.max_capacity_servings} required><input type="number" min="1" {...bind('max_capacity_servings')} /></FormField>
              <FormField id="pickup_lead_time_minutes" label="Minutes needed to reach a donor" error={errors.pickup_lead_time_minutes}><input type="number" min="10" {...bind('pickup_lead_time_minutes')} /></FormField>
              <FormField id="dietary_preference" label="Dietary requirement" error={errors.dietary_preference}>
                <select {...bind('dietary_preference')}>{Object.entries(NGO_DIETARY_PREFERENCES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
              </FormField>
            </div>
            <fieldset>
              <legend className="label">Preferred food categories (leave empty to accept all)</legend>
              <div className="flex flex-wrap gap-2">
                {Object.entries(FOOD_CATEGORIES).map(([value, text]) => (
                  <label key={value} className={`cursor-pointer rounded-full border px-3 py-1 text-sm ${form.preferred_categories.includes(value) ? 'border-brand-600 bg-brand-600 text-white' : 'border-gray-300 bg-white'}`}>
                    <input type="checkbox" className="sr-only" checked={form.preferred_categories.includes(value)} onChange={() => toggleCategory(value)} />{text}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="flex flex-wrap gap-4 text-sm">
              {[['can_store_refrigerated', 'Can keep food refrigerated'], ['can_store_frozen', 'Can keep food frozen'], ['accepts_unpackaged', 'Accepts unpackaged food']].map(([field, text]) => (
                <label key={field} className="flex items-center gap-2">
                  <input type="checkbox" className="h-4 w-4 accent-brand-700" checked={form[field]} onChange={(e) => set(field, e.target.checked)} /> {text}
                </label>
              ))}
            </div>
            <p className="text-xs text-gray-500">An administrator must verify your NGO before it can request donations or appear in recommendations.</p>
          </div>
        )}

        <button className="btn-primary w-full py-2.5" disabled={isSubmitting}>
          {isSubmitting ? <Spinner className="h-4 w-4 text-white" /> : <UserPlus className="h-4 w-4" />} Create account
        </button>
        <p className="text-center text-sm text-gray-500">Already have an account? <Link to="/login" className="font-semibold text-brand-700 hover:underline">Log in</Link></p>
      </form>
    </div>
  )
}
