import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { usersApi } from '../api/users'
import type { CreateUserPayload, UpdateUserPayload } from '../types/user'

export const USERS_QUERY_KEY = 'users'

export function useUsers(page: number, size: number) {
  return useQuery({
    queryKey: [USERS_QUERY_KEY, page, size],
    queryFn: () => usersApi.getAll(page, size),
    placeholderData: (prev) => prev,
  })
}

export function useCreateUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateUserPayload) => usersApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [USERS_QUERY_KEY] })
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
    },
  })
}
