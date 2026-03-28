'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost } from '@/lib/api-client'
import { useState } from 'react'
import { Plus, Calendar } from 'lucide-react'
import { LeaveBalanceCard } from '@/components/hrms/LeaveBalanceCard'
import { LeaveApplicationForm } from '@/components/hrms/LeaveApplicationForm'
import { toast } from 'sonner'
import { format } from 'date-fns'

interface LeaveType {
  id: string
  name: string
  maxDays: number
  isActive: boolean
  code?: string | null
}

interface LeaveRequest {
  id: string
  leaveType: LeaveType
  startDate: Date
  endDate: Date
  days: number
  reason: string | null
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  approvedAt: Date | null
  approvedBy: {
    id: string
    name: string
    email: string
  } | null
  remarks: string | null
}

interface LeaveData {
  requests: LeaveRequest[]
  balances: Array<{
    id: string
    leaveTypeId: string
    allocated: number
    used: number
    remaining: number
    locked?: number
    isProbation?: boolean
    carryForward?: boolean
    leaveType: LeaveType
  }>
}

export default function EmployeeLeavesPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const queryClient = useQueryClient()

  const { data: leaveData, isLoading } = useQuery<LeaveData>({
    queryKey: ['leaves', 'my'],
    queryFn: () => apiGet<LeaveData>('/api/leaves/my'),
  })

  const { data: leaveTypes, isLoading: leaveTypesLoading, error: leaveTypesError } = useQuery<LeaveType[]>({
    queryKey: ['leaveTypes'],
    queryFn: () => apiGet<LeaveType[]>('/api/leaves/types?activeOnly=true'),
  })

  const isProbation = leaveData?.balances?.[0]?.isProbation ?? false

  const applyLeaveMutation = useMutation({
    mutationFn: (data: {
      leaveTypeId: string
      startDate: Date
      endDate: Date
      reason?: string
      isHalfDay?: boolean
    }) =>
      apiPost<LeaveRequest>('/api/leaves/apply', {
        leaveTypeId: data.leaveTypeId,
        startDate: format(data.startDate, 'yyyy-MM-dd'),
        endDate: format(data.endDate, 'yyyy-MM-dd'),
        reason: data.reason,
        ...(data.isHalfDay ? { isHalfDay: true } : {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaves', 'my'] })
      setIsDialogOpen(false)
      toast.success('Leave application submitted successfully')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to submit leave application')
    },
  })

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return <Badge variant="default" className="font-medium">Approved</Badge>
      case 'REJECTED':
        return <Badge variant="destructive" className="font-medium">Rejected</Badge>
      default:
        return <Badge variant="secondary" className="font-medium">Pending</Badge>
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Leave Management</h1>
          <p className="text-muted-foreground mt-1">
            Apply for leaves and view your leave balance. Policy: 1 CL, 0.5 SL, 0.5 EL per month; EL carries forward.
            {isProbation && (
              <span className="block mt-1 text-amber-600 dark:text-amber-400">
                Leave applications are locked during your first 6 months.
              </span>
            )}
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button disabled={isProbation}>
              <Plus className="h-4 w-4 mr-2" />
              Apply for Leave
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Apply for Leave</DialogTitle>
              <DialogDescription>
                CL and EL are for today or future only; SL can be used for past dates. Balances follow policy.
              </DialogDescription>
            </DialogHeader>
            {isProbation ? (
              <p className="text-sm text-muted-foreground py-4">
                Leave applications are not available during your probation period (first 6 months).
              </p>
            ) : leaveTypesLoading ? (
              <div className="text-center py-4 text-muted-foreground">Loading leave types...</div>
            ) : leaveTypesError ? (
              <div className="text-center py-4 text-red-500">
                Failed to load leave types. Please try again.
              </div>
            ) : leaveTypes && leaveTypes.length > 0 ? (
              <LeaveApplicationForm
                leaveTypes={leaveTypes}
                balances={leaveData?.balances?.map((b) => ({
                  leaveTypeId: b.leaveTypeId,
                  remaining: b.remaining,
                  allocated: b.allocated,
                  locked: b.locked,
                  isProbation: b.isProbation,
                })) ?? []}
                onSubmit={(data) => applyLeaveMutation.mutate(data)}
                isLoading={applyLeaveMutation.isPending}
              />
            ) : (
              <div className="text-center py-4 text-muted-foreground">
                No leave types available. Please contact HR.
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {leaveData?.balances && leaveData.balances.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-4">Leave Balance</h2>
          <LeaveBalanceCard balances={leaveData.balances} />
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Leave History</CardTitle>
          <CardDescription>Your leave requests and their status</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Leave Type</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>End Date</TableHead>
                  <TableHead>Days</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Approved By</TableHead>
                  <TableHead>Remarks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaveData?.requests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell className="font-medium">{request.leaveType.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        {format(new Date(request.startDate), 'PPP')}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        {format(new Date(request.endDate), 'PPP')}
                      </div>
                    </TableCell>
                    <TableCell>
                      {request.days === 0.5 ? (
                        <Badge className="bg-cyan-600 text-white hover:bg-cyan-600 font-medium border-0">
                          ½ day (0.5)
                        </Badge>
                      ) : (
                        <span>
                          <strong>{request.days}</strong> days
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{request.reason || 'N/A'}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(request.status)}
                        {request.approvedAt && (
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(request.approvedAt), 'MMM d')}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {request.approvedBy ? (
                        <div>
                          <p className="text-sm font-medium">{request.approvedBy.name}</p>
                          <p className="text-xs text-muted-foreground">{request.approvedBy.email}</p>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell>{request.remarks || 'N/A'}</TableCell>
                  </TableRow>
                ))}
                {(!leaveData?.requests || leaveData.requests.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      No leave requests found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

