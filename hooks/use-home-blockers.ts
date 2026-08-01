'use client'

import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import { useWorkLogCheck } from '@/hooks/use-work-logs'

/**
 * Home-screen modal priority (first wins):
 * 1. Work log enforcer
 * 2. Pending notice blocker
 * 3. New hire welcome popup
 */
export function useHomeBlockers() {
  const tzOffsetMinutes = -new Date().getTimezoneOffset()
  const { data: workLogCheck, isLoading: workLogLoading } = useWorkLogCheck({
    tzOffsetMinutes,
  })
  const { data: pendingNotice, isLoading: noticeLoading } = useQuery<{ id: string } | null>({
    queryKey: ['notices-pending'],
    queryFn: () => apiGet<{ id: string } | null>('/api/notices/pending'),
  })

  const workLogBlocked = workLogCheck?.isBlocked ?? false
  const hasPendingNotice = !!pendingNotice

  return {
    workLogBlocked,
    workLogLoading,
    pendingNotice,
    noticeLoading,
    showNoticeBlocker: !workLogBlocked && hasPendingNotice,
    showNewHireWelcome: !workLogBlocked && !hasPendingNotice,
  }
}
