'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import { apiGet, apiPost, apiPut } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { formatDate, StatusBadge } from '@/components/doctor-admin/shared'
import { DoctorAdminDoctor, DoctorAdminLeaveItem } from '@/components/doctor-admin/types'

function calculateDays(startDate: string | Date, endDate: string | Date) {
  const start = new Date(startDate)
  const end = new Date(endDate)
  return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1)
}

export function DoctorAdminLeaveManagementTab() {
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState('all')
  const [doctorId, setDoctorId] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reason, setReason] = useState('')

  const doctorQuery = useQuery({
    queryKey: ['doctor-admin', 'doctors'],
    queryFn: () => apiGet<{ items: DoctorAdminDoctor[] }>('/api/doctor-admin/doctors'),
  })

  const leaveQuery = useQuery({
    queryKey: ['doctor-admin', 'leaves', statusFilter],
    queryFn: () =>
      apiGet<{ items: DoctorAdminLeaveItem[]; pagination: { total: number } }>(
        `/api/doctor-admin/leaves?limit=200${statusFilter !== 'all' ? `&status=${statusFilter}` : ''}`
      ),
  })

  const doctors = doctorQuery.data?.items ?? []

  const createMutation = useMutation({
    mutationFn: () =>
      apiPost<{ item: DoctorAdminLeaveItem }>('/api/doctor-admin/leaves', {
        doctorId,
        startDate,
        endDate,
        reason,
      }),
    onSuccess: () => {
      toast.success('Leave request created')
      setDialogOpen(false)
      setDoctorId('')
      setStartDate('')
      setEndDate('')
      setReason('')
      queryClient.invalidateQueries({ queryKey: ['doctor-admin', 'leaves'] })
    },
    onError: error => {
      toast.error(error.message || 'Failed to create leave')
    },
  })

  const reviewMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'approved' | 'rejected' }) =>
      apiPut<{ item: DoctorAdminLeaveItem }>(`/api/doctor-admin/leaves/${id}/review`, {
        status,
      }),
    onSuccess: (_, variables) => {
      toast.success(`Leave request ${variables.status}`)
      queryClient.invalidateQueries({ queryKey: ['doctor-admin', 'leaves'] })
    },
    onError: error => {
      toast.error(error.message || 'Failed to review leave')
    },
  })

  const filteredLeaves = useMemo(() => {
    const leaves = leaveQuery.data?.items ?? []
    if (statusFilter === 'all') return leaves
    return leaves.filter(leave => leave.status === statusFilter)
  }, [leaveQuery.data?.items, statusFilter])

  return (
    <div className='space-y-6'>
      <div className='flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between'>
        <div>
          <h2 className='text-2xl font-semibold tracking-tight'>Leave Management</h2>
          <p className='text-sm text-muted-foreground'>Manage doctor leave requests</p>
        </div>
        <div className='flex items-center gap-3'>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className='w-44'>
              <SelectValue placeholder='Filter status' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>All statuses</SelectItem>
              <SelectItem value='pending'>Pending</SelectItem>
              <SelectItem value='approved'>Approved</SelectItem>
              <SelectItem value='rejected'>Rejected</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className='mr-2 h-4 w-4' />
            Create Leave
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className='p-0'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Doctor</TableHead>
                <TableHead>From</TableHead>
                <TableHead>To</TableHead>
                <TableHead>Days</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leaveQuery.isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className='py-10 text-center text-muted-foreground'>
                    Loading...
                  </TableCell>
                </TableRow>
              ) : filteredLeaves.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className='py-10 text-center text-muted-foreground'>
                    No leave requests found
                  </TableCell>
                </TableRow>
              ) : (
                filteredLeaves.map(leave => (
                  <TableRow key={leave.id}>
                    <TableCell className='font-medium'>{leave.doctor.name}</TableCell>
                    <TableCell>{formatDate(leave.startDate)}</TableCell>
                    <TableCell>{formatDate(leave.endDate)}</TableCell>
                    <TableCell>{calculateDays(leave.startDate, leave.endDate)}</TableCell>
                    <TableCell>{leave.reason || '-'}</TableCell>
                    <TableCell>
                      <StatusBadge status={leave.status} />
                    </TableCell>
                    <TableCell>
                      {leave.status === 'pending' ? (
                        <div className='flex gap-2'>
                          <Button
                            variant='outline'
                            size='sm'
                            onClick={() => reviewMutation.mutate({ id: leave.id, status: 'approved' })}
                          >
                            <Check className='mr-1 h-3.5 w-3.5' />
                            Approve
                          </Button>
                          <Button
                            variant='outline'
                            size='sm'
                            onClick={() => reviewMutation.mutate({ id: leave.id, status: 'rejected' })}
                          >
                            <X className='mr-1 h-3.5 w-3.5' />
                            Reject
                          </Button>
                        </div>
                      ) : (
                        <span className='text-sm text-muted-foreground'>Reviewed</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Leave Request</DialogTitle>
          </DialogHeader>
          <div className='grid gap-4'>
            <div className='space-y-2'>
              <Label>Doctor</Label>
              <Select value={doctorId} onValueChange={setDoctorId}>
                <SelectTrigger>
                  <SelectValue placeholder='Select doctor' />
                </SelectTrigger>
                <SelectContent>
                  {doctors.map(doctor => (
                    <SelectItem key={doctor.id} value={doctor.id}>
                      {doctor.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className='grid gap-4 md:grid-cols-2'>
              <div className='space-y-2'>
                <Label>From</Label>
                <Input type='date' value={startDate} onChange={event => setStartDate(event.target.value)} />
              </div>
              <div className='space-y-2'>
                <Label>To</Label>
                <Input type='date' value={endDate} onChange={event => setEndDate(event.target.value)} />
              </div>
            </div>
            <div className='space-y-2'>
              <Label>Reason</Label>
              <Textarea value={reason} onChange={event => setReason(event.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant='outline' onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? 'Creating...' : 'Submit Leave'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
