import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPatch } from '@/lib/api-client'

export interface Notification {
  id: string
  userId: string
  type:
    | 'KYP_SUBMITTED'
    | 'PRE_AUTH_COMPLETE'
    | 'FOLLOW_UP_COMPLETE'
    | 'KYP_COMPLETED'
    | 'CASE_CHAT_MESSAGE'
    | 'TASK_ASSIGNED'
    | 'TASK_DUE_SOON'
    | 'DUE_DATE_CHANGE_REQUESTED'
    | 'DUE_DATE_CHANGE_APPROVED'
    | 'DUE_DATE_CHANGE_REJECTED'
    | 'MEET_SCHEDULED'
    | 'MEET_REMINDER'
    | 'RANK_IMPROVED'
  title: string
  message: string
  link: string | null
  relatedId: string | null
  isRead: boolean
  readAt: string | null
  createdAt: string
}

export function useNotifications(unreadOnly: boolean = false) {
  return useQuery<Notification[]>({
    queryKey: ['notifications', unreadOnly],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (unreadOnly) {
        params.append('unreadOnly', 'true')
      }
      return apiGet<Notification[]>(`/api/notifications?${params.toString()}`)
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  })
}

export function useUnreadCount() {
  return useQuery<{ count: number }>({
    queryKey: ['notifications', 'unread-count'],
    queryFn: async () => {
      return apiGet<{ count: number }>('/api/notifications/unread-count')
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  })
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (notificationId: string) => {
      return apiPatch<Notification>(`/api/notifications/${notificationId}/read`, {})
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] })
    },
  })
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      return apiPatch<{ count: number }>('/api/notifications/read-all', {})
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] })
    },
  })
}