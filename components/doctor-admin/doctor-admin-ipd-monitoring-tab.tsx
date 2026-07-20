'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { apiGet, apiPut } from '@/lib/api-client'
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatDate, StatusBadge } from '@/components/doctor-admin/shared'
import { DoctorAdminIpdItem } from '@/components/doctor-admin/types'

type IpdTab = 'active' | 'dischargeQueue' | 'completed' | 'noShow' | 'cancelled'

export function DoctorAdminIpdMonitoringTab() {
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<IpdTab>('active')
  const [transferTarget, setTransferTarget] = useState<DoctorAdminIpdItem | null>(null)
  const [cancelTarget, setCancelTarget] = useState<DoctorAdminIpdItem | null>(null)
  const [hospitalName, setHospitalName] = useState('')
  const [reason, setReason] = useState('')

  const ipdQuery = useQuery({
    queryKey: ['doctor-admin', 'ipd-monitoring'],
    queryFn: () =>
      apiGet<{
        active: DoctorAdminIpdItem[]
        dischargeQueue: DoctorAdminIpdItem[]
        completed: DoctorAdminIpdItem[]
        noShow: DoctorAdminIpdItem[]
        cancelled: DoctorAdminIpdItem[]
      }>('/api/doctor-admin/ipd-monitoring'),
  })

  const lists = useMemo(
    () =>
      ipdQuery.data || {
        active: [],
        dischargeQueue: [],
        completed: [],
        noShow: [],
        cancelled: [],
      },
    [ipdQuery.data]
  )

  const displayed = useMemo(() => {
    if (tab === 'dischargeQueue') return lists.dischargeQueue
    if (tab === 'completed') return lists.completed
    if (tab === 'noShow') return lists.noShow
    if (tab === 'cancelled') return lists.cancelled
    return lists.active
  }, [lists, tab])

  const markAdmittedMutation = useMutation({
    mutationFn: (leadId: string) => apiPut(`/api/doctor-admin/ipd-monitoring/${leadId}/mark-admitted`, {}),
    onSuccess: () => {
      toast.success('IPD case marked admitted')
      queryClient.invalidateQueries({ queryKey: ['doctor-admin', 'ipd-monitoring'] })
    },
    onError: error => {
      toast.error(error.message || 'Failed to mark admitted')
    },
  })

  const transferMutation = useMutation({
    mutationFn: () =>
      apiPut(`/api/doctor-admin/ipd-monitoring/${transferTarget?.id}/transfer`, {
        hospitalName,
        reason,
      }),
    onSuccess: () => {
      toast.success('IPD case transferred')
      setTransferTarget(null)
      setHospitalName('')
      setReason('')
      queryClient.invalidateQueries({ queryKey: ['doctor-admin', 'ipd-monitoring'] })
    },
    onError: error => {
      toast.error(error.message || 'Failed to transfer case')
    },
  })

  const cancelMutation = useMutation({
    mutationFn: () =>
      apiPut(`/api/doctor-admin/ipd-monitoring/${cancelTarget?.id}/cancel`, {
        reason,
      }),
    onSuccess: () => {
      toast.success('IPD case cancelled')
      setCancelTarget(null)
      setReason('')
      queryClient.invalidateQueries({ queryKey: ['doctor-admin', 'ipd-monitoring'] })
    },
    onError: error => {
      toast.error(error.message || 'Failed to cancel case')
    },
  })

  return (
    <div className='space-y-6'>
      <div>
        <h2 className='text-2xl font-semibold tracking-tight'>IPD Monitoring</h2>
        <p className='text-sm text-muted-foreground'>Monitor active admissions, discharges, and outcomes</p>
      </div>

      <Tabs value={tab} onValueChange={value => setTab(value as IpdTab)}>
        <TabsList>
          <TabsTrigger value='active'>Active IPDs ({lists.active.length})</TabsTrigger>
          <TabsTrigger value='dischargeQueue'>Discharge Queue ({lists.dischargeQueue.length})</TabsTrigger>
          <TabsTrigger value='completed'>Completed ({lists.completed.length})</TabsTrigger>
          <TabsTrigger value='noShow'>No Show ({lists.noShow.length})</TabsTrigger>
          <TabsTrigger value='cancelled'>Cancelled ({lists.cancelled.length})</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardContent className='p-0'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Patient</TableHead>
                <TableHead>Doctor</TableHead>
                <TableHead>Hospital</TableHead>
                <TableHead>Admission</TableHead>
                <TableHead>OT Date</TableHead>
                <TableHead>Coordinator</TableHead>
                <TableHead>Team Member</TableHead>
                <TableHead>Implant</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ipdQuery.isLoading ? (
                <TableRow>
                  <TableCell colSpan={10} className='py-10 text-center text-muted-foreground'>
                    Loading...
                  </TableCell>
                </TableRow>
              ) : displayed.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className='py-10 text-center text-muted-foreground'>
                    No IPD records found
                  </TableCell>
                </TableRow>
              ) : (
                displayed.map(item => (
                  <TableRow key={item.id}>
                    <TableCell className='font-medium'>{item.patientName}</TableCell>
                    <TableCell>{item.doctorName}</TableCell>
                    <TableCell>{item.hospitalName}</TableCell>
                    <TableCell>{formatDate(item.admissionDate)}</TableCell>
                    <TableCell>{formatDate(item.otDate)}</TableCell>
                    <TableCell>{item.coordinatorName || '-'}</TableCell>
                    <TableCell>{item.teamMemberName || '-'}</TableCell>
                    <TableCell>{item.implant || '-'}</TableCell>
                    <TableCell>
                      <StatusBadge status={item.status.replace(/_/g, ' ')} />
                    </TableCell>
                    <TableCell>
                      {item.status === 'active' ? (
                        <div className='flex gap-2'>
                          <Button
                            variant='outline'
                            size='sm'
                            onClick={() => markAdmittedMutation.mutate(item.id)}
                          >
                            Mark Admitted
                          </Button>
                          <Button
                            variant='outline'
                            size='sm'
                            onClick={() => {
                              setTransferTarget(item)
                              setHospitalName(item.hospitalName)
                              setReason('')
                            }}
                          >
                            Transfer
                          </Button>
                          <Button
                            variant='outline'
                            size='sm'
                            onClick={() => {
                              setCancelTarget(item)
                              setReason(item.statusReason || '')
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <span className='text-sm text-muted-foreground'>No actions</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!transferTarget} onOpenChange={value => !value && setTransferTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer IPD Case</DialogTitle>
          </DialogHeader>
          <div className='grid gap-4'>
            <div className='space-y-2'>
              <Label>Hospital Name</Label>
              <Input value={hospitalName} onChange={event => setHospitalName(event.target.value)} />
            </div>
            <div className='space-y-2'>
              <Label>Reason</Label>
              <Input value={reason} onChange={event => setReason(event.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant='outline' onClick={() => setTransferTarget(null)}>
              Cancel
            </Button>
            <Button onClick={() => transferMutation.mutate()} disabled={transferMutation.isPending}>
              {transferMutation.isPending ? 'Saving...' : 'Transfer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!cancelTarget} onOpenChange={value => !value && setCancelTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel IPD Case</DialogTitle>
          </DialogHeader>
          <div className='space-y-2'>
            <Label>Reason</Label>
            <Input value={reason} onChange={event => setReason(event.target.value)} />
          </div>
          <DialogFooter>
            <Button variant='outline' onClick={() => setCancelTarget(null)}>
              Close
            </Button>
            <Button onClick={() => cancelMutation.mutate()} disabled={cancelMutation.isPending}>
              {cancelMutation.isPending ? 'Saving...' : 'Cancel Case'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
