import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, RefreshCw } from 'lucide-react'
import { useUsers, useUser } from '../hooks/useUsers'
import UserTable from '../components/UserTable'
import Pagination from '../components/Pagination'
import UserForm from '../components/UserForm'
import DeleteDialog from '../components/DeleteDialog'
import UserViewModal from '../components/UserViewModal'
import SearchFilterBar from '../components/SearchFilterBar'

const PAGE_SIZE = 10

export default function UsersPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  const page      = Number(searchParams.get('page')    ?? '1')
  const viewId    = searchParams.get('view')    ?? ''
  const editId    = searchParams.get('edit')    ?? ''
  const isCreate  = searchParams.get('create') === 'true'
  const search    = searchParams.get('search')  ?? ''
  const place     = searchParams.get('place')   ?? ''
  const dobFrom   = searchParams.get('dob_from') ?? ''
  const dobTo     = searchParams.get('dob_to')   ?? ''
  const sortBy    = searchParams.get('sort')     ?? 'created_at'
  const sortOrder = (searchParams.get('order')   ?? 'desc') as 'asc' | 'desc'

  const [deleteId, setDeleteId]             = useState<string | null>(null)
  const [deleteReviewId, setDeleteReviewId] = useState<string | null>(null)

  const { data: editingUser } = useUser(editId)
  const { data, isLoading, isError, error, refetch, isFetching } = useUsers(page, PAGE_SIZE, {
    search:         search  || undefined,
    place_of_birth: place   || undefined,
    dob_year_from:  dobFrom ? Number(dobFrom) : undefined,
    dob_year_to:    dobTo   ? Number(dobTo)   : undefined,
    sort_by:        sortBy,
    sort_order:     sortOrder,
  })

  const update = (changes: Record<string, string | undefined>) =>
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      Object.entries(changes).forEach(([k, v]) => { if (v) next.set(k, v); else next.delete(k) })
      return next
    })

  const openView   = (id: string) => update({ view: id, edit: undefined, create: undefined })
  const openEdit   = (id: string) => update({ edit: id, view: undefined, create: undefined })
  const openCreate = ()           => update({ create: 'true', view: undefined, edit: undefined })
  const closeModal = ()           => update({ view: undefined, edit: undefined, create: undefined })
  const backToView = (id: string) => update({ view: id, edit: undefined })
  const goToPage   = (p: number)  => update({ page: String(p) })

  const handleSearch = (val: string) =>
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (val) next.set('search', val); else next.delete('search')
      next.set('page', '1')
      return next
    })

  const handleFilter = (newPlace: string, newDobFrom: string, newDobTo: string) =>
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.delete('place'); next.delete('dob_from'); next.delete('dob_to')
      if (newPlace)   next.set('place',    newPlace)
      if (newDobFrom) next.set('dob_from', newDobFrom)
      if (newDobTo)   next.set('dob_to',   newDobTo)
      next.set('page', '1')
      return next
    })

  const handleNameSort = (order: 'asc' | 'desc' | '') =>
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (!order) { next.delete('sort'); next.delete('order') }
      else { next.set('sort', 'name'); next.set('order', order) }
      next.set('page', '1')
      return next
    })

  const handleSort = (column: string) => {
    const newOrder = sortBy === column && sortOrder === 'desc' ? 'asc' : 'desc'
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('sort', column); next.set('order', newOrder); next.set('page', '1')
      return next
    })
  }

  const handleTableDelete  = (id: string) => setDeleteReviewId(id)
  const handleReviewDelete = (id: string) => { setDeleteReviewId(null); setDeleteId(id) }

  const startIndex = ((data?.page ?? 1) - 1) * (data?.size ?? PAGE_SIZE)
  const nameSort = sortBy === 'name' ? sortOrder : ''

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
              onClick={() => refetch()} disabled={isFetching}
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              <RefreshCw size={15} className={isFetching ? 'animate-spin' : ''} />
              Refresh
            </button>
            <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
              <Plus size={15} />
              Add User
            </button>
          </div>
        </div>

        {/* Search + Filters (A→Z / Z→A inside the dropdown) */}
        <div className="mb-4">
          <SearchFilterBar
            search={search} place={place} dobFrom={dobFrom} dobTo={dobTo}
            nameSort={nameSort as 'asc' | 'desc' | ''}
            onSearch={handleSearch} onFilter={handleFilter} onNameSort={handleNameSort}
          />
        </div>

        {/* Table */}
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
                sortConfig={{ by: sortBy, order: sortOrder }}
                onSort={handleSort}
                onView={(user) => openView(user.id)}
                onEdit={(user) => openEdit(user.id)}
                onDelete={(user) => handleTableDelete(user.id)}
              />
              {data && data.total > 0 && (
                <Pagination page={page} totalPages={data.pages} total={data.total} size={PAGE_SIZE} onPageChange={goToPage} />
              )}
            </div>
          )}
        </div>
      </div>

      {viewId && <UserViewModal id={viewId} onClose={closeModal} onEdit={(id) => openEdit(id)} />}
      {deleteReviewId && <UserViewModal id={deleteReviewId} onClose={() => setDeleteReviewId(null)} onDelete={handleReviewDelete} />}
      {isCreate && <UserForm onClose={closeModal} />}
      {editId && editingUser && <UserForm user={editingUser} onClose={closeModal} onSaved={() => backToView(editId)} />}
      {deleteId && <DeleteDialog id={deleteId} onClose={() => setDeleteId(null)} />}
    </div>
  )
}
