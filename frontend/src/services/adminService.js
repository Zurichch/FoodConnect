// adminService.js - administrator-only API calls (the backend checks the admin role).
import api, { unwrap, unwrapWithMessage } from './api'

export const getAdminDashboard = () => unwrap(api.get('/admin/dashboard'))
export const getAdminAnalytics = () => unwrap(api.get('/analytics/admin'))
export const getUsers = (params) => unwrap(api.get('/admin/users', { params }))
export const suspendUser = (id, reason) => unwrapWithMessage(api.post(`/admin/users/${id}/suspend`, { reason }))
export const reactivateUser = (id) => unwrapWithMessage(api.post(`/admin/users/${id}/reactivate`))
export const getNgos = (params) => unwrap(api.get('/admin/ngos', { params }))
export const verifyNgo = (id, note) => unwrapWithMessage(api.post(`/admin/ngos/${id}/verify`, { note }))
export const rejectNgo = (id, note) => unwrapWithMessage(api.post(`/admin/ngos/${id}/reject`, { note }))
export const getAllDonations = (params) => unwrap(api.get('/admin/donations', { params }))
export const moderateDonation = (id, reason) => unwrapWithMessage(api.post(`/admin/donations/${id}/reject`, { reason }))
export const getAllRequests = (params) => unwrap(api.get('/admin/requests', { params }))
export const getReports = (params) => unwrap(api.get('/admin/reports', { params }))
export const resolveReport = (id, body) => unwrapWithMessage(api.post(`/admin/reports/${id}/resolve`, body))
export const getContactMessages = (params) => unwrap(api.get('/admin/contact-messages', { params }))
export const getAuditLogs = (params) => unwrap(api.get('/admin/audit-logs', { params }))
