// donationService.js - everything about donations, matching and tracking.
import api, { unwrap, unwrapWithMessage } from './api'

// Donor
export const createDonation = (form) => unwrapWithMessage(api.post('/donations', form))
export const updateDonation = (id, form) => unwrapWithMessage(api.put(`/donations/${id}`, form))
export const previewSafetyCheck = (form) => unwrap(api.post('/donations/safety-check', form))
export const getMyDonations = (params) => unwrap(api.get('/donations/mine', { params }))
export const cancelDonation = (id, reason) => unwrapWithMessage(api.post(`/donations/${id}/cancel`, { reason }))
export const getMatches = (id) => unwrap(api.get(`/donations/${id}/matches`))
export const offerToNgo = (id, ngoId, message) => unwrapWithMessage(api.post(`/donations/${id}/offer`, { ngo_id: ngoId, message }))

// NGO
export const getAvailableDonations = (params) => unwrap(api.get('/donations/available', { params }))
export const getRecommendedDonations = () => unwrap(api.get('/donations/recommended'))
export const getCollections = (params) => unwrap(api.get('/donations/collections', { params }))
export const requestDonation = (id, message) => unwrapWithMessage(api.post(`/donations/${id}/requests`, { message }))
export const updateStatus = (id, body) => unwrapWithMessage(api.post(`/donations/${id}/status`, body))

// Shared
export const getDonation = (id) => unwrap(api.get(`/donations/${id}`))
export const reportDonation = (id, reason) => unwrapWithMessage(api.post(`/donations/${id}/report`, { reason }))
