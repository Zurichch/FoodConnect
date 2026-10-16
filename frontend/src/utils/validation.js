// validation.js - Quick checks in the browser so users get instant feedback.
// The backend ALWAYS validates again; these checks are only for convenience.

export function validateLogin(form) {
  const errors = {}
  if (!form.email) errors.email = 'Email is required.'
  if (!form.password) errors.password = 'Password is required.'
  return errors
}

export function validateRegistration(form) {
  const errors = {}
  if (!form.name?.trim()) errors.name = 'Name is required.'
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email || '')) errors.email = 'Enter a valid email address.'
  if (!form.password || form.password.length < 8 || !/[A-Za-z]/.test(form.password) || !/\d/.test(form.password)) {
    errors.password = 'At least 8 characters with letters and numbers.'
  }
  if (form.password !== form.confirm_password) errors.confirm_password = 'Passwords do not match.'
  if (!form.phone?.trim()) errors.phone = 'Phone number is required.'
  if (!form.area?.trim()) errors.area = 'Area is required.'
  if (!form.postal_code?.trim()) errors.postal_code = 'Postal code is required.'
  if (form.role === 'ngo') {
    if (!form.organization_name?.trim()) errors.organization_name = 'Organisation name is required.'
    if (!form.service_areas?.trim()) errors.service_areas = 'Enter at least one service area.'
    if (!(Number(form.max_capacity_servings) >= 1)) errors.max_capacity_servings = 'Capacity must be at least 1 serving.'
  }
  return errors
}

export function validateDonation(form) {
  const errors = {}
  const required = ['food_name', 'category', 'quantity', 'quantity_unit', 'servings', 'dietary_type', 'storage_type',
    'prepared_at', 'expires_at', 'pickup_deadline', 'pickup_address', 'pickup_area', 'pickup_postal_code']
  required.forEach((field) => {
    if (form[field] === '' || form[field] === null || form[field] === undefined) errors[field] = 'This field is required.'
  })
  if (form.servings !== '' && !(Number(form.servings) >= 1)) errors.servings = 'Must be at least 1.'
  if (form.quantity !== '' && !(Number(form.quantity) > 0)) errors.quantity = 'Must be more than 0.'
  const expires = new Date(form.expires_at)
  const deadline = new Date(form.pickup_deadline)
  if (form.expires_at && expires <= new Date()) errors.expires_at = 'This food is already past its use-by time.'
  if (form.expires_at && form.pickup_deadline && deadline > expires) {
    errors.pickup_deadline = 'Pickup deadline must be before the use-by time.'
  }
  if (!form.safety_declaration) errors.safety_declaration = 'Please confirm the declaration.'
  return errors
}
