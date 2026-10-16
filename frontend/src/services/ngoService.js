// ngoService.js - the NGO organisation profile and dashboard.
import api, { unwrap, unwrapWithMessage } from './api'

export const getNgoProfile = () => unwrap(api.get('/ngo/profile'))
export const updateNgoProfile = (form) => unwrapWithMessage(api.put('/ngo/profile', form))
export const getNgoDashboard = () => unwrap(api.get('/ngo/dashboard'))
