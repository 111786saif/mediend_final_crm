'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost } from '@/lib/api-client'
import { useAuth } from '@/hooks/use-auth'
import { useIsMobile } from '@/hooks/use-mobile'
import { hasPermission } from '@/lib/rbac'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { toast } from 'sonner'
import { format } from 'date-fns'
import {
  CheckCheck,
  Clock,
  ExternalLink,
  UserCheck,
  Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface OnboardingItem {
  id: string
  employeeCode: string
  onboardingStatus: 'PENDING_PROFILE' | 'PENDING_APPROVAL'
  onboardingSubmittedAt: string | null
  joinDate: string | null
  dateOfBirth: string | null
  panNumber: string | null
  aadharNumber: string | null
  uanNumber: string | null
  bankAccountName: string | null
  bankAccountNumber: string | null
  ifscCode: string | null
  designation: string | null
  aadharDocUrl: string | null
  panDocUrl: string | null
  experienceType: 'FRESHER' | 'EXPERIENCED' | null
  personalEmail: string | null
  department: { id: string; name: string } | null
  user: {
    id: string
    name: string
    email: string
    role: string
    phoneNumber: string | null
    address: string | null
    profilePicture: string | null
    gender: string | null
    emergencyContactName: string | null
    emergencyContactPhone: string | null
  }
  documents: Array<{ id: string; label: string; url: string; fileName: string }>
}

interface OnboardingResponse {
  items: OnboardingItem[]
  summary: {
    total: number
    pendingProfile: number
    pendingApproval: number
  }
}

function mask(value: string | null | undefined, keep = 4) {
  if (!value) return '—'
  if (value.length <= keep) return value
  return '••••' + value.slice(-keep)
}

function Detail({
  label,
  value,
  className,
}: {
  label: string
  value?: string | null
  className?: string
}) {
  return (
    <div className={className}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 break-words text-sm font-medium">{value?.trim() || '—'}</p>
    </div>
  )
}

function ReviewDetails({ item }: { item: OnboardingItem }) {
  const initials = item.user.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 rounded-xl border bg-muted/20 p-3 sm:p-4">
        <Avatar className="size-20 ring-2 ring-violet-500/30 sm:size-24">
          <AvatarImage src={item.user.profilePicture || undefined} alt={item.user.name} />
          <AvatarFallback className="text-xl">{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold">{item.user.name}</p>
          <p className="truncate text-sm text-muted-foreground">{item.user.email}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {item.employeeCode}
            {item.department ? ` · ${item.department.name}` : ''}
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Detail label="Phone" value={item.user.phoneNumber} />
        <Detail label="Login email" value={item.user.email} />
        <Detail label="Personal email" value={item.personalEmail} />
        <Detail
          label="Experience"
          value={
            item.experienceType === 'EXPERIENCED'
              ? 'Experienced'
              : item.experienceType === 'FRESHER'
                ? 'Fresher'
                : null
          }
        />
        <Detail label="Role" value={item.user.role.replace(/_/g, ' ')} />
        <Detail
          label="DOB"
          value={item.dateOfBirth ? format(new Date(item.dateOfBirth), 'PPP') : null}
        />
        <Detail label="Aadhaar" value={mask(item.aadharNumber)} />
        <Detail label="PAN" value={item.panNumber} />
        <Detail label="UAN" value={mask(item.uanNumber)} />
        <Detail label="Bank holder" value={item.bankAccountName} />
        <Detail label="Account" value={mask(item.bankAccountNumber)} />
        <Detail label="IFSC" value={item.ifscCode} />
        <Detail
          label="Emergency"
          value={
            [item.user.emergencyContactName, item.user.emergencyContactPhone]
              .filter(Boolean)
              .join(' · ') || null
          }
        />
        <Detail label="Address" value={item.user.address} className="sm:col-span-2" />
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">Documents</p>
        {item.documents.length === 0 ? (
          <p className="text-sm text-muted-foreground">No documents uploaded</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {item.documents.map((doc) => (
              <a
                key={doc.id}
                href={doc.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs hover:bg-muted"
              >
                {doc.label}
                <ExternalLink className="h-3 w-3" />
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function HROnboardingPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const isMobile = useIsMobile()
  const canWrite = !!user && hasPermission(user, 'hrms:employees:write')
  const [reviewItem, setReviewItem] = useState<OnboardingItem | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [statusFilter, setStatusFilter] = useState<'all' | 'PENDING_APPROVAL' | 'PENDING_PROFILE'>('all')

  const { data, isLoading, refetch } = useQuery<OnboardingResponse>({
    queryKey: ['hr', 'onboarding', statusFilter],
    queryFn: () => {
      const q = statusFilter === 'all' ? '' : `?status=${statusFilter}`
      return apiGet<OnboardingResponse>(`/api/hr/onboarding${q}`)
    },
    enabled: !!user && (hasPermission(user, 'hrms:employees:read') || canWrite),
  })

  const items = data?.items ?? []
  const approvableIds = useMemo(
    () => items.filter((i) => i.onboardingStatus === 'PENDING_APPROVAL').map((i) => i.id),
    [items]
  )

  const approveMutation = useMutation({
    mutationFn: (payload: { employeeIds?: string[]; approveAll?: boolean }) =>
      apiPost<{ count: number }>('/api/hr/onboarding/approve', payload),
    onSuccess: (res) => {
      toast.success(`Approved ${res.count} employee${res.count === 1 ? '' : 's'}`)
      setSelected(new Set())
      setReviewItem(null)
      queryClient.invalidateQueries({ queryKey: ['hr', 'onboarding'] })
      refetch()
    },
    onError: (e: Error) => toast.error(e.message || 'Approval failed'),
  })

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAllApprovable = () => {
    if (selected.size === approvableIds.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(approvableIds))
    }
  }

  if (!user || (!hasPermission(user, 'hrms:employees:read') && !canWrite)) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        You do not have permission to view onboarding.
      </div>
    )
  }

  const reviewReady = reviewItem?.onboardingStatus === 'PENDING_APPROVAL'

  return (
    <div
      className={cn(
        'space-y-4 sm:space-y-6',
        canWrite && selected.size > 0 && 'pb-[calc(5rem+env(safe-area-inset-bottom))] sm:pb-0'
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Employee onboarding</h1>
          <p className="mt-1 text-sm text-muted-foreground sm:text-base">
            Review new hires&apos; profiles and approve them to activate access.
          </p>
        </div>
        {canWrite && (
          <div className="hidden flex-wrap gap-2 sm:flex">
            <Button
              variant="outline"
              disabled={selected.size === 0 || approveMutation.isPending}
              onClick={() => approveMutation.mutate({ employeeIds: Array.from(selected) })}
            >
              <UserCheck className="mr-1.5 h-4 w-4" />
              Approve selected ({selected.size})
            </Button>
            <Button
              className="bg-violet-600 hover:bg-violet-700"
              disabled={approvableIds.length === 0 || approveMutation.isPending}
              onClick={() => approveMutation.mutate({ approveAll: true })}
            >
              <CheckCheck className="mr-1.5 h-4 w-4" />
              {approveMutation.isPending
                ? 'Approving…'
                : `Approve all (${data?.summary.pendingApproval ?? 0})`}
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Card>
          <CardHeader className="p-3 pb-2 sm:p-6 sm:pb-2">
            <CardDescription className="text-[11px] sm:text-sm">Total in queue</CardDescription>
            <CardTitle className="flex items-center gap-1.5 text-xl sm:gap-2 sm:text-2xl">
              <Users className="h-4 w-4 text-muted-foreground sm:h-5 sm:w-5" />
              {data?.summary.total ?? 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="p-3 pb-2 sm:p-6 sm:pb-2">
            <CardDescription className="text-[11px] sm:text-sm">Filling profile</CardDescription>
            <CardTitle className="flex items-center gap-1.5 text-xl sm:gap-2 sm:text-2xl">
              <Clock className="h-4 w-4 text-amber-500 sm:h-5 sm:w-5" />
              {data?.summary.pendingProfile ?? 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="p-3 pb-2 sm:p-6 sm:pb-2">
            <CardDescription className="text-[11px] sm:text-sm">Awaiting approval</CardDescription>
            <CardTitle className="flex items-center gap-1.5 text-xl sm:gap-2 sm:text-2xl">
              <UserCheck className="h-4 w-4 text-violet-500 sm:h-5 sm:w-5" />
              {data?.summary.pendingApproval ?? 0}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ['all', 'All'],
            ['PENDING_APPROVAL', 'Ready'],
            ['PENDING_PROFILE', 'Filling'],
          ] as const
        ).map(([value, label]) => (
          <Button
            key={value}
            size="sm"
            variant={statusFilter === value ? 'default' : 'outline'}
            onClick={() => setStatusFilter(value)}
            className="text-xs sm:text-sm"
          >
            <span className="sm:hidden">{label}</span>
            <span className="hidden sm:inline">
              {value === 'all'
                ? 'All'
                : value === 'PENDING_APPROVAL'
                  ? 'Ready to approve'
                  : 'Still filling profile'}
            </span>
          </Button>
        ))}
        {canWrite && approvableIds.length > 0 && (
          <Button
            size="sm"
            variant="ghost"
            onClick={toggleSelectAllApprovable}
            className="ml-auto text-xs sm:text-sm"
          >
            {selected.size === approvableIds.length ? 'Clear' : 'Select all ready'}
          </Button>
        )}
      </div>

      {canWrite && (
        <div className="flex gap-2 sm:hidden">
          <Button
            size="sm"
            className="flex-1 bg-violet-600 hover:bg-violet-700"
            disabled={approvableIds.length === 0 || approveMutation.isPending}
            onClick={() => approveMutation.mutate({ approveAll: true })}
          >
            <CheckCheck className="mr-1 h-4 w-4" />
            Approve all ({data?.summary.pendingApproval ?? 0})
          </Button>
        </div>
      )}

      {isLoading ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">Loading…</CardContent>
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No employees in the onboarding queue.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2 sm:space-y-3">
          {items.map((item) => {
            const ready = item.onboardingStatus === 'PENDING_APPROVAL'
            const initials = item.user.name
              .split(' ')
              .map((n) => n[0])
              .join('')
              .slice(0, 2)
              .toUpperCase()

            return (
              <Card
                key={item.id}
                className={cn(ready && 'border-violet-200/70 dark:border-violet-900/50')}
              >
                <CardContent className="p-3 sm:p-5">
                  <div className="flex items-start gap-2.5 sm:gap-3">
                    {canWrite && ready && (
                      <Checkbox
                        checked={selected.has(item.id)}
                        onCheckedChange={() => toggleSelect(item.id)}
                        className="mt-3.5"
                        aria-label={`Select ${item.user.name}`}
                      />
                    )}
                    <Avatar className="mt-0.5 h-12 w-12 shrink-0 ring-2 ring-violet-500/20 sm:h-14 sm:w-14">
                      <AvatarImage src={item.user.profilePicture || undefined} />
                      <AvatarFallback>{initials}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                          <p className="truncate font-semibold">{item.user.name}</p>
                          <Badge variant={ready ? 'default' : 'secondary'} className="text-[10px] sm:text-xs">
                            {ready ? 'Pending approval' : 'Filling profile'}
                          </Badge>
                          {item.experienceType && (
                            <Badge variant="outline" className="text-[10px] sm:text-xs">
                              {item.experienceType === 'EXPERIENCED' ? 'Experienced' : 'Fresher'}
                            </Badge>
                          )}
                        </div>
                      <p className="truncate text-xs text-muted-foreground sm:text-sm">
                        {item.user.email}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {item.employeeCode}
                        {item.department ? ` · ${item.department.name}` : ''}
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground sm:text-xs">
                        {item.onboardingSubmittedAt
                          ? `Submitted ${format(new Date(item.onboardingSubmittedAt), 'PPp')}`
                          : 'Not submitted yet'}
                      </p>

                      <div className="mt-2.5 flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs"
                          onClick={() => setReviewItem(item)}
                        >
                          Review
                        </Button>
                        {canWrite && ready && (
                          <Button
                            size="sm"
                            className="h-8 bg-violet-600 text-xs hover:bg-violet-700"
                            disabled={approveMutation.isPending}
                            onClick={() => approveMutation.mutate({ employeeIds: [item.id] })}
                          >
                            Approve
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Mobile sticky bar for selected approvals */}
      {canWrite && selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/90 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:hidden">
          <Button
            className="w-full bg-violet-600 hover:bg-violet-700"
            disabled={approveMutation.isPending}
            onClick={() => approveMutation.mutate({ employeeIds: Array.from(selected) })}
          >
            <UserCheck className="mr-1.5 h-4 w-4" />
            {approveMutation.isPending
              ? 'Approving…'
              : `Approve selected (${selected.size})`}
          </Button>
        </div>
      )}

      <Drawer
        open={!!reviewItem}
        onOpenChange={(open) => {
          if (!open) setReviewItem(null)
        }}
        direction={isMobile ? 'bottom' : 'right'}
      >
        <DrawerContent
          className={cn(
            isMobile
              ? 'max-h-[92dvh]'
              : 'ml-auto h-full max-h-dvh w-full max-w-xl rounded-l-2xl rounded-r-none'
          )}
        >
          <DrawerHeader className="text-left">
            <DrawerTitle>Review profile</DrawerTitle>
            <DrawerDescription>
              {reviewItem
                ? reviewReady
                  ? 'Verify details before approving access.'
                  : 'Employee is still filling their profile.'
                : ''}
            </DrawerDescription>
          </DrawerHeader>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-2">
            {reviewItem ? <ReviewDetails item={reviewItem} /> : null}
          </div>
          <DrawerFooter className="flex-row gap-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <Button variant="outline" className="flex-1" onClick={() => setReviewItem(null)}>
              Close
            </Button>
            {canWrite && reviewItem && reviewReady && (
              <Button
                className="flex-1 bg-violet-600 hover:bg-violet-700"
                disabled={approveMutation.isPending}
                onClick={() => approveMutation.mutate({ employeeIds: [reviewItem.id] })}
              >
                {approveMutation.isPending ? 'Approving…' : 'Approve'}
              </Button>
            )}
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  )
}
