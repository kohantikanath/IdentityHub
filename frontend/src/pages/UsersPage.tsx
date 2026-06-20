import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, RefreshCw } from 'lucide-react'
import { useUsers, useUser } from '../hooks/useUsers'
import UserTable from '../components/UserTable'
import Pagination from '../components/Pagination'
import UserForm from '../components/UserForm'
import DeleteDialog from '../components/DeleteDialog'
import UserViewModal from '../components/UserViewModal'

const PAGE_SIZE = 10

export default function UsersPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  const page     = Number(searchParams.get('page')   ?? '1')
  const viewId   = searchParams.get('view')   ?? ''
  const editId   = searchParams.get('edit')   ?? ''
  const isCreate = searchParams.get('create') === 'true'

  // Two separate local states for modals that don't need URL persistence
  const [deleteId, setDeleteId]           = useState<string | null>(null)
  const [deleteReviewId, setDeleteReviewId] = useState<string | null>(null)

  const { data: editingUser } = useUser(editId)
  const { data, isLoading, isError, error, refetch, isFetching } = useUsers(page, PAGE_SIZE)

  // ── Navigation helpers ──────────────────────────────────────────────────────
  const openView   = (id: string) => setSearchParams({ page: String(page), view: id })
  const openEdit   = (id: string) => setSearchParams({ page: String(page), edit: id })
  const openCreate = ()           => setSearchParams({ page: String(page), create: 'true' })
  const closeModal = ()           => setSearchParams({ page: String(page) })
  const backToView = (id: string) => setSearchParams({ page: String(page), view: id })
  const goToPage   = (p: number)  => setSearchParams({ page: String(p) })

  // Trash icon → open delete-review modal (local state, no Edit button shown)
  const handleTableDelete = (id: string) => setDeleteReviewId(id)

  // Delete from delete-review modal → close review, open confirmation
  const handleReviewDelete = (id: string) => { setDeleteReviewId(null); setDeleteId(id) }

  // Delete from row-click view modal → close URL modal, open confirmation
  const handleViewDelete = (id: string) => { closeModal(); setDeleteId(id) }

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
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 relative">

          {isFetching && !isLoading && (
            <div className="absolute top-0 left-0 right-0 h-0.5 z-10 overflow-hidden rounded-t-xl bg-blue-100">
              <div className="h-full bg-blue-500" style={{ animation: 'loadbar 1.2s ease-in-out infinite' }} />
            </div>
          )}

          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3 text-gray-400 text-sm">
              <svg className="animate-spin h-6 w-6 text-blue-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              Loading users…
            </div>
          ) : isError ? (
            <div className="flex items-center justify-center h-48 text-red-500 text-sm">
              {error?.message ?? 'Failed to load users'}
            </div>
          ) : (
            <div className={isFetching ? 'opacity-50 pointer-events-none transition-opacity duration-200' : 'transition-opacity duration-200'}>
              <UserTable
                users={data?.items ?? []}
                startIndex={startIndex}
                onView={(user) => openView(user.id)}
                onEdit={(user) => openEdit(user.id)}
                onDelete={(user) => handleTableDelete(user.id)}
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
            </div>
          )}
        </div>
      </div>

      {/* Row-click view modal — Edit User only, no Delete */}
      {viewId && (
        <UserViewModal
          id={viewId}
          onClose={closeModal}
          onEdit={(id) => openEdit(id)}
        />
      )}

      {/* Trash-click review modal — shows only Delete + Close, no Edit */}
      {deleteReviewId && (
        <UserViewModal
          id={deleteReviewId}
          onClose={() => setDeleteReviewId(null)}
          onDelete={handleReviewDelete}
        />
      )}

      {/* Create modal */}
      {isCreate && (
        <UserForm onClose={closeModal} />
      )}

      {/* Edit modal */}
      {editId && editingUser && (
        <UserForm
          user={editingUser}
          onClose={closeModal}
          onSaved={() => backToView(editId)}
        />
      )}

      {/* Delete confirmation — appears after reviewing user in view modal */}
      {deleteId && (
        <DeleteDialog id={deleteId} onClose={() => setDeleteId(null)} />
      )}
    </div>
  )
}
