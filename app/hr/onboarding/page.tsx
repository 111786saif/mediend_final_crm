'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost } from '@/lib/api-client'
import { useAuth } from '@/hooks/use-auth'
import { hasPermission } from '@/lib/rbac'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
import { format } from 'date-fns'
import {
  CheckCheck,
  ChevronDown,
  ChevronUp,
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

export default function HROnboardingPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const canWrite = !!user && hasPermission(user, 'hrms:employees:write')
  const [expandedId, setExpandedId] = useState<string | null>(null)
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Employee onboarding</h1>
          <p className="text-muted-foreground mt-1">
            Review new hires&apos; profiles and approve them to activate access.
          </p>
        </div>
        {canWrite && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={selected.size === 0 || approveMutation.isPending}
              onClick={() =>
                approveMutation.mutate({ employeeIds: Array.from(selected) })
              }
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
              {approveMutation.isPending ? 'Approving…' : `Approve all (${data?.summary.pendingApproval ?? 0})`}
            </Button>
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total in queue</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Users className="h-5 w-5 text-muted-foreground" />
              {data?.summary.total ?? 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Filling profile</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-500" />
              {data?.summary.pendingProfile ?? 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Awaiting your approval</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-violet-500" />
              {data?.summary.pendingApproval ?? 0}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ['all', 'All'],
            ['PENDING_APPROVAL', 'Ready to approve'],
            ['PENDING_PROFILE', 'Still filling profile'],
          ] as const
        ).map(([value, label]) => (
          <Button
            key={value}
            size="sm"
            variant={statusFilter === value ? 'default' : 'outline'}
            onClick={() => setStatusFilter(value)}
          >
            {label}
          </Button>
        ))}
        {canWrite && approvableIds.length > 0 && (
          <Button size="sm" variant="ghost" onClick={toggleSelectAllApprovable} className="ml-auto">
            {selected.size === approvableIds.length ? 'Clear selection' : 'Select all ready'}
          </Button>
        )}
      </div>

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
        <div className="space-y-3">
          {items.map((item) => {
            const expanded = expandedId === item.id
            const ready = item.onboardingStatus === 'PENDING_APPROVAL'
            const initials = item.user.name
              .split(' ')
              .map((n) => n[0])
              .join('')
              .slice(0, 2)
              .toUpperCase()

            return (
              <Card key={item.id} className={cn(ready && 'border-violet-200/70 dark:border-violet-900/50')}>
                <CardContent className="p-4 sm:p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3 min-w-0">
                      {canWrite && ready && (
                        <Checkbox
                          checked={selected.has(item.id)}
                          onCheckedChange={() => toggleSelect(item.id)}
                          className="mt-3"
                          aria-label={`Select ${item.user.name}`}
                        />
                      )}
                      <Avatar className="h-14 w-14 mt-0.5 ring-2 ring-violet-500/20">
                        <AvatarImage src={item.user.profilePicture || undefined} />
                        <AvatarFallback>{initials}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold truncate">{item.user.name}</p>
                          <Badge variant={ready ? 'default' : 'secondary'}>
                            {ready ? 'Pending approval' : 'Filling profile'}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {item.user.email} · {item.employeeCode}
                          {item.department ? ` · ${item.department.name}` : ''}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {item.onboardingSubmittedAt
                            ? `Submitted ${format(new Date(item.onboardingSubmittedAt), 'PPp')}`
                            : 'Not submitted yet'}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 sm:shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setExpandedId(expanded ? null : item.id)}
                      >
                        {expanded ? (
                          <>
                            Hide <ChevronUp className="ml-1 h-4 w-4" />
                          </>
                        ) : (
                          <>
                            Review <ChevronDown className="ml-1 h-4 w-4" />
                          </>
                        )}
                      </Button>
                      {canWrite && ready && (
                        <Button
                          size="sm"
                          className="bg-violet-600 hover:bg-violet-700"
                          disabled={approveMutation.isPending}
                          onClick={() => approveMutation.mutate({ employeeIds: [item.id] })}
                        >
                          Approve
                        </Button>
                      )}
                    </div>
                  </div>

                  {expanded && (
                    <div className="mt-4 border-t pt-4 space-y-4">
                      <div className="flex items-center gap-4 rounded-xl border bg-muted/20 p-4">
                        <Avatar className="size-24 ring-2 ring-violet-500/30">
                          <AvatarImage src={item.user.profilePicture || undefined} alt={item.user.name} />
                          <AvatarFallback className="text-xl">{initials}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="font-semibold text-lg">{item.user.name}</p>
                          <p className="text-sm text-muted-foreground truncate">{item.user.email}</p>
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        <Detail label="Phone" value={item.user.phoneNumber} />
                        <Detail label="Role" value={item.user.role.replace(/_/g, ' ')} />
                        <Detail
                          label="DOB"
                          value={
                            item.dateOfBirth
                              ? format(new Date(item.dateOfBirth), 'PPP')
                              : null
                          }
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
                        <p className="text-sm font-medium mb-2">Documents</p>
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
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
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
      <p className="text-sm font-medium mt-0.5 break-words">{value?.trim() || '—'}</p>
    </div>
  )
}
