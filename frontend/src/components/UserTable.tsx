import { ChevronDown, ChevronUp, ChevronsUpDown, Pencil, Trash2 } from 'lucide-react'
import type { User } from '../types/user'

interface SortConfig { by: string; order: 'asc' | 'desc' }

interface UserTableProps {
  users: User[]
  startIndex: number
  sortConfig: SortConfig
  onSort: (column: string) => void
  onView: (user: User) => void
  onEdit: (user: User) => void
  onDelete: (user: User) => void
}

const SORTABLE: Record<string, string> = {
  'Name': 'name',
  'Date of Birth': 'date_of_birth',
}

function SortIcon({ column, sortConfig }: { column: string; sortConfig: SortConfig }) {
  if (sortConfig.by !== column) return <ChevronsUpDown size={13} className="text-gray-300 ml-1 inline" />
  return sortConfig.order === 'asc'
    ? <ChevronUp size={13} className="text-blue-500 ml-1 inline" />
    : <ChevronDown size={13} className="text-blue-500 ml-1 inline" />
}

export default function UserTable({ users, startIndex, sortConfig, onSort, onView, onEdit, onDelete }: UserTableProps) {
  if (users.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <p className="text-lg font-medium">No users found</p>
        <p className="text-sm mt-1">Try adjusting your search or filters</p>
      </div>
    )
  }

  const COLUMNS = ['#', 'Name', 'Email', 'Primary Mobile', 'Date of Birth', 'Place of Birth', 'Actions']

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {COLUMNS.map((col) => (
              <th
                key={col}
                onClick={() => SORTABLE[col] && onSort(SORTABLE[col])}
                className={`px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider ${
                  SORTABLE[col] ? 'cursor-pointer hover:text-gray-700 select-none' : ''
                }`}
              >
                {col}
                {SORTABLE[col] && <SortIcon column={SORTABLE[col]} sortConfig={sortConfig} />}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-100">
          {users.map((user, index) => (
            <tr key={user.id} onClick={() => onView(user)} className="hover:bg-blue-50 cursor-pointer transition-colors">
              <td className="px-6 py-4 text-sm text-gray-400 font-mono whitespace-nowrap">{startIndex + index + 1}</td>
              <td className="px-6 py-4 text-sm font-medium text-blue-700 whitespace-nowrap">{user.name}</td>
              <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">{user.email}</td>
              <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">{user.primary_mobile}</td>
              <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">{user.date_of_birth}</td>
              <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">{user.place_of_birth}</td>
              <td className="px-6 py-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-2">
                  <button onClick={() => onEdit(user)} title="Edit" className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-md transition-colors">
                    <Pencil size={15} />
                  </button>
                  <button onClick={() => onDelete(user)} title="Delete" className="p-1.5 text-red-600 hover:bg-red-50 rounded-md transition-colors">
                    <Trash2 size={15} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
