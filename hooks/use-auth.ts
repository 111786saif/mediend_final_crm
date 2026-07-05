'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiPost, apiGet } from '@/lib/api-client'
import { useRouter } from 'next/navigation'
import { SessionUser } from '@/lib/auth'
import { UserRole } from '@/generated/prisma/enums'
import { useState } from 'react'
import { getFirstNavUrl } from '@/lib/sidebar-nav'

const TESTER_ROLE_KEY = 'mediend_tester_active_role'

export function useAuth() {
  const queryClient = useQueryClient()
  const router = useRouter()

  const [activeRole, setActiveRoleState] = useState<UserRole | null>(() => {
    if (typeof window === 'undefined') return null
    return (localStorage.getItem(TESTER_ROLE_KEY) as UserRole) ?? null
  })

  const { data: user, isLoading } = useQuery<SessionUser>({
    queryKey: ['auth', 'me'],
    queryFn: () => apiGet<SessionUser>('/api/auth/me'),
    retry: false,
  })

  const isTester = user?.role === 'TESTER'
  const effectiveUser = isTester && activeRole
    ? { ...user, role: activeRole }
    : user

  const setActiveRole = (role: UserRole | null) => {
    if (role) {
      localStorage.setItem(TESTER_ROLE_KEY, role)
    } else {
      localStorage.removeItem(TESTER_ROLE_KEY)
    }
    setActiveRoleState(role)
    queryClient.invalidateQueries({ queryKey: ['auth', 'me'] })
    queryClient.invalidateQueries({ queryKey: ['me', 'permissions'] })
  }

  const loginMutation = useMutation({
    mutationFn: async (credentials: { email: string; password: string }) => {
      return apiPost<{ user: SessionUser }>('/api/auth/login', credentials)
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['auth', 'me'], data.user)
      // Clear TESTER role on login
      localStorage.removeItem(TESTER_ROLE_KEY)
      setActiveRoleState(null)
      router.push(getFirstNavUrl(data.user))
    },
  })

  const logoutMutation = useMutation({
    mutationFn: async () => {
      return apiPost('/api/auth/logout', {})
    },
    onSuccess: () => {
      // Clear TESTER role on logout
      localStorage.removeItem(TESTER_ROLE_KEY)
      setActiveRoleState(null)
      queryClient.clear()
      router.push('/login')
    },
  })

  return {
    user: effectiveUser,
    isTester,
    setActiveRole,
    isLoading,
    login: loginMutation.mutateAsync,
    logout: logoutMutation.mutate,
    isLoggingIn: loginMutation.isPending,
  }
}
