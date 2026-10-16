/**
 * NgoProfilePage.jsx - organisation details used by the matching algorithm:
 * service areas, postal codes, capacity, travel time, food categories, diet and storage.
 * GET / PUT /api/ngo/profile
 */
import { Save } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Alert, FormField, PageHeader, PageLoader, Spinner } from '../../components/ui'
import useAuth from '../../hooks/useAuth'
import { getErrorMessage, getFieldErrors } from '../../services/api'
import { getNgoProfile, updateNgoProfile } from '../../services/ngoService'
import { FOOD_CATEGORIES, NGO_DIETARY_PREFERENCES } from '../../utils/constants'

export default function NgoProfilePage() {
  const { refreshUser } = useAuth()
  const [form, setForm] = useState(null)
  const [verification, setVerification] = useState(null)
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState({ type: '', text: '' })
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    getNgoProfile()
      .then((profile) => {
        setVerification({ status: profile.verification_status, note: profile.verification_note })
        setForm({
          ...profile,
          service_areas: profile.service_areas.join(', '),
          postal_codes: profile.postal_codes.join(', '),
          registration_number: profile.registration_number || '',
          description: profile.description || '',
          address: profile.address || '',
          contact_email: profile.contact_email || '',
          request_reverification: false,
        })
      })
      .catch((error) => setMessage({ type: 'error', text: getErrorMessage(error) }))
  }, [])

  if (!form) return message.text ? <Alert type="error">{message.text}</Alert> : <PageLoader />

  const set = (field, value) => setForm({ ...form, [field]: value })
  const bind = (field) => ({ id: field, className: 'input', value: form[field] ?? '', onChange: (e) => set(field, e.target.value) })
  const toggleCategory = (category) => set('preferred_categories', form.preferred_categories.includes(category)
    ? form.preferred_categories.filter((c) => c !== category) : [...form.preferred_categories, category])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setIsSaving(true)
    setErrors({})
    try {
      const { data, message: text } = await updateNgoProfile(form)
      setVerification({ status: data.verification_status, note: data.verification_note })
      setForm({ ...form, request_reverification: false })
      setMessage({ type: 'success', text })
      refreshUser()
    } catch (error) {
      setErrors(getFieldErrors(error))
      setMessage({ type: 'error', text: getErrorMessage(error) })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="max-w-4xl">
      <PageHeader title="NGO profile & capacity" subtitle="These details decide which donations are recommended to you." />
      <div className="mb-4">
        <Alert type={verification.status === 'verified' ? 'success' : verification.status === 'rejected' ? 'error' : 'warning'}>
          Verification status: <strong className="capitalize">{verification.status}</strong>{verification.note && ` - ${verification.note}`}
        </Alert>
      </div>
      {message.text && <div className="mb-4"><Alert type={message.type} onClose={() => setMessage({ type: '', text: '' })}>{message.text}</Alert></div>}

      <form onSubmit={handleSubmit} className="space-y-6" noValidate>
        <section className="card grid gap-4 sm:grid-cols-2">
          <h2 className="font-semibold sm:col-span-2">Organisation</h2>
          <FormField id="organization_name" label="Organisation name" error={errors.organization_name} required><input {...bind('organization_name')} /></FormField>
          <FormField id="registration_number" label="Registration number" error={errors.registration_number}><input {...bind('registration_number')} /></FormField>
          <FormField id="contact_phone" label="Contact phone" error={errors.contact_phone} required><input {...bind('contact_phone')} /></FormField>
          <FormField id="contact_email" label="Contact email" error={errors.contact_email}><input {...bind('contact_email')} /></FormField>
          <div className="sm:col-span-2"><FormField id="address" label="Address" error={errors.address}><input {...bind('address')} /></FormField></div>
          <div className="sm:col-span-2"><FormField id="description" label="About your organisation" error={errors.description}><textarea rows={3} {...bind('description')} /></FormField></div>
        </section>

        <section className="card grid gap-4 sm:grid-cols-2">
          <h2 className="font-semibold sm:col-span-2">Service area & capacity (used for matching)</h2>
          <FormField id="service_areas" label="Service areas" hint="Comma separated" error={errors.service_areas} required><input {...bind('service_areas')} /></FormField>
          <FormField id="postal_codes" label="Postal codes" hint="Comma separated" error={errors.postal_codes}><input {...bind('postal_codes')} /></FormField>
          <FormField id="max_capacity_servings" label="Maximum collection capacity (servings)" error={errors.max_capacity_servings} required><input type="number" min="1" {...bind('max_capacity_servings')} /></FormField>
          <FormField id="pickup_lead_time_minutes" label="Minutes needed to reach a donor" error={errors.pickup_lead_time_minutes} required><input type="number" min="10" {...bind('pickup_lead_time_minutes')} /></FormField>
          <FormField id="opening_time" label="Opens at" error={errors.opening_time} required><input type="time" {...bind('opening_time')} /></FormField>
          <FormField id="closing_time" label="Closes at" error={errors.closing_time} required><input type="time" {...bind('closing_time')} /></FormField>
        </section>

        <section className="card space-y-4">
          <h2 className="font-semibold">Food preferences & handling</h2>
          <FormField id="dietary_preference" label="Dietary requirement" error={errors.dietary_preference} required>
            <select {...bind('dietary_preference')}>{Object.entries(NGO_DIETARY_PREFERENCES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          </FormField>
          <fieldset>
            <legend className="label">Preferred categories (none selected = accepts all)</legend>
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
              <label key={field} className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-brand-700" checked={form[field]} onChange={(e) => set(field, e.target.checked)} /> {text}</label>
            ))}
          </div>
          {verification.status === 'rejected' && (
            <label className="flex items-center gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
              <input type="checkbox" className="h-4 w-4" checked={form.request_reverification} onChange={(e) => set('request_reverification', e.target.checked)} />
              Ask an administrator to verify my NGO again after saving
            </label>
          )}
        </section>

        <button className="btn-primary" disabled={isSaving}>{isSaving ? <Spinner className="h-4 w-4 text-white" /> : <Save className="h-4 w-4" />} Save profile</button>
      </form>
    </div>
  )
}
