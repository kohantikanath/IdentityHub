import { X } from 'lucide-react'
import { useUser } from '../hooks/useUsers'

interface UserViewModalProps {
  id: string
  onClose: () => void
  onEdit: (id: string) => void
}

interface FieldProps {
  label: string
  value: string | null | undefined
}

function Field({ label, value }: FieldProps) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{label}</span>
      <span className="text-sm text-gray-800">{value || '—'}</span>
    </div>
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function UserViewModal({ id, onClose, onEdit }: UserViewModalProps) {
  // Fetch fresh data by ID — automatically gets the latest values after an edit
  // because useUpdateUser invalidates [USERS_QUERY_KEY] which prefix-matches this key
  const { data: user, isLoading } = useUser(id)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {isLoading ? 'Loading…' : user?.name}
          </h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-md">
            <X size={20} />
          </button>
        </div>

        {isLoading || !user ? (
          <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
            Loading user details…
          </div>
        ) : (
          <>
            <div className="px-6 py-5 flex flex-col gap-5">

              {/* Contact */}
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Contact</p>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Email" value={user.email} />
                  <Field label="Primary Mobile" value={user.primary_mobile} />
                  <Field label="Secondary Mobile" value={user.secondary_mobile} />
                </div>
              </div>

              <hr className="border-gray-100" />

              {/* Identity */}
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Identity</p>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Aadhaar" value={user.aadhaar_number} />
                  <Field label="PAN" value={user.pan_number} />
                </div>
              </div>

              <hr className="border-gray-100" />

              {/* Personal */}
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Personal</p>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Date of Birth" value={user.date_of_birth} />
                  <Field label="Place of Birth" value={user.place_of_birth} />
                  <div className="col-span-2">
                    <Field label="Current Address" value={user.current_address} />
                  </div>
                  <div className="col-span-2">
                    <Field label="Permanent Address" value={user.permanent_address} />
                  </div>
                </div>
              </div>

              <hr className="border-gray-100" />

              {/* Audit */}
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Audit</p>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Created At" value={formatDate(user.created_at)} />
                  <Field label="Last Updated" value={formatDate(user.updated_at)} />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Close
              </button>
              <button
                onClick={() => onEdit(id)}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
              >
                Edit User
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
