import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { X } from 'lucide-react'
import { userSchema, editUserSchema, type UserFormValues } from '../lib/validations'
import { useCreateUser, useUpdateUser } from '../hooks/useUsers'
import type { User, UpdateUserPayload } from '../types/user'

interface UserFormProps {
  user?: User   // provided → edit mode, absent → create mode
  onClose: () => void
}

interface FieldProps {
  label: string
  error?: string
  required?: boolean
  children: React.ReactNode
}

function Field({ label, error, required, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-gray-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}

const inputCls = (error?: string) =>
  `w-full px-3 py-2 text-sm border rounded-lg outline-none transition-colors ${
    error
      ? 'border-red-400 focus:border-red-500'
      : 'border-gray-300 focus:border-blue-500'
  }`

export default function UserForm({ user, onClose }: UserFormProps) {
  const isEdit = Boolean(user)
  const createUser = useCreateUser()
  const updateUser = useUpdateUser()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<UserFormValues>({
    resolver: zodResolver(isEdit ? editUserSchema : userSchema),
    defaultValues: isEdit && user
      ? {
          name: user.name,
          email: user.email,
          primary_mobile: user.primary_mobile,
          secondary_mobile: user.secondary_mobile ?? '',
          date_of_birth: user.date_of_birth,
          place_of_birth: user.place_of_birth,
          current_address: user.current_address,
          permanent_address: user.permanent_address,
          // PII fields intentionally blank — masked values can't be round-tripped
          aadhaar_number: '',
          pan_number: '',
        }
      : {},
  })

  // Reset form when the user prop changes (e.g. opening a different user's edit modal)
  useEffect(() => {
    reset()
  }, [user?.id, reset])

  const mutationError = isEdit ? updateUser.error : createUser.error
  const isPending = isEdit ? updateUser.isPending : createUser.isPending

  const onSubmit = async (values: UserFormValues) => {
    try {
      if (isEdit && user) {
        const payload: UpdateUserPayload = {
          name: values.name,
          email: values.email,
          primary_mobile: values.primary_mobile,
          date_of_birth: values.date_of_birth,
          place_of_birth: values.place_of_birth,
          current_address: values.current_address,
          permanent_address: values.permanent_address,
        }
        // Only send PII if user actually typed a new value — blank = keep existing
        if (values.secondary_mobile) payload.secondary_mobile = values.secondary_mobile
        if (values.aadhaar_number) payload.aadhaar_number = values.aadhaar_number
        if (values.pan_number) payload.pan_number = values.pan_number
        await updateUser.mutateAsync({ id: user.id, payload })
      } else {
        await createUser.mutateAsync({
          name: values.name!,
          email: values.email!,
          primary_mobile: values.primary_mobile!,
          secondary_mobile: values.secondary_mobile || undefined,
          aadhaar_number: values.aadhaar_number!,
          pan_number: values.pan_number!,
          date_of_birth: values.date_of_birth!,
          place_of_birth: values.place_of_birth!,
          current_address: values.current_address!,
          permanent_address: values.permanent_address!,
        })
      }
      onClose()
    } catch {
      // error displayed via mutationError below
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white z-10">
          <h2 className="text-lg font-semibold text-gray-900">
            {isEdit ? 'Edit User' : 'Add New User'}
          </h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-md">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="px-6 py-5 flex flex-col gap-4">
          {/* Row 1 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Full Name" error={errors.name?.message} required>
              <input {...register('name')} className={inputCls(errors.name?.message)} placeholder="Kohantika Nath" />
            </Field>
            <Field label="Email" error={errors.email?.message} required>
              <input {...register('email')} type="email" className={inputCls(errors.email?.message)} placeholder="kohantika@example.com" />
            </Field>
          </div>

          {/* Row 2 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Primary Mobile" error={errors.primary_mobile?.message} required>
              <input {...register('primary_mobile')} className={inputCls(errors.primary_mobile?.message)} placeholder="+919876543210" />
            </Field>
            <Field label="Secondary Mobile" error={errors.secondary_mobile?.message}>
              <input {...register('secondary_mobile')} className={inputCls(errors.secondary_mobile?.message)} placeholder="+919876543211 (optional)" />
            </Field>
          </div>

          {/* Row 3 — PII */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field
              label="Aadhaar Number"
              error={errors.aadhaar_number?.message}
              required={!isEdit}
            >
              <input
                {...register('aadhaar_number')}
                className={inputCls(errors.aadhaar_number?.message)}
                placeholder={isEdit ? 'Leave blank to keep current' : '123456789012'}
                maxLength={12}
              />
            </Field>
            <Field
              label="PAN Number"
              error={errors.pan_number?.message}
              required={!isEdit}
            >
              <input
                {...register('pan_number')}
                className={inputCls(errors.pan_number?.message)}
                placeholder={isEdit ? 'Leave blank to keep current' : 'ABCDE1234F'}
                maxLength={10}
              />
            </Field>
          </div>

          {/* Row 4 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Date of Birth" error={errors.date_of_birth?.message} required>
              <input {...register('date_of_birth')} type="date" className={inputCls(errors.date_of_birth?.message)} />
            </Field>
            <Field label="Place of Birth" error={errors.place_of_birth?.message} required>
              <input {...register('place_of_birth')} className={inputCls(errors.place_of_birth?.message)} placeholder="Mumbai" />
            </Field>
          </div>

          {/* Row 5 */}
          <Field label="Current Address" error={errors.current_address?.message} required>
            <textarea {...register('current_address')} rows={2} className={inputCls(errors.current_address?.message)} placeholder="123 Main St, Bangalore" />
          </Field>

          <Field label="Permanent Address" error={errors.permanent_address?.message} required>
            <textarea {...register('permanent_address')} rows={2} className={inputCls(errors.permanent_address?.message)} placeholder="456 Home St, Mumbai" />
          </Field>

          {/* API error */}
          {mutationError && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
              {mutationError.message}
            </p>
          )}

          {/* Footer */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || isSubmitting}
              className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
