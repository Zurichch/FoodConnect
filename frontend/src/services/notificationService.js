// notificationService.js - in-app notifications (created by backend events).
import api, { unwrap } from './api'

export const getNotifications = (params) => unwrap(api.get('/notifications', { params }))
export const getUnreadCount = () => unwrap(api.get('/notifications/unread-count'))
export const markRead = (id) => unwrap(api.post(`/notifications/${id}/read`))
export const markAllRead = () => unwrap(api.post('/notifications/read-all'))
