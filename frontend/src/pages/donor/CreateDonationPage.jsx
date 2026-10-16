/**
 * CreateDonationPage.jsx - the "Donate food" form (also used to edit an available donation).
 *
 * While the donor types, the times are sent to POST /api/donations/safety-check
 * so the safety panel updates live. The real check happens again when saving.
 * After saving, the donor is taken straight to the NGO recommendations.
 */
import { AlertTriangle, CheckCircle2, Save, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Alert, FormField, PageHeader, PageLoader, Spinner } from '../../components/ui'
import useAuth from '../../hooks/useAuth'
import { getErrorMessage, getFieldErrors } from '../../services/api'
import { createDonation, getDonation, previewSafetyCheck, updateDonation } from '../../services/donationService'
import { DIETARY_TYPES, FOOD_CATEGORIES, QUANTITY_UNITS, STORAGE_TYPES } from '../../utils/constants'
import { hoursFromNow, inputToIso, toInputDateTime } from '../../utils/format'
import { validateDonation } from '../../utils/validation'

function emptyForm(user) {
  return {
    food_name: '', category: 'cooked_meals', description: '', quantity: '', quantity_unit: 'kg', servings: '',
    dietary_type: 'vegetarian', is_packaged: false, storage_type: 'room_temperature', allergens: '',
    prepared_at: hoursFromNow(-1), expires_at: hoursFromNow(5), pickup_deadline: hoursFromNow(4),
    pickup_address: user.address || '', pickup_area: user.area || '', pickup_postal_code: user.postal_code || '',
    notes: '', safety_declaration: false,
  }
}

/** Convert the form (local times) into the JSON the API expects (UTC ISO times). */
function toPayload(form) {
  return {
    ...form,
    prepared_at: inputToIso(form.prepared_at),
    expires_at: inputToIso(form.expires_at),
    pickup_deadline: inputToIso(form.pickup_deadline),
  }
}

export default function CreateDonationPage() {
  const { user } = useAuth()
  const { donationId } = useParams()
  const isEditing = Boolean(donationId)
  const navigate = useNavigate()
  const [form, setForm] = useState(() => emptyForm(user))
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState('')
  const [safety, setSafety] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(isEditing)

  // Editing: load the existing donation into the form.
  useEffect(() => {
    if (!isEditing) return
    getDonation(donationId)
      .then(({ donation }) => {
        const local = (iso) => toInputDateTime(new Date(iso))
        setForm({
          ...emptyForm(user), ...donation,
          description: donation.description || '', allergens: donation.allergens || '', notes: donation.notes || '',
          prepared_at: local(donation.prepared_at), expires_at: local(donation.expires_at), pickup_deadline: local(donation.pickup_deadline),
          safety_declaration: false,
        })
      })
      .catch((error) => setServerError(getErrorMessage(error)))
      .finally(() => setIsLoading(false))
  }, [donationId, isEditing, user])

  // Live safety preview (waits 400 ms after the last change to avoid too many requests).
  useEffect(() => {
    const timer = setTimeout(() => {
      previewSafetyCheck(toPayload(form)).then(setSafety).catch(() => setSafety(null))
    }, 400)
    return () => clearTimeout(timer)
  }, [form.prepared_at, form.expires_at, form.pickup_deadline, form.storage_type, form.category, form.is_packaged, form.allergens, form.safety_declaration]) // eslint-disable-line react-hooks/exhaustive-deps

  const set = (field, value) => {
    setForm((previous) => ({ ...previous, [field]: value }))
    setErrors((previous) => ({ ...previous, [field]: undefined })) // clear the old message for this field
  }
  const bind = (field) => ({ id: field, value: form[field] ?? '', onChange: (e) => set(field, e.target.value), className: 'input' })

  const handleSubmit = async (event) => {
    event.preventDefault()
    const formErrors = validateDonation(form)
    setErrors(formErrors)
    if (Object.keys(formErrors).length) {
      setServerError('Please fix the highlighted fields.')
      return
    }
    setIsSaving(true)
    setServerError('')
    try {
      const { data } = isEditing ? await updateDonation(donationId, toPayload(form)) : await createDonation(toPayload(form))
      navigate(`/donor/donations/${data.donation.id}/matches`, { state: { justCreated: !isEditing } })
    } catch (error) {
      setErrors(getFieldErrors(error))
      setServerError(getErrorMessage(error))
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) return <PageLoader />

  return (
    <div>
      <PageHeader title={isEditing ? 'Edit donation' : 'Donate surplus food'} subtitle="Accurate times help us find an NGO that can collect safely and in time." />
      <form onSubmit={handleSubmit} noValidate className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Alert type="error">{serverError}</Alert>

          <section className="card space-y-4">
            <h2 className="font-semibold">1. What food is it?</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2"><FormField id="food_name" label="Food name" error={errors.food_name} required><input placeholder="e.g. Vegetable biryani" {...bind('food_name')} /></FormField></div>
              <FormField id="category" label="Category" error={errors.category} required>
                <select {...bind('category')}>{Object.entries(FOOD_CATEGORIES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
              </FormField>
              <FormField id="dietary_type" label="Dietary type" error={errors.dietary_type} required>
                <select {...bind('dietary_type')}>{Object.entries(DIETARY_TYPES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
              </FormField>
              <div className="grid grid-cols-2 gap-2">
                <FormField id="quantity" label="Quantity" error={errors.quantity} required><input type="number" min="0" step="0.1" {...bind('quantity')} /></FormField>
                <FormField id="quantity_unit" label="Unit" error={errors.quantity_unit} required>
                  <select {...bind('quantity_unit')}>{QUANTITY_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}</select>
                </FormField>
              </div>
              <FormField id="servings" label="Number of servings" hint="Roughly how many people it can feed" error={errors.servings} required><input type="number" min="1" {...bind('servings')} /></FormField>
              <FormField id="allergens" label="Allergens" hint="e.g. nuts, dairy, gluten" error={errors.allergens}><input {...bind('allergens')} /></FormField>
              <FormField id="storage_type" label="Storage conditions" error={errors.storage_type} required>
                <select {...bind('storage_type')}>{Object.entries(STORAGE_TYPES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
              </FormField>
              <fieldset className="sm:col-span-2">
                <legend className="label">Packaging</legend>
                <div className="flex gap-4 text-sm">
                  <label className="flex items-center gap-2"><input type="radio" name="is_packaged" className="accent-brand-700" checked={form.is_packaged} onChange={() => set('is_packaged', true)} /> Packaged / sealed</label>
                  <label className="flex items-center gap-2"><input type="radio" name="is_packaged" className="accent-brand-700" checked={!form.is_packaged} onChange={() => set('is_packaged', false)} /> Unpackaged (in trays/vessels)</label>
                </div>
              </fieldset>
              <div className="sm:col-span-2"><FormField id="description" label="Description" error={errors.description}><textarea rows={2} {...bind('description')} /></FormField></div>
            </div>
          </section>

          <section className="card space-y-4">
            <h2 className="font-semibold">2. Times (your local time)</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField id="prepared_at" label="Prepared / available since" error={errors.prepared_at} required><input type="datetime-local" {...bind('prepared_at')} /></FormField>
              <FormField id="expires_at" label="Use-by / expiry time" error={errors.expires_at} required><input type="datetime-local" {...bind('expires_at')} /></FormField>
              <FormField id="pickup_deadline" label="Pickup deadline" hint="Latest time an NGO can collect" error={errors.pickup_deadline} required><input type="datetime-local" {...bind('pickup_deadline')} /></FormField>
            </div>
          </section>

          <section className="card space-y-4">
            <h2 className="font-semibold">3. Pickup location</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2"><FormField id="pickup_address" label="Pickup address" error={errors.pickup_address} required><input {...bind('pickup_address')} /></FormField></div>
              <FormField id="pickup_area" label="Area / locality" hint="Used for area-based matching" error={errors.pickup_area} required><input {...bind('pickup_area')} /></FormField>
              <FormField id="pickup_postal_code" label="Postal (PIN) code" error={errors.pickup_postal_code} required><input inputMode="numeric" {...bind('pickup_postal_code')} /></FormField>
              <div className="sm:col-span-2"><FormField id="notes" label="Notes for the NGO" error={errors.notes}><textarea rows={2} placeholder="e.g. Use the back gate, bring containers" {...bind('notes')} /></FormField></div>
            </div>
          </section>
        </div>

        {/* Safety panel */}
        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <section className="card space-y-3">
            <h2 className="flex items-center gap-2 font-semibold"><ShieldCheck className="h-5 w-5 text-brand-700" /> Food safety check</h2>
            {!safety ? <Spinner /> : (
              <>
                {Object.entries(safety.errors).filter(([field]) => field !== 'safety_declaration').map(([field, message]) => (
                  <p key={field} className="flex gap-2 text-sm text-red-700"><AlertTriangle className="h-4 w-4 shrink-0" />{message}</p>
                ))}
                {safety.warnings.map((warning) => (
                  <p key={warning} className="flex gap-2 text-sm text-amber-700"><AlertTriangle className="h-4 w-4 shrink-0" />{warning}</p>
                ))}
                {Object.keys(safety.errors).filter((f) => f !== 'safety_declaration').length === 0 && (
                  <p className="flex gap-2 text-sm text-brand-700"><CheckCircle2 className="h-4 w-4 shrink-0" />Times look valid for publishing.</p>
                )}
                <p className="text-xs text-gray-500">{safety.disclaimer}</p>
              </>
            )}
            <label className="flex items-start gap-2 rounded-lg bg-gray-50 p-3 text-sm">
              <input type="checkbox" className="mt-0.5 h-4 w-4 accent-brand-700" checked={form.safety_declaration} onChange={(e) => set('safety_declaration', e.target.checked)} />
              <span>I confirm the information is accurate, the food has been stored and handled hygienically, and I follow local food-safety regulations.</span>
            </label>
            {errors.safety_declaration && <p className="field-error">{errors.safety_declaration}</p>}
          </section>
          <button className="btn-primary w-full py-3" disabled={isSaving}>
            {isSaving ? <Spinner className="h-4 w-4 text-white" /> : <Save className="h-4 w-4" />}
            {isEditing ? 'Save changes' : 'Publish & find NGOs'}
          </button>
        </aside>
      </form>
    </div>
  )
}
