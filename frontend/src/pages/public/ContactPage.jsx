// ContactPage.jsx - sends a message that is stored in the database (admins read it under Reports).
import { Mail, Send } from 'lucide-react'
import { useState } from 'react'
import { Alert, FormField, Spinner } from '../../components/ui'
import { getErrorMessage, getFieldErrors } from '../../services/api'
import { sendContactMessage } from '../../services/publicService'

const EMPTY = { name: '', email: '', subject: '', message: '' }

export default function ContactPage() {
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [status, setStatus] = useState({ type: '', text: '' })
  const [isSending, setIsSending] = useState(false)

  const update = (field) => (event) => setForm({ ...form, [field]: event.target.value })

  const handleSubmit = async (event) => {
    event.preventDefault()
    setIsSending(true)
    setErrors({})
    try {
      const { message } = await sendContactMessage(form)
      setStatus({ type: 'success', text: message })
      setForm(EMPTY)
    } catch (error) {
      setErrors(getFieldErrors(error))
      setStatus({ type: 'error', text: getErrorMessage(error) })
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-10 px-4 py-14 md:grid-cols-2">
      <div>
        <h1 className="text-4xl font-extrabold">Contact & support</h1>
        <p className="mt-4 text-gray-600">
          Questions about donating, registering an NGO or a problem with a donation? Send us a message and a
          FoodConnect administrator will read it in the admin dashboard.
        </p>
        <p className="mt-6 flex items-center gap-2 text-sm text-gray-600"><Mail className="h-4 w-4 text-brand-600" /> Messages are stored securely in the platform database.</p>
        <p className="mt-6 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
          Urgent food-safety concern? Do not distribute the food. Report the donation from its details page so administrators are notified.
        </p>
      </div>
      <form onSubmit={handleSubmit} className="card space-y-4" noValidate>
        {status.text && <Alert type={status.type}>{status.text}</Alert>}
        <FormField id="name" label="Your name" error={errors.name} required>
          <input id="name" className="input" value={form.name} onChange={update('name')} />
        </FormField>
        <FormField id="email" label="Email" error={errors.email} required>
          <input id="email" type="email" className="input" value={form.email} onChange={update('email')} />
        </FormField>
        <FormField id="subject" label="Subject" error={errors.subject} required>
          <input id="subject" className="input" value={form.subject} onChange={update('subject')} />
        </FormField>
        <FormField id="message" label="Message" error={errors.message} required>
          <textarea id="message" rows={5} className="input" value={form.message} onChange={update('message')} />
        </FormField>
        <button className="btn-primary w-full" disabled={isSending}>
          {isSending ? <Spinner className="h-4 w-4 text-white" /> : <Send className="h-4 w-4" />} Send message
        </button>
      </form>
    </div>
  )
}
