import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { usersApi } from '../api/users'
import type { CreateUserPayload, FilterParams, UpdateUserPayload } from '../types/user'

export const USERS_QUERY_KEY = 'users'
export const META_QUERY_KEY  = 'users-meta'

export function useUser(id: string) {
  return useQuery({
    queryKey: [USERS_QUERY_KEY, id],
    queryFn: () => usersApi.getById(id),
    enabled: !!id,
  })
}

export function useUsers(page: number, size: number, filters: FilterParams = {}) {
  return useQuery({
    queryKey: [USERS_QUERY_KEY, 'list', page, size, filters],
    queryFn: () => usersApi.getAll(page, size, filters),
    placeholderData: (prev) => prev,
  })
}

export function useMeta() {
  return useQuery({
    queryKey: [META_QUERY_KEY],
    queryFn: () => usersApi.getMeta(),
    staleTime: 1000 * 60 * 5,
  })
}

export function useCreateUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateUserPayload) => usersApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [USERS_QUERY_KEY] })
      queryClient.invalidateQueries({ queryKey: [META_QUERY_KEY] })
    },
  })
}

export function useUpdateUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateUserPayload }) =>
      usersApi.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [USERS_QUERY_KEY] })
    },
  })
}

export function useDeleteUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => usersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [USERS_QUERY_KEY] })
      queryClient.invalidateQueries({ queryKey: [META_QUERY_KEY] })
    },
  })
}
