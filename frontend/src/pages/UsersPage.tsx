import { useState } from 'react'
import { Plus, RefreshCw } from 'lucide-react'
import { useUsers } from '../hooks/useUsers'
import UserTable from '../components/UserTable'
import Pagination from '../components/Pagination'
import type { User } from '../types/user'

const PAGE_SIZE = 10

export default function UsersPage() {
  const [page, setPage] = useState(1)

  const { data, isLoading, isError, error, refetch, isFetching } = useUsers(page, PAGE_SIZE)

  // Placeholders — will be replaced with modal state in Commits 13 and 14
  const handleEdit = (_user: User) => {}
  const handleDelete = (_user: User) => {}

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
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              <RefreshCw size={15} className={isFetching ? 'animate-spin' : ''} />
              Refresh
            </button>
            <button
              onClick={() => {}}
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
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
              {data && data.total > 0 && (
                <Pagination
                  page={page}
                  totalPages={data.pages}
                  total={data.total}
                  size={PAGE_SIZE}
                  onPageChange={(p) => setPage(p)}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
