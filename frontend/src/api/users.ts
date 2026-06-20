import axios from 'axios'
import type { CreateUserPayload, FilterParams, MetaResponse, PaginatedResponse, UpdateUserPayload, User } from '../types/user'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1',
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const detail = error.response?.data?.detail
    let message = 'An unexpected error occurred'
    if (Array.isArray(detail)) {
      message = detail.map((d: { field: string; message: string }) => `${d.field}: ${d.message}`).join(', ')
    } else if (typeof detail === 'string') {
      message = detail
    }
    return Promise.reject(new Error(message))
  },
)

export const usersApi = {
  getAll: (page = 1, size = 10, filters: FilterParams = {}): Promise<PaginatedResponse<User>> => {
    const params: Record<string, unknown> = { page, size }
    if (filters.search)           params.search           = filters.search
    if (filters.place_of_birth)   params.place_of_birth   = filters.place_of_birth
    if (filters.dob_year_from)    params.dob_year_from    = filters.dob_year_from
    if (filters.dob_year_to)      params.dob_year_to      = filters.dob_year_to
    if (filters.name_starts_with) params.name_starts_with = filters.name_starts_with
    if (filters.sort_by)          params.sort_by          = filters.sort_by
    if (filters.sort_order)       params.sort_order       = filters.sort_order
    return api.get('/users/', { params }).then((r) => r.data)
  },

  getMeta: (): Promise<MetaResponse> =>
    api.get('/users/meta').then((r) => r.data),

  getById: (id: string): Promise<User> =>
    api.get(`/users/${id}`).then((r) => r.data),

  create: (payload: CreateUserPayload): Promise<User> =>
    api.post('/users/', payload).then((r) => r.data),

  update: (id: string, payload: UpdateUserPayload): Promise<User> =>
    api.patch(`/users/${id}`, payload).then((r) => r.data),

  delete: (id: string): Promise<void> =>
    api.delete(`/users/${id}`).then(() => undefined),
}
