import { z } from 'zod'

const mobileRegex = /^\+?[1-9]\d{9,14}$/
const aadhaarRegex = /^\d{12}$/
const panRegex = /^[A-Za-z]{5}[0-9]{4}[A-Za-z]{1}$/

export const userSchema = z.object({
  name: z.string().min(1, { message: 'Name is required' }).trim(),

  email: z.email({ error: 'Enter a valid email address' }),

  primary_mobile: z
    .string()
    .min(1, { message: 'Primary mobile is required' })
    .regex(mobileRegex, { message: 'Must be 10–15 digits, optionally starting with +' }),

  secondary_mobile: z
    .string()
    .regex(mobileRegex, { message: 'Must be 10–15 digits, optionally starting with +' })
    .optional()
    .or(z.literal('')),

  aadhaar_number: z
    .string()
    .min(1, { message: 'Aadhaar is required' })
    .regex(aadhaarRegex, { message: 'Aadhaar must be exactly 12 digits' }),

  pan_number: z
    .string()
    .min(1, { message: 'PAN is required' })
    .regex(panRegex, { message: 'PAN must follow the format ABCDE1234F' }),

  date_of_birth: z
    .string()
    .min(1, { message: 'Date of birth is required' })
    .refine((val) => {
      const d = new Date(val)
      return !isNaN(d.getTime()) && d < new Date()
    }, { message: 'Date of birth must be in the past' }),

  place_of_birth: z.string().min(1, { message: 'Place of birth is required' }).trim(),
  current_address: z.string().min(1, { message: 'Current address is required' }).trim(),
  permanent_address: z.string().min(1, { message: 'Permanent address is required' }).trim(),
})

// Edit mode: PII fields (Aadhaar, PAN) can be left blank — blank means "keep existing value"
// All other fields remain required since they are pre-filled from the user object
export const editUserSchema = userSchema.extend({
  aadhaar_number: z
    .string()
    .regex(aadhaarRegex, { message: 'Aadhaar must be exactly 12 digits' })
    .optional()
    .or(z.literal('')),
  pan_number: z
    .string()
    .regex(panRegex, { message: 'PAN must follow the format ABCDE1234F' })
    .optional()
    .or(z.literal('')),
})

export const updateUserSchema = userSchema.partial()

// UserFormValues covers both create and edit (superset — PII optional)
export type UserFormValues = z.infer<typeof editUserSchema>
export type UpdateUserFormValues = z.infer<typeof updateUserSchema>
