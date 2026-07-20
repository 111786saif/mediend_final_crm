'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, UserPlus, X } from 'lucide-react'
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
import { formatDateTime, StatusBadge } from '@/components/doctor-admin/shared'
import { DoctorAdminCabItem } from '@/components/doctor-admin/types'

type CabTab = 'pending' | 'approved' | 'completed' | 'rejected'

export function DoctorAdminCabRequestsTab() {
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<CabTab>('pending')
  const [vendorDialogOpen, setVendorDialogOpen] = useState(false)
  const [selected, setSelected] = useState<DoctorAdminCabItem | null>(null)
  const [vendorName, setVendorName] = useState('')
  const [vendorPhone, setVendorPhone] = useState('')

  const cabQuery = useQuery({
    queryKey: ['doctor-admin', 'cab-requests'],
    queryFn: () =>
      apiGet<{ items: DoctorAdminCabItem[]; pagination: { total: number } }>(
        '/api/doctor-admin/cab-requests?limit=200'
      ),
  })

  const items = useMemo(() => cabQuery.data?.items ?? [], [cabQuery.data?.items])
  const filteredItems = useMemo(() => items.filter(item => item.status === tab), [items, tab])

  const reviewMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'approved' | 'rejected' | 'completed' }) =>
      apiPut<{ item: DoctorAdminCabItem }>(`/api/doctor-admin/cab-requests/${id}/review`, {
        status,
      }),
    onSuccess: (_, variables) => {
      toast.success(`Cab request ${variables.status}`)
      queryClient.invalidateQueries({ queryKey: ['doctor-admin', 'cab-requests'] })
    },
    onError: error => {
      toast.error(error.message || 'Failed to review cab request')
    },
  })

  const vendorMutation = useMutation({
    mutationFn: () =>
      apiPut<{ item: DoctorAdminCabItem }>(
        `/api/doctor-admin/cab-requests/${selected?.id}/assign-vendor`,
        {
          vendorName,
          vendorPhone,
        }
      ),
    onSuccess: () => {
      toast.success('Vendor assigned')
      setVendorDialogOpen(false)
      setSelected(null)
      setVendorName('')
      setVendorPhone('')
      queryClient.invalidateQueries({ queryKey: ['doctor-admin', 'cab-requests'] })
    },
    onError: error => {
      toast.error(error.message || 'Failed to assign vendor')
    },
  })

  const tabCounts = {
    pending: items.filter(item => item.status === 'pending').length,
    approved: items.filter(item => item.status === 'approved').length,
    completed: items.filter(item => item.status === 'completed').length,
    rejected: items.filter(item => item.status === 'rejected').length,
  }

  return (
    <div className='space-y-6'>
      <div>
        <h2 className='text-2xl font-semibold tracking-tight'>Cab Requests</h2>
        <p className='text-sm text-muted-foreground'>Manage doctor cab/transport requests</p>
      </div>

      <Tabs value={tab} onValueChange={value => setTab(value as CabTab)}>
        <TabsList>
          <TabsTrigger value='pending'>Pending ({tabCounts.pending})</TabsTrigger>
          <TabsTrigger value='approved'>Approved ({tabCounts.approved})</TabsTrigger>
          <TabsTrigger value='completed'>Completed ({tabCounts.completed})</TabsTrigger>
          <TabsTrigger value='rejected'>Rejected ({tabCounts.rejected})</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardContent className='p-0'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Doctor</TableHead>
                <TableHead>Pickup</TableHead>
                <TableHead>Drop</TableHead>
                <TableHead>Scheduled For</TableHead>
                <TableHead>Requested At</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cabQuery.isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className='py-10 text-center text-muted-foreground'>
                    Loading...
                  </TableCell>
                </TableRow>
              ) : filteredItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className='py-10 text-center text-muted-foreground'>
                    No cab requests found
                  </TableCell>
                </TableRow>
              ) : (
                filteredItems.map(item => (
                  <TableRow key={item.id}>
                    <TableCell className='font-medium'>{item.doctor.name}</TableCell>
                    <TableCell>{item.pickup}</TableCell>
                    <TableCell>{item.drop}</TableCell>
                    <TableCell>{formatDateTime(item.scheduledFor)}</TableCell>
                    <TableCell>{formatDateTime(item.createdAt)}</TableCell>
                    <TableCell>
                      {item.vendorName ? (
                        <div>
                          <div>{item.vendorName}</div>
                          <div className='text-xs text-muted-foreground'>{item.vendorPhone || '-'}</div>
                        </div>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={item.status} />
                    </TableCell>
                    <TableCell>
                      {item.status === 'pending' ? (
                        <div className='flex gap-2'>
                          <Button
                            variant='outline'
                            size='sm'
                            onClick={() => reviewMutation.mutate({ id: item.id, status: 'approved' })}
                          >
                            <Check className='mr-1 h-3.5 w-3.5' />
                            Approve
                          </Button>
                          <Button
                            variant='outline'
                            size='sm'
                            onClick={() => reviewMutation.mutate({ id: item.id, status: 'rejected' })}
                          >
                            <X className='mr-1 h-3.5 w-3.5' />
                            Reject
                          </Button>
                        </div>
                      ) : item.status === 'approved' ? (
                        <div className='flex gap-2'>
                          <Button
                            variant='outline'
                            size='sm'
                            onClick={() => {
                              setSelected(item)
                              setVendorName(item.vendorName || '')
                              setVendorPhone(item.vendorPhone || '')
                              setVendorDialogOpen(true)
                            }}
                          >
                            <UserPlus className='mr-1 h-3.5 w-3.5' />
                            {item.vendorName ? 'Change Vendor' : 'Assign Vendor'}
                          </Button>
                          <Button
                            variant='outline'
                            size='sm'
                            onClick={() => reviewMutation.mutate({ id: item.id, status: 'completed' })}
                          >
                            Mark Completed
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

      <Dialog open={vendorDialogOpen} onOpenChange={setVendorDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Vendor</DialogTitle>
          </DialogHeader>
          <div className='grid gap-4'>
            <div className='space-y-2'>
              <Label>Vendor Name</Label>
              <Input value={vendorName} onChange={event => setVendorName(event.target.value)} />
            </div>
            <div className='space-y-2'>
              <Label>Vendor Phone</Label>
              <Input value={vendorPhone} onChange={event => setVendorPhone(event.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant='outline' onClick={() => setVendorDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => vendorMutation.mutate()} disabled={vendorMutation.isPending}>
              {vendorMutation.isPending ? 'Saving...' : 'Save Vendor'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
