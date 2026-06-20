export interface User {
  id: string
  name: string
  email: string
  primary_mobile: string
  secondary_mobile: string | null
  aadhaar_number: string   // always masked from API: XXXXXXXX1234
  pan_number: string       // always masked from API: ABXXXXX34F
  date_of_birth: string    // ISO date string: YYYY-MM-DD
  place_of_birth: string
  current_address: string
  permanent_address: string
  is_deleted: boolean
  created_at: string
  updated_at: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  size: number
  pages: number
}

export interface CreateUserPayload {
  name: string
  email: string
  primary_mobile: string
  secondary_mobile?: string
  aadhaar_number: string
  pan_number: string
  date_of_birth: string
  place_of_birth: string
  current_address: string
  permanent_address: string
}

// All fields optional for PATCH — only send what changed
export type UpdateUserPayload = Partial<CreateUserPayload>
