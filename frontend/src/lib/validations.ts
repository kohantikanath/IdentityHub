import { z } from 'zod'

const mobileRegex = /^\+?[1-9]\d{9,14}$/
const aadhaarRegex = /^\d{12}$/
const panRegex = /^[A-Za-z]{5}[0-9]{4}[A-Za-z]{1}$/

export const userSchema = z.object({
  name: z.string().min(1, 'Name is required').trim(),

  email: z.string().email('Enter a valid email address'),

  primary_mobile: z
    .string()
    .min(1, 'Primary mobile is required')
    .regex(mobileRegex, 'Must be 10–15 digits, optionally starting with +'),

  // Optional — validate only when provided
  secondary_mobile: z
    .string()
    .regex(mobileRegex, 'Must be 10–15 digits, optionally starting with +')
    .optional()
    .or(z.literal('')),

  aadhaar_number: z
    .string()
    .min(1, 'Aadhaar is required')
    .regex(aadhaarRegex, 'Aadhaar must be exactly 12 digits'),

  pan_number: z
    .string()
    .min(1, 'PAN is required')
    .regex(panRegex, 'PAN must follow the format ABCDE1234F'),

  date_of_birth: z
    .string()
    .min(1, 'Date of birth is required')
    .refine((val) => {
      const d = new Date(val)
      return !isNaN(d.getTime()) && d < new Date()
    }, 'Date of birth must be in the past'),

  place_of_birth: z.string().min(1, 'Place of birth is required').trim(),
  current_address: z.string().min(1, 'Current address is required').trim(),
  permanent_address: z.string().min(1, 'Permanent address is required').trim(),
})

// For PATCH — every field becomes optional but still validated if provided
export const updateUserSchema = userSchema.partial()

export type UserFormValues = z.infer<typeof userSchema>
export type UpdateUserFormValues = z.infer<typeof updateUserSchema>
