import { Pencil, Trash2 } from 'lucide-react'
import type { User } from '../types/user'

interface UserTableProps {
  users: User[]
  startIndex: number  // (page - 1) * size — keeps numbering continuous across pages
  onView: (user: User) => void
  onEdit: (user: User) => void
  onDelete: (user: User) => void
}

const COLUMNS = ['#', 'Name', 'Email', 'Primary Mobile', 'Date of Birth', 'Place of Birth', 'Actions']

export default function UserTable({ users, startIndex, onView, onEdit, onDelete }: UserTableProps) {
  if (users.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <p className="text-lg font-medium">No users found</p>
        <p className="text-sm mt-1">Click "Add User" to create the first one</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {COLUMNS.map((col) => (
              <th
                key={col}
                className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-100">
          {users.map((user, index) => (
            <tr
              key={user.id}
              onClick={() => onView(user)}
              className="hover:bg-blue-50 cursor-pointer transition-colors"
            >
              <td className="px-6 py-4 text-sm text-gray-400 font-mono whitespace-nowrap">
                {startIndex + index + 1}
              </td>
              {/* Name — highlighted to hint it's clickable */}
              <td className="px-6 py-4 text-sm font-medium text-blue-700 whitespace-nowrap">
                {user.name}
              </td>
              <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">
                {user.email}
              </td>
              <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">
                {user.primary_mobile}
              </td>
              <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">
                {user.date_of_birth}
              </td>
              <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">
                {user.place_of_birth}
              </td>
              {/* Stop row click from firing when action buttons are clicked */}
              <td className="px-6 py-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onEdit(user)}
                    title="Edit user"
                    className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-md transition-colors"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => onDelete(user)}
                    title="Delete user"
                    className="p-1.5 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                  >
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
