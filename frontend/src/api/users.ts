import axios from 'axios'
import type { CreateUserPayload, PaginatedResponse, UpdateUserPayload, User } from '../types/user'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1',
  headers: { 'Content-Type': 'application/json' },
})

// Normalize every error to a plain string message before it reaches components
// Without this, components would have to parse axios error shapes themselves
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
  getAll: (page = 1, size = 10): Promise<PaginatedResponse<User>> =>
    api.get('/users/', { params: { page, size } }).then((r) => r.data),

  getById: (id: string): Promise<User> =>
    api.get(`/users/${id}`).then((r) => r.data),

  create: (payload: CreateUserPayload): Promise<User> =>
    api.post('/users/', payload).then((r) => r.data),

  update: (id: string, payload: UpdateUserPayload): Promise<User> =>
    api.patch(`/users/${id}`, payload).then((r) => r.data),

  delete: (id: string): Promise<void> =>
    api.delete(`/users/${id}`).then(() => undefined),
}
