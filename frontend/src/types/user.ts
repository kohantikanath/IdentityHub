export interface User {
  id: string
  name: string
  email: string
  primary_mobile: string
  secondary_mobile: string | null
  aadhaar_number: string
  pan_number: string
  date_of_birth: string
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

export type UpdateUserPayload = Partial<CreateUserPayload>

export interface FilterParams {
  search?: string
  place_of_birth?: string
  dob_year_from?: number
  dob_year_to?: number
  name_starts_with?: string
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}

export interface MetaResponse {
  places_of_birth: string[]
}
