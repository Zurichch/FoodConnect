// requestService.js - collection requests between NGOs and donors.
import api, { unwrap, unwrapWithMessage } from './api'

export const getIncomingRequests = (params) => unwrap(api.get('/requests/incoming', { params }))
export const getSentRequests = (params) => unwrap(api.get('/requests/sent', { params }))
export const acceptRequest = (id, note) => unwrapWithMessage(api.post(`/requests/${id}/accept`, { note }))
export const rejectRequest = (id, note) => unwrapWithMessage(api.post(`/requests/${id}/reject`, { note }))
export const withdrawRequest = (id) => unwrapWithMessage(api.post(`/requests/${id}/withdraw`))
