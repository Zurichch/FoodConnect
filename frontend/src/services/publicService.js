// publicService.js - endpoints that work without logging in.
import api, { unwrap, unwrapWithMessage } from './api'

export const getPublicStats = () => unwrap(api.get('/public/stats'))
export const sendContactMessage = (form) => unwrapWithMessage(api.post('/public/contact', form))
export const getDonorAnalytics = () => unwrap(api.get('/analytics/donor'))
