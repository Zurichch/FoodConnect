/**
 * ProfilePage.jsx - edit your basic account details and change your password.
 * PUT /api/profile and PUT /api/profile/password. Email and role cannot be changed.
 */
import { KeyRound, Save } from 'lucide-react'
import { useState } from 'react'
import { Alert, FormField, PageHeader, Spinner } from '../../components/ui'
import useAuth from '../../hooks/useAuth'
import { getErrorMessage, getFieldErrors } from '../../services/api'
import { changePassword, updateProfile } from '../../services/authService'
import { DONOR_TYPES } from '../../utils/constants'

export default function ProfilePage() {
  const { user, refreshUser } = useAuth()
  const [form, setForm] = useState({
    name: user.name || '', phone: user.phone || '', address: user.address || '', area: user.area || '',
    postal_code: user.postal_code || '', donor_type: user.donor_type || 'individual',
  })
  const [passwords, setPasswords] = useState({ current_password: '', new_password: '' })
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState({ type: '', text: '' })
  const [isSaving, setIsSaving] = useState(false)

  const bind = (field) => ({ id: field, className: 'input', value: form[field], onChange: (e) => setForm({ ...form, [field]: e.target.value }) })

  const saveProfile = async (event) => {
    event.preventDefault()
    setIsSaving(true)
    setErrors({})
    try {
      const { message: text } = await updateProfile(form)
      await refreshUser()
      setMessage({ type: 'success', text })
    } catch (error) {
      setErrors(getFieldErrors(error))
      setMessage({ type: 'error', text: getErrorMessage(error) })
    } finally {
      setIsSaving(false)
    }
  }

  const savePassword = async (event) => {
    event.preventDefault()
    setErrors({})
    try {
      const { message: text } = await changePassword(passwords)
      setPasswords({ current_password: '', new_password: '' })
      setMessage({ type: 'success', text })
    } catch (error) {
      setErrors(getFieldErrors(error))
      setMessage({ type: 'error', text: getErrorMessage(error) })
    }
  }

  return (
    <div className="max-w-3xl">
      <PageHeader title="Profile settings" subtitle={`${user.email} · ${user.role.toUpperCase()} account`} />
      {message.text && <div className="mb-4"><Alert type={message.type} onClose={() => setMessage({ type: '', text: '' })}>{message.text}</Alert></div>}

      <form onSubmit={saveProfile} className="card mb-6 space-y-4" noValidate>
        <h2 className="font-semibold">Account details</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="name" label="Name" error={errors.name} required><input {...bind('name')} /></FormField>
          <FormField id="phone" label="Phone" error={errors.phone} required><input {...bind('phone')} /></FormField>
          <FormField id="area" label="Area / locality" error={errors.area} required><input {...bind('area')} /></FormField>
          <FormField id="postal_code" label="Postal code" error={errors.postal_code} required><input {...bind('postal_code')} /></FormField>
          <div className="sm:col-span-2"><FormField id="address" label="Address" error={errors.address}><input {...bind('address')} /></FormField></div>
          {user.role === 'donor' && (
            <FormField id="donor_type" label="Donor type" error={errors.donor_type}>
              <select {...bind('donor_type')}>{Object.entries(DONOR_TYPES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            </FormField>
          )}
        </div>
        <button className="btn-primary" disabled={isSaving}>{isSaving ? <Spinner className="h-4 w-4 text-white" /> : <Save className="h-4 w-4" />} Save changes</button>
      </form>

      <form onSubmit={savePassword} className="card space-y-4" noValidate>
        <h2 className="font-semibold">Change password</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="current_password" label="Current password" error={errors.current_password} required>
            <input id="current_password" type="password" autoComplete="current-password" className="input" value={passwords.current_password} onChange={(e) => setPasswords({ ...passwords, current_password: e.target.value })} />
          </FormField>
          <FormField id="new_password" label="New password" error={errors.new_password} hint="8+ characters, letters and numbers" required>
            <input id="new_password" type="password" autoComplete="new-password" className="input" value={passwords.new_password} onChange={(e) => setPasswords({ ...passwords, new_password: e.target.value })} />
          </FormField>
        </div>
        <button className="btn-secondary"><KeyRound className="h-4 w-4" /> Update password</button>
      </form>
    </div>
  )
}
