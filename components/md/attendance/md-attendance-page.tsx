'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPatch } from '@/lib/api-client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Calendar, Clock, UserCheck, FileText, Check, X } from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from '@/components/ui/drawer'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface TeamLeave {
  id: string
  employeeId: string
  employeeName: string
  employeeEmail: string
  leaveType: string
  startDate: string
  endDate: string
  days: number
  reason: string | null
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  approvedAt: string | null
  createdAt: string
}

interface NormalizationRequest {
  id: string
  employeeId: string
  date: string
  reason: string | null
  createdAt: string
  employee: {
    id: string
    employeeCode: string
    user: {
      name: string
      email: string
    }
  }
  requestedBy?: string | null
}

interface LeaveRequestDrawerProps {
  request: TeamLeave | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onApprove: (id: string, status: 'APPROVED' | 'REJECTED', remarks?: string) => void
}

function LeaveRequestDrawer({ request, open, onOpenChange, onApprove }: LeaveRequestDrawerProps) {
  const [remarks, setRemarks] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!request) return null

  const handleAction = async (status: 'APPROVED' | 'REJECTED') => {
    setIsSubmitting(true)
    try {
      await onApprove(request.id, status, status === 'REJECTED' ? remarks : undefined)
      onOpenChange(false)
      setRemarks('')
    } catch (error) {
      console.error(error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Leave Request</DrawerTitle>
          <DrawerDescription>Review and take action</DrawerDescription>
        </DrawerHeader>

        <div className="px-6 py-4 space-y-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-12 w-12">
              <AvatarFallback>
                {request.employeeName.split(' ').map(n => n[0]).join('').toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold">{request.employeeName}</p>
              <p className="text-sm text-muted-foreground">{request.employeeEmail}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 sm:gap-4">
            <div className="rounded-lg border border-teal-200/60 bg-teal-50/50 p-3 dark:border-teal-900/50 dark:bg-teal-950/30">
              <p className="text-muted-foreground">Leave Type</p>
              <p className="font-medium text-teal-950 dark:text-teal-100">{request.leaveType}</p>
            </div>
            <div className="rounded-lg border border-teal-200/60 bg-teal-50/50 p-3 dark:border-teal-900/50 dark:bg-teal-950/30">
              <p className="text-muted-foreground">Days</p>
              <p className="font-medium">{request.days}</p>
            </div>
            <div className="rounded-lg border border-teal-200/60 bg-teal-50/50 p-3 dark:border-teal-900/50 dark:bg-teal-950/30">
              <p className="text-muted-foreground">From</p>
              <p className="font-medium">{format(new Date(request.startDate), 'dd MMM yyyy')}</p>
            </div>
            <div className="rounded-lg border border-teal-200/60 bg-teal-50/50 p-3 dark:border-teal-900/50 dark:bg-teal-950/30">
              <p className="text-muted-foreground">To</p>
              <p className="font-medium">{format(new Date(request.endDate), 'dd MMM yyyy')}</p>
            </div>
          </div>

          {request.reason && (
            <div>
              <p className="text-muted-foreground text-sm mb-1">Reason</p>
              <p className="text-sm border rounded-lg p-3 bg-muted/50">{request.reason}</p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="remarks">Remarks (for rejection)</Label>
            <Textarea
              id="remarks"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Add remarks..."
              className="min-h-[80px]"
            />
          </div>
        </div>

        <DrawerFooter className="flex flex-col-reverse gap-2 border-t p-4 sm:flex-row sm:gap-3">
          <Button
            variant="outline"
            className="w-full flex-1 border-red-200 text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40"
            onClick={() => handleAction('REJECTED')}
            disabled={isSubmitting}
          >
            <X className="mr-2 h-4 w-4" />
            Reject
          </Button>
          <Button
            className="w-full flex-1 bg-teal-600 text-white hover:bg-teal-700"
            onClick={() => handleAction('APPROVED')}
            disabled={isSubmitting}
          >
            <Check className="mr-2 h-4 w-4" />
            Approve
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}

interface NormalizationDrawerProps {
  request: NormalizationRequest | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onApprove: (id: string, status: 'APPROVED' | 'REJECTED', normalizeAs?: 'FULL_DAY' | 'HALF_DAY') => void
}

function NormalizationRequestDrawer({ request, open, onOpenChange, onApprove }: NormalizationDrawerProps) {
  const [normalizeAs, setNormalizeAs] = useState<'FULL_DAY' | 'HALF_DAY'>('FULL_DAY')
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!request) return null

  const handleAction = async (status: 'APPROVED' | 'REJECTED') => {
    setIsSubmitting(true)
    try {
      await onApprove(request.id, status, status === 'APPROVED' ? normalizeAs : undefined)
      onOpenChange(false)
      setNormalizeAs('FULL_DAY')
    } catch (error) {
      console.error(error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Normalization Request</DrawerTitle>
          <DrawerDescription>Review and take action</DrawerDescription>
        </DrawerHeader>

        <div className="px-6 py-4 space-y-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-12 w-12">
              <AvatarFallback>
                {request.employee.user.name.split(' ').map(n => n[0]).join('').toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold">{request.employee.user.name}</p>
              <p className="text-sm text-muted-foreground">{request.employee.employeeCode}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 sm:gap-4">
            <div className="rounded-lg border border-amber-200/60 bg-amber-50/50 p-3 dark:border-amber-900/50 dark:bg-amber-950/30">
              <p className="text-muted-foreground">Date</p>
              <p className="font-medium text-amber-950 dark:text-amber-100">{format(new Date(request.date), 'dd MMM yyyy')}</p>
            </div>
            <div className="rounded-lg border border-amber-200/60 bg-amber-50/50 p-3 dark:border-amber-900/50 dark:bg-amber-950/30">
              <p className="text-muted-foreground">Submitted</p>
              <p className="font-medium">{format(new Date(request.createdAt), 'dd MMM yyyy')}</p>
            </div>
          </div>

          {request.reason && (
            <div>
              <p className="text-muted-foreground text-sm mb-1">Reason</p>
              <p className="text-sm border rounded-lg p-3 bg-muted/50">{request.reason}</p>
            </div>
          )}

          <div className="space-y-2">
            <Label>Normalize as</Label>
            <Select value={normalizeAs} onValueChange={(v) => setNormalizeAs(v as 'FULL_DAY' | 'HALF_DAY')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FULL_DAY">Full Day</SelectItem>
                <SelectItem value="HALF_DAY">Half Day</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DrawerFooter className="flex flex-col-reverse gap-2 border-t p-4 sm:flex-row sm:gap-3">
          <Button
            variant="outline"
            className="w-full flex-1 border-red-200 text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40"
            onClick={() => handleAction('REJECTED')}
            disabled={isSubmitting}
          >
            <X className="mr-2 h-4 w-4" />
            Reject
          </Button>
          <Button
            className="w-full flex-1 bg-amber-600 text-white hover:bg-amber-700"
            onClick={() => handleAction('APPROVED')}
            disabled={isSubmitting}
          >
            <Check className="mr-2 h-4 w-4" />
            Approve as {normalizeAs === 'FULL_DAY' ? 'Full Day' : 'Half Day'}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}

export function MDAttendancePage() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('leaves')
  const [selectedLeave, setSelectedLeave] = useState<TeamLeave | null>(null)
  const [selectedNormalization, setSelectedNormalization] = useState<NormalizationRequest | null>(null)

  // Fetch pending leaves for team
  const { data: leavesData, isLoading: leavesLoading } = useQuery<{ leaves: TeamLeave[] }>({
    queryKey: ['md', 'team', 'leaves', 'pending'],
    queryFn: () => apiGet<{ leaves: TeamLeave[] }>('/api/hierarchy/my-team/leaves?status=PENDING'),
  })

  // Fetch pending normalization requests for team
  const { data: normalizationsData, isLoading: normalizationsLoading } = useQuery<{ list: NormalizationRequest[] }>({
    queryKey: ['md', 'team', 'normalizations', 'pending'],
    queryFn: () => apiGet<{ list: NormalizationRequest[] }>('/api/attendance/normalize/team-requests'),
  })

  const leaves = leavesData?.leaves ?? []
  const normalizations = normalizationsData?.list ?? []

  const approveLeaveMutation = useMutation({
    mutationFn: async ({ id, status, remarks }: { id: string; status: 'APPROVED' | 'REJECTED'; remarks?: string }) => {
      return apiPatch(`/api/leaves/${id}/approve`, { 
        status, 
        ...(remarks && { remarks }) 
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['md', 'team', 'leaves'] })
      queryClient.invalidateQueries({ queryKey: ['hierarchy', 'my-team', 'leaves'] })
      toast.success('Leave request processed')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to process leave request')
    },
  })

  const approveNormalizationMutation = useMutation({
    mutationFn: async ({ id, status, normalizeAs }: { id: string; status: 'APPROVED' | 'REJECTED'; normalizeAs?: 'FULL_DAY' | 'HALF_DAY' }) => {
      return apiPatch(`/api/md/normalizations/${id}/approve`, { 
        status, 
        ...(status === 'APPROVED' && normalizeAs && { normalizeAs }) 
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['md', 'team', 'normalizations'] })
      queryClient.invalidateQueries({ queryKey: ['attendance', 'normalize', 'team'] })
      toast.success('Normalization request processed')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to process normalization request')
    },
  })

  const handleApproveLeave = (id: string, status: 'APPROVED' | 'REJECTED', remarks?: string) => {
    approveLeaveMutation.mutate({ id, status, remarks })
  }

  const handleApproveNormalization = (id: string, status: 'APPROVED' | 'REJECTED', normalizeAs?: 'FULL_DAY' | 'HALF_DAY') => {
    approveNormalizationMutation.mutate({ id, status, normalizeAs })
  }

  const pendingLeaves = leaves.filter(l => l.status === 'PENDING')
  const pendingNormalizations = normalizations

  return (
    <div className="mx-auto w-full max-w-5xl min-w-0 px-3 py-4 sm:px-6 sm:py-6">
      <header className="mb-4 flex flex-col gap-3 rounded-xl border border-teal-200/80 bg-gradient-to-r from-teal-500/10 via-background to-violet-500/10 p-4 shadow-sm dark:border-teal-900/50 dark:from-teal-500/15 dark:to-violet-500/15 sm:mb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold leading-tight tracking-tight text-teal-950 dark:text-teal-100 sm:text-xl md:text-2xl">
            Team Attendance
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
            Approve leave and attendance normalization for your team
          </p>
        </div>
        <Badge className="w-fit shrink-0 border-violet-300/80 bg-violet-100 text-violet-900 hover:bg-violet-100 dark:border-violet-700 dark:bg-violet-950/80 dark:text-violet-100">
          MD Only
        </Badge>
      </header>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full min-w-0">
        <TabsList className="mb-4 grid h-auto w-full min-w-0 grid-cols-2 gap-1 rounded-xl bg-muted/60 p-1 sm:mb-6">
          <TabsTrigger
            value="leaves"
            className="gap-1.5 rounded-lg px-2 text-xs data-[state=active]:bg-teal-600 data-[state=active]:text-white data-[state=active]:shadow-sm sm:gap-2 sm:px-3 sm:text-sm"
          >
            <Calendar className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
            <span className="min-w-0 truncate">
              <span className="sm:hidden">Leaves</span>
              <span className="hidden sm:inline">Leave requests</span>
              {' '}({pendingLeaves.length})
            </span>
          </TabsTrigger>
          <TabsTrigger
            value="normalizations"
            className="gap-1.5 rounded-lg px-2 text-xs data-[state=active]:bg-amber-600 data-[state=active]:text-white data-[state=active]:shadow-sm sm:gap-2 sm:px-3 sm:text-sm"
          >
            <Clock className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
            <span className="min-w-0 truncate">
              <span className="sm:hidden">Norm.</span>
              <span className="hidden sm:inline">Normalizations</span>
              {' '}({pendingNormalizations.length})
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="leaves" className="min-w-0 space-y-3 sm:space-y-4">
          {leavesLoading ? (
            <Card className="border-teal-200/60 dark:border-teal-900/40">
              <CardContent className="flex items-center justify-center p-8 sm:p-12">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
              </CardContent>
            </Card>
          ) : pendingLeaves.length === 0 ? (
            <Card className="border-teal-200/60 bg-teal-50/40 dark:border-teal-900/40 dark:bg-teal-950/20">
              <CardContent className="p-8 text-center sm:p-12">
                <UserCheck className="mx-auto mb-3 h-10 w-10 text-teal-600 dark:text-teal-400 sm:mb-4 sm:h-12 sm:w-12" />
                <p className="text-lg font-medium text-teal-950 dark:text-teal-100 sm:text-xl">No pending leave requests</p>
                <p className="mt-1 text-sm text-muted-foreground">All leave requests from your team have been processed</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid min-w-0 gap-3 sm:gap-4">
              {pendingLeaves.map((leave) => (
                <Card
                  key={leave.id}
                  className="min-w-0 cursor-pointer border-l-4 border-l-teal-500 transition-all hover:shadow-md dark:border-l-teal-400"
                  onClick={() => setSelectedLeave(leave)}
                >
                  <CardContent className="min-w-0 p-4 sm:p-6">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                        <Avatar className="h-10 w-10 shrink-0 border-2 border-teal-200 dark:border-teal-800 sm:h-12 sm:w-12">
                          <AvatarFallback className="bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-200">
                            {leave.employeeName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="truncate font-semibold">{leave.employeeName}</div>
                          <div className="truncate text-sm text-muted-foreground">{leave.employeeEmail}</div>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-row items-center justify-between gap-2 sm:flex-col sm:items-end sm:text-right">
                        <Badge className="bg-teal-600 text-white hover:bg-teal-600">{leave.leaveType}</Badge>
                        <div className="text-xs text-muted-foreground">
                          {leave.days} day{leave.days !== 1 ? 's' : ''}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 flex min-w-0 flex-col gap-2 text-sm text-muted-foreground sm:mt-4 sm:flex-row sm:items-center sm:gap-4">
                      <div className="flex shrink-0 items-center gap-1">
                        <Calendar className="h-3.5 w-3.5 shrink-0 text-teal-600 dark:text-teal-400" />
                        <span className="whitespace-normal break-words">
                          {format(new Date(leave.startDate), 'dd MMM')} — {format(new Date(leave.endDate), 'dd MMM yyyy')}
                        </span>
                      </div>
                      {leave.reason && (
                        <div className="line-clamp-2 min-w-0 text-xs sm:line-clamp-1 sm:flex-1">
                          {leave.reason}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="normalizations" className="min-w-0 space-y-3 sm:space-y-4">
          {normalizationsLoading ? (
            <Card className="border-amber-200/60 dark:border-amber-900/40">
              <CardContent className="flex items-center justify-center p-8 sm:p-12">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-amber-600 border-t-transparent" />
              </CardContent>
            </Card>
          ) : pendingNormalizations.length === 0 ? (
            <Card className="border-amber-200/60 bg-amber-50/40 dark:border-amber-900/40 dark:bg-amber-950/20">
              <CardContent className="p-8 text-center sm:p-12">
                <FileText className="mx-auto mb-3 h-10 w-10 text-amber-600 dark:text-amber-400 sm:mb-4 sm:h-12 sm:w-12" />
                <p className="text-lg font-medium text-amber-950 dark:text-amber-100 sm:text-xl">No pending normalization requests</p>
                <p className="mt-1 text-sm text-muted-foreground">All normalization requests from your team have been processed</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid min-w-0 gap-3 sm:gap-4">
              {pendingNormalizations.map((norm) => (
                <Card
                  key={norm.id}
                  className="min-w-0 cursor-pointer border-l-4 border-l-amber-500 transition-all hover:shadow-md dark:border-l-amber-400"
                  onClick={() => setSelectedNormalization(norm)}
                >
                  <CardContent className="min-w-0 p-4 sm:p-6">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                        <Avatar className="h-10 w-10 shrink-0 border-2 border-amber-200 dark:border-amber-800 sm:h-12 sm:w-12">
                          <AvatarFallback className="bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                            {norm.employee.user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="truncate font-semibold">{norm.employee.user.name}</div>
                          <div className="truncate text-sm text-muted-foreground">{norm.employee.employeeCode}</div>
                        </div>
                      </div>
                      <Badge className="w-fit shrink-0 bg-amber-600 text-white hover:bg-amber-600">Normalization</Badge>
                    </div>

                    <div className="mt-3 flex min-w-0 flex-col gap-2 text-sm text-muted-foreground sm:mt-4 sm:flex-row sm:items-center sm:gap-4">
                      <div className="flex shrink-0 items-center gap-1">
                        <Clock className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                        {format(new Date(norm.date), 'dd MMM yyyy')}
                      </div>
                      {norm.reason && (
                        <div className="line-clamp-2 min-w-0 text-xs sm:line-clamp-1 sm:flex-1">
                          {norm.reason}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <LeaveRequestDrawer
        request={selectedLeave}
        open={!!selectedLeave}
        onOpenChange={(open) => !open && setSelectedLeave(null)}
        onApprove={handleApproveLeave}
      />

      <NormalizationRequestDrawer
        request={selectedNormalization}
        open={!!selectedNormalization}
        onOpenChange={(open) => !open && setSelectedNormalization(null)}
        onApprove={handleApproveNormalization}
      />
    </div>
  )
}
