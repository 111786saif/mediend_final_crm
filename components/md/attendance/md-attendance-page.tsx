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

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Leave Type</p>
              <p className="font-medium">{request.leaveType}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Days</p>
              <p className="font-medium">{request.days}</p>
            </div>
            <div>
              <p className="text-muted-foreground">From</p>
              <p className="font-medium">{format(new Date(request.startDate), 'dd MMM yyyy')}</p>
            </div>
            <div>
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

        <DrawerFooter className="flex-row gap-3 border-t p-4">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => handleAction('REJECTED')}
            disabled={isSubmitting}
          >
            <X className="mr-2 h-4 w-4" />
            Reject
          </Button>
          <Button
            className="flex-1"
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

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Date</p>
              <p className="font-medium">{format(new Date(request.date), 'dd MMM yyyy')}</p>
            </div>
            <div>
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

        <DrawerFooter className="flex-row gap-3 border-t p-4">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => handleAction('REJECTED')}
            disabled={isSubmitting}
          >
            <X className="mr-2 h-4 w-4" />
            Reject
          </Button>
          <Button
            className="flex-1"
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
    <div className="container mx-auto max-w-5xl px-4 py-4 sm:px-6 sm:py-6">
      <header className="mb-4 flex items-center justify-between gap-3 sm:mb-5">
        <h1 className="min-w-0 text-lg font-semibold leading-tight tracking-tight sm:text-xl md:text-2xl">
          Team Attendance
        </h1>
        <Badge variant="outline" className="shrink-0 px-2 py-0.5 text-[10px] font-medium sm:text-xs">
          MD Only
        </Badge>
      </header>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-4 grid w-full grid-cols-2 sm:mb-6">
          <TabsTrigger value="leaves" className="gap-1.5 px-2 text-xs sm:gap-2 sm:px-3 sm:text-sm">
            <Calendar className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
            <span className="truncate">
              <span className="sm:hidden">Leaves</span>
              <span className="hidden sm:inline">Leave requests</span>
              {' '}({pendingLeaves.length})
            </span>
          </TabsTrigger>
          <TabsTrigger value="normalizations" className="gap-1.5 px-2 text-xs sm:gap-2 sm:px-3 sm:text-sm">
            <Clock className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
            <span className="truncate">
              <span className="sm:hidden">Norm.</span>
              <span className="hidden sm:inline">Normalizations</span>
              {' '}({pendingNormalizations.length})
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="leaves" className="space-y-4">
          {leavesLoading ? (
            <Card>
              <CardContent className="p-12 flex items-center justify-center">
                <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
              </CardContent>
            </Card>
          ) : pendingLeaves.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <UserCheck className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-xl font-medium">No pending leave requests</p>
                <p className="text-muted-foreground mt-1">All leave requests from your team have been processed</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {pendingLeaves.map((leave) => (
                <Card key={leave.id} className="cursor-pointer hover:shadow-md transition-all" 
                      onClick={() => setSelectedLeave(leave)}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-4">
                        <Avatar>
                          <AvatarFallback>
                            {leave.employeeName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-semibold">{leave.employeeName}</div>
                          <div className="text-sm text-muted-foreground">{leave.employeeEmail}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge>{leave.leaveType}</Badge>
                        <div className="text-xs text-muted-foreground mt-1">
                          {leave.days} day{leave.days !== 1 ? 's' : ''}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 text-sm flex items-center gap-4 text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {format(new Date(leave.startDate), 'dd MMM')} — {format(new Date(leave.endDate), 'dd MMM yyyy')}
                      </div>
                      {leave.reason && (
                        <div className="line-clamp-1 flex-1 text-xs">
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

        <TabsContent value="normalizations" className="space-y-4">
          {normalizationsLoading ? (
            <Card>
              <CardContent className="p-12 flex items-center justify-center">
                <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
              </CardContent>
            </Card>
          ) : pendingNormalizations.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-xl font-medium">No pending normalization requests</p>
                <p className="text-muted-foreground mt-1">All normalization requests from your team have been processed</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {pendingNormalizations.map((norm) => (
                <Card key={norm.id} className="cursor-pointer hover:shadow-md transition-all" 
                      onClick={() => setSelectedNormalization(norm)}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-4">
                        <Avatar>
                          <AvatarFallback>
                            {norm.employee.user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-semibold">{norm.employee.user.name}</div>
                          <div className="text-sm text-muted-foreground">{norm.employee.employeeCode}</div>
                        </div>
                      </div>
                      <Badge variant="secondary">Normalization</Badge>
                    </div>

                    <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {format(new Date(norm.date), 'dd MMM yyyy')}
                      </div>
                      {norm.reason && (
                        <div className="line-clamp-1 flex-1 text-xs">
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
