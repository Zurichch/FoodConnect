/**
 * NotificationsPage.jsx - in-app notifications created by backend events
 * (new request, request accepted, pickup scheduled, collected, delivered, expired ...).
 */
import { Bell, CheckCheck } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Alert, EmptyState, PageHeader, PageLoader, Pagination, Tabs } from '../../components/ui'
import useApi from '../../hooks/useApi'
import { getNotifications, markAllRead, markRead } from '../../services/notificationService'
import { formatDateTime, relativeTime } from '../../utils/format'

export default function NotificationsPage() {
  const [page, setPage] = useState(1)
  const [filter, setFilter] = useState('all')
  const { data, isLoading, error, reload } = useApi(
    () => getNotifications({ page, per_page: 15, unread: filter === 'unread' ? 'true' : undefined }),
    [page, filter],
    { pollMs: 20000 },
  )

  const handleMarkAll = async () => {
    await markAllRead()
    reload({ silent: true })
  }

  const handleOpen = async (notification) => {
    if (!notification.is_read) await markRead(notification.id).catch(() => {})
  }

  return (
    <div>
      <PageHeader title="Notifications" subtitle="Updates generated automatically when something happens to your donations or requests."
        actions={<button className="btn-secondary" onClick={handleMarkAll}><CheckCheck className="h-4 w-4" /> Mark all as read</button>} />
      <Tabs tabs={[{ value: 'all', label: 'All' }, { value: 'unread', label: 'Unread' }]} active={filter} onChange={(v) => { setFilter(v); setPage(1) }} />
      {isLoading ? <PageLoader /> : error ? <Alert type="error">{error}</Alert> : data.items.length === 0 ? (
        <EmptyState icon={Bell} title="No notifications" message="You're all caught up." />
      ) : (
        <ul className="card divide-y divide-gray-100 p-0">
          {data.items.map((n) => (
            <li key={n.id} className={`flex gap-3 p-4 ${n.is_read ? '' : 'bg-brand-50/60'}`}>
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.is_read ? 'bg-transparent' : 'bg-brand-600'}`} aria-label={n.is_read ? 'Read' : 'Unread'} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-900">{n.title}</p>
                <p className="text-sm text-gray-600">{n.message}</p>
                <p className="mt-1 text-xs text-gray-400" title={formatDateTime(n.created_at)}>{relativeTime(n.created_at)}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                {n.donation_id && <Link to={`/donations/${n.donation_id}`} onClick={() => handleOpen(n)} className="text-sm font-semibold text-brand-700 hover:underline">View</Link>}
                {!n.is_read && <button className="text-xs text-gray-500 hover:text-gray-800" onClick={async () => { await markRead(n.id); reload({ silent: true }) }}>Mark read</button>}
              </div>
            </li>
          ))}
        </ul>
      )}
      {data && <Pagination page={data.page} pages={data.pages} onChange={setPage} />}
    </div>
  )
}
