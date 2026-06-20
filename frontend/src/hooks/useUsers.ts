import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { usersApi } from '../api/users'

// Central key — every query and invalidation references this constant
// so a typo in one place can never silently break cache invalidation
export const USERS_QUERY_KEY = 'users'

export function useUsers(page: number, size: number) {
  return useQuery({
    queryKey: [USERS_QUERY_KEY, page, size],
    queryFn: () => usersApi.getAll(page, size),
    // Keep previous page data visible while the next page loads
    // instead of flashing a loading spinner on every page change
    placeholderData: (prev) => prev,
  })
}

export function useDeleteUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => usersApi.delete(id),
    onSuccess: () => {
      // Invalidate all pages so the count and items stay accurate after deletion
      queryClient.invalidateQueries({ queryKey: [USERS_QUERY_KEY] })
    },
  })
}
