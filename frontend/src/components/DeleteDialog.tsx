import { Trash2 } from 'lucide-react'
import { useDeleteUser } from '../hooks/useUsers'
import type { User } from '../types/user'

interface DeleteDialogProps {
  user: User
  onClose: () => void
}

export default function DeleteDialog({ user, onClose }: DeleteDialogProps) {
  const deleteUser = useDeleteUser()

  const handleConfirm = async () => {
    try {
      await deleteUser.mutateAsync(user.id)
      onClose()
    } catch {
      // error displayed inline below
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Dialog */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="p-6">
          {/* Icon + title */}
          <div className="flex items-center gap-4 mb-4">
            <div className="flex-shrink-0 w-11 h-11 bg-red-100 rounded-full flex items-center justify-center">
              <Trash2 size={20} className="text-red-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Delete User</h2>
              <p className="text-sm text-gray-500">This will hide the user from all views</p>
            </div>
          </div>

          <p className="text-sm text-gray-700 mb-6">
            Are you sure you want to delete{' '}
            <span className="font-semibold text-gray-900">{user.name}</span>?{' '}
            The record is soft-deleted and can be recovered from the database if needed.
          </p>

          {deleteUser.error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg mb-4">
              {deleteUser.error.message}
            </p>
          )}

          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              disabled={deleteUser.isPending}
              className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={deleteUser.isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
            >
              {deleteUser.isPending ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
