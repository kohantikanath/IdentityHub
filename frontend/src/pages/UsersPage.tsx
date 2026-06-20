import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, RefreshCw } from 'lucide-react'
import { useUsers, useUser } from '../hooks/useUsers'
import UserTable from '../components/UserTable'
import Pagination from '../components/Pagination'
import UserForm from '../components/UserForm'
import DeleteDialog from '../components/DeleteDialog'
import UserViewModal from '../components/UserViewModal'
import type { User } from '../types/user'

const PAGE_SIZE = 10

export default function UsersPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  // All modal + page state lives in the URL so refreshing restores the exact view
  const page    = Number(searchParams.get('page')   ?? '1')
  const viewId  = searchParams.get('view')   ?? ''
  const editId  = searchParams.get('edit')   ?? ''
  const isCreate = searchParams.get('create') === 'true'

  // Delete stays local — no reason to persist a confirmation dialog in the URL
  const [deleteUser, setDeleteUser] = useState<User | null>(null)

  // Fetch the user being edited so UserForm can pre-fill from the URL directly
  const { data: editingUser } = useUser(editId)

  const { data, isLoading, isError, error, refetch, isFetching } = useUsers(page, PAGE_SIZE)

  // ── Navigation helpers ──────────────────────────────────────────────────────
  const openView   = (id: string) => setSearchParams({ page: String(page), view: id })
  const openEdit   = (id: string) => setSearchParams({ page: String(page), edit: id })
  const openCreate = ()           => setSearchParams({ page: String(page), create: 'true' })
  const closeModal = ()           => setSearchParams({ page: String(page) })
  const backToView = (id: string) => setSearchParams({ page: String(page), view: id })
  const goToPage   = (p: number)  => setSearchParams({ page: String(p) })

  // ── Fix: derive startIndex from data.page so serial numbers only change
  //    when the row data changes, not immediately when the user clicks Next ──
  const startIndex = ((data?.page ?? 1) - 1) * (data?.size ?? PAGE_SIZE)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">IdentityHub</h1>
            <p className="text-sm text-gray-500 mt-0.5">Manage user identities securely</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              title="Force a fresh fetch from the server"
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              <RefreshCw size={15} className={isFetching ? 'animate-spin' : ''} />
              Refresh
            </button>
            <button
              onClick={openCreate}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus size={15} />
              Add User
            </button>
          </div>
        </div>

        {/* Table card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          {isLoading ? (
            <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
              Loading users…
            </div>
          ) : isError ? (
            <div className="flex items-center justify-center h-48 text-red-500 text-sm">
              {error?.message ?? 'Failed to load users'}
            </div>
          ) : (
            <>
              <UserTable
                users={data?.items ?? []}
                startIndex={startIndex}
                onView={(user) => openView(user.id)}
                onEdit={(user) => openEdit(user.id)}
                onDelete={(user) => setDeleteUser(user)}
              />
              {data && data.total > 0 && (
                <Pagination
                  page={page}
                  totalPages={data.pages}
                  total={data.total}
                  size={PAGE_SIZE}
                  onPageChange={goToPage}
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* View modal — ?view={id} */}
      {viewId && (
        <UserViewModal
          id={viewId}
          onClose={closeModal}
          onEdit={(id) => openEdit(id)}
        />
      )}

      {/* Create modal — ?create=true */}
      {isCreate && (
        <UserForm onClose={closeModal} />
      )}

      {/* Edit modal — ?edit={id} — waits for user data before rendering form */}
      {editId && editingUser && (
        <UserForm
          user={editingUser}
          onClose={closeModal}
          onSaved={() => backToView(editId)}
        />
      )}

      {/* Delete confirmation — local state, no URL needed */}
      {deleteUser && (
        <DeleteDialog user={deleteUser} onClose={() => setDeleteUser(null)} />
      )}
    </div>
  )
}
