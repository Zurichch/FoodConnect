// authService.js - login, registration, logout and profile API calls.
import api, { unwrap, unwrapWithMessage } from './api'

export const login = (email, password) => unwrapWithMessage(api.post('/auth/login', { email, password }))
export const register = (form) => unwrapWithMessage(api.post('/auth/register', form))
export const logout = () => api.post('/auth/logout')
export const getMe = () => unwrap(api.get('/auth/me'))

export const updateProfile = (form) => unwrapWithMessage(api.put('/profile', form))
export const changePassword = (form) => unwrapWithMessage(api.put('/profile/password', form))
