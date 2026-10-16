/**
 * UserManagementPage.jsx - list, search, suspend and reactivate users.
 * Suspension is enforced by the backend on every request (the user's old token stops working).
 */
import { Search, UserCheck, UserX } from 'lucide-react'
import { useState } from 'react'
import ConfirmDialog from '../../components/ConfirmDialog'
import { Alert, EmptyState, PageHeader, PageLoader, Pagination, Toast } from '../../components/ui'
import useApi from '../../hooks/useApi'
import useToast from '../../hooks/useToast'
import { reactivateUser, suspendUser, getUsers } from '../../services/adminService'
import { getErrorMessage } from '../../services/api'
import { formatDate } from '../../utils/format'

const ROLE_COLORS = { admin: 'bg-gray-800 text-white', donor: 'bg-brand-100 text-brand-800', ngo: 'bg-sky-100 text-sky-800' }

export default function UserManagementPage() {
  const [filters, setFilters] = useState({ role: '', status: '', search: '' })
  const [searchInput, setSearchInput] = useState('')
  const [page, setPage] = useState(1)
  const [dialog, setDialog] = useState(null)
  const { toast, showToast } = useToast()
  const { data, isLoading, error, reload } = useApi(
    () => getUsers({ ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)), page, per_page: 12 }),
    [JSON.stringify(filters), page],
  )

  const handleConfirm = async ({ text }) => {
    try {
      const result = dialog.type === 'suspend' ? await suspendUser(dialog.user.id, text) : await reactivateUser(dialog.user.id)
      showToast(result.message)
      setDialog(null)
      reload({ silent: true })
    } catch (err) {
      showToast(getErrorMessage(err), 'error')
    }
  }

  return (
    <div>
      <Toast toast={toast} />
      <PageHeader title="User management" subtitle="All registered donors, NGOs and administrators." />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <form className="relative flex-1" onSubmit={(e) => { e.preventDefault(); setPage(1); setFilters({ ...filters, search: searchInput }) }}>
          <label htmlFor="user-search" className="sr-only">Search users</label>
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <input id="user-search" className="input pl-9" placeholder="Search name or email and press Enter" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
        </form>
        <select aria-label="Role" className="input sm:w-40" value={filters.role} onChange={(e) => { setPage(1); setFilters({ ...filters, role: e.target.value }) }}>
          <option value="">All roles</option><option value="donor">Donors</option><option value="ngo">NGOs</option><option value="admin">Admins</option>
        </select>
        <select aria-label="Account status" className="input sm:w-40" value={filters.status} onChange={(e) => { setPage(1); setFilters({ ...filters, status: e.target.value }) }}>
          <option value="">Any status</option><option value="active">Active</option><option value="suspended">Suspended</option>
        </select>
      </div>

      {isLoading ? <PageLoader /> : error ? <Alert type="error">{error}</Alert> : data.items.length === 0 ? <EmptyState title="No users found" /> : (
        <div className="card overflow-x-auto p-0">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50"><tr><th className="table-head">User</th><th className="table-head">Role</th><th className="table-head">Area</th><th className="table-head">Joined</th><th className="table-head">Status</th><th className="table-head">Action</th></tr></thead>
            <tbody className="divide-y divide-gray-100">
              {data.items.map((user) => (
                <tr key={user.id}>
                  <td className="table-cell"><p className="font-medium text-gray-900">{user.name}</p><p className="text-xs text-gray-500">{user.email}</p></td>
                  <td className="table-cell"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold uppercase ${ROLE_COLORS[user.role]}`}>{user.role}</span></td>
                  <td className="table-cell">{user.area} {user.postal_code}</td>
                  <td className="table-cell">{formatDate(user.created_at)}</td>
                  <td className="table-cell">
                    {user.is_suspended ? <span className="text-red-600" title={user.suspension_reason}>Suspended</span> : <span className="text-brand-700">Active</span>}
                  </td>
                  <td className="table-cell">
                    {user.role === 'admin' ? <span className="text-xs text-gray-400">-</span> : user.is_suspended ? (
                      <button className="btn-secondary px-3 py-1" onClick={() => setDialog({ type: 'reactivate', user })}><UserCheck className="h-4 w-4" /> Reactivate</button>
                    ) : (
                      <button className="btn-danger px-3 py-1" onClick={() => setDialog({ type: 'suspend', user })}><UserX className="h-4 w-4" /> Suspend</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && <Pagination page={data.page} pages={data.pages} onChange={setPage} />}

      <ConfirmDialog open={Boolean(dialog)}
        title={dialog?.type === 'suspend' ? `Suspend ${dialog?.user.name}?` : `Reactivate ${dialog?.user.name}?`}
        message={dialog?.type === 'suspend' ? 'They will be logged out and blocked from all actions. This is recorded in the audit log.' : 'They will be able to log in again.'}
        textLabel={dialog?.type === 'suspend' ? 'Reason' : undefined} textRequired={dialog?.type === 'suspend'}
        confirmLabel={dialog?.type === 'suspend' ? 'Suspend' : 'Reactivate'} tone={dialog?.type === 'suspend' ? 'danger' : 'primary'}
        onConfirm={handleConfirm} onCancel={() => setDialog(null)} />
    </div>
  )
}
