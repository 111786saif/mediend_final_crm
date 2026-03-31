'use client'

import { use, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost, apiDelete } from '@/lib/api-client'
import { useAuth } from '@/hooks/use-auth'
import { canReadItPnl, canWriteItPnl } from '@/lib/pnl/auth-it-pnl'
import { ProtectedRoute } from '@/components/protected-route'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Plus, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

type ProjectDetail = {
  id: string
  name: string
  clientName: string | null
  projectValue: number
  status: string
  bookings: { id: string; month: number; year: number; amount: number }[]
  resources: {
    id: string
    resourceType: string
    allocationPercent: number
    paymentType: string
    monthlyCost: number
    oneTimeCost: number
    employee: { user: { name: string } } | null
    freelancer: { name: string } | null
  }[]
}

type Employee = { id: string; salary: number | null; user: { name: string; email: string } }
type Freelancer = { id: string; name: string }

export default function ItProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { user } = useAuth()
  const can = user && canReadItPnl(user)
  const canWrite = user && canWriteItPnl(user)
  const qc = useQueryClient()

  const [bookingOpen, setBookingOpen] = useState(false)
  const [bk, setBk] = useState({ month: new Date().getMonth() + 1, year: new Date().getFullYear(), amount: '', notes: '' })

  const [resOpen, setResOpen] = useState(false)
  const [resTab, setResTab] = useState<'sal' | 'free'>('sal')
  const [resForm, setResForm] = useState({
    employeeId: '',
    freelancerId: '',
    allocationPercent: '100',
    paymentType: 'MONTHLY',
    monthlyCost: '',
    oneTimeCost: '',
  })

  const { data: project, isLoading } = useQuery({
    queryKey: ['it-project', id],
    queryFn: () => apiGet<ProjectDetail>(`/api/it/projects/${id}`),
    enabled: !!can && !!id,
  })

  const { data: employees = [] } = useQuery({
    queryKey: ['employees-it'],
    queryFn: () => apiGet<Employee[]>('/api/employees?status=ACTIVE'),
    enabled: !!canWrite && resOpen,
  })

  const { data: freelancers = [] } = useQuery({
    queryKey: ['it-freelancers'],
    queryFn: () => apiGet<Freelancer[]>('/api/it/freelancers'),
    enabled: !!canWrite && resOpen,
  })

  const bookingMut = useMutation({
    mutationFn: () =>
      apiPost('/api/it/project-bookings', {
        projectId: id,
        month: bk.month,
        year: bk.year,
        amount: parseFloat(bk.amount) || 0,
        notes: bk.notes || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['it-project', id] })
      qc.invalidateQueries({ queryKey: ['it-pnl-summary'] })
      toast.success('Booking saved')
      setBookingOpen(false)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const deleteRes = useMutation({
    mutationFn: (rid: string) => apiDelete(`/api/it/projects/${id}/resources/${rid}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['it-project', id] })
      toast.success('Removed')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const addRes = useMutation({
    mutationFn: () =>
      apiPost(`/api/it/projects/${id}/resources`, {
        resourceType: resTab === 'sal' ? 'SALARIED' : 'FREELANCE',
        employeeId: resTab === 'sal' ? resForm.employeeId : undefined,
        freelancerId: resTab === 'free' ? resForm.freelancerId : undefined,
        allocationPercent: parseFloat(resForm.allocationPercent) || 0,
        paymentType: resForm.paymentType,
        monthlyCost: parseFloat(resForm.monthlyCost) || 0,
        oneTimeCost: parseFloat(resForm.oneTimeCost) || 0,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['it-project', id] })
      toast.success('Resource added')
      setResOpen(false)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const totalBooked = project?.bookings.reduce((s, b) => s + b.amount, 0) ?? 0

  return (
    <ProtectedRoute>
      <div className="space-y-6 p-4 md:p-6 w-full min-w-0">
        <Button variant="ghost" asChild>
          <Link href="/it/pnl?tab=projects">← Projects</Link>
        </Button>

        {!can || isLoading || !project ? (
          <p className="text-muted-foreground">{!can ? 'No access' : 'Loading…'}</p>
        ) : (
          <>
            <Card>
              <CardHeader>
                <div className="flex justify-between gap-4 flex-wrap">
                  <div>
                    <CardTitle className="text-2xl">{project.name}</CardTitle>
                    <p className="text-muted-foreground">{project.clientName || '—'}</p>
                  </div>
                  <Badge>{project.status}</Badge>
                </div>
              </CardHeader>
              <CardContent className="grid sm:grid-cols-2 gap-4 text-sm">
                <p>Contract value: <strong>{project.projectValue.toLocaleString('en-IN')}</strong></p>
                <p>Booked (all months): <strong>{totalBooked.toLocaleString('en-IN')}</strong></p>
              </CardContent>
            </Card>

            <Tabs defaultValue="bookings">
              <TabsList>
                <TabsTrigger value="bookings">Revenue bookings</TabsTrigger>
                <TabsTrigger value="resources">Resources</TabsTrigger>
              </TabsList>
              <TabsContent value="bookings" className="mt-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Monthly bookings</CardTitle>
                    {canWrite && (
                      <Dialog open={bookingOpen} onOpenChange={setBookingOpen}>
                        <DialogTrigger asChild>
                          <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add booking</Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader><DialogTitle>Booking</DialogTitle></DialogHeader>
                          <div className="grid gap-2">
                            <div className="grid grid-cols-2 gap-2">
                              <div><Label>Month</Label><Input type="number" min={1} max={12} value={bk.month} onChange={(e) => setBk((b) => ({ ...b, month: parseInt(e.target.value, 10) }))} /></div>
                              <div><Label>Year</Label><Input type="number" value={bk.year} onChange={(e) => setBk((b) => ({ ...b, year: parseInt(e.target.value, 10) }))} /></div>
                            </div>
                            <div><Label>Amount</Label><Input value={bk.amount} onChange={(e) => setBk((b) => ({ ...b, amount: e.target.value }))} /></div>
                            <div><Label>Notes</Label><Input value={bk.notes} onChange={(e) => setBk((b) => ({ ...b, notes: e.target.value }))} /></div>
                          </div>
                          <DialogFooter><Button onClick={() => bookingMut.mutate()}>Save</Button></DialogFooter>
                        </DialogContent>
                      </Dialog>
                    )}
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow><TableHead>Period</TableHead><TableHead className="text-right">Amount</TableHead></TableRow>
                      </TableHeader>
                      <TableBody>
                        {project.bookings.map((b) => (
                          <TableRow key={b.id}>
                            <TableCell>{b.month}/{b.year}</TableCell>
                            <TableCell className="text-right">{b.amount.toLocaleString('en-IN')}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="resources" className="mt-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Allocated resources</CardTitle>
                    {canWrite && (
                      <Dialog open={resOpen} onOpenChange={setResOpen}>
                        <DialogTrigger asChild>
                          <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add resource</Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md">
                          <DialogHeader><DialogTitle>Add resource</DialogTitle></DialogHeader>
                          <Tabs value={resTab} onValueChange={(v) => setResTab(v as 'sal' | 'free')}>
                            <TabsList className="grid w-full grid-cols-2">
                              <TabsTrigger value="sal">Salaried</TabsTrigger>
                              <TabsTrigger value="free">Freelance</TabsTrigger>
                            </TabsList>
                            <TabsContent value="sal" className="space-y-3 mt-4">
                              <div>
                                <Label>Employee</Label>
                                <Select value={resForm.employeeId} onValueChange={(v) => setResForm((f) => ({ ...f, employeeId: v }))}>
                                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                                  <SelectContent>
                                    {employees.map((e) => (
                                      <SelectItem key={e.id} value={e.id}>{e.user.name} ({e.salary?.toLocaleString('en-IN') ?? '—'})</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div><Label>Allocation %</Label><Input value={resForm.allocationPercent} onChange={(e) => setResForm((f) => ({ ...f, allocationPercent: e.target.value }))} /></div>
                            </TabsContent>
                            <TabsContent value="free" className="space-y-3 mt-4">
                              <div>
                                <Label>Freelancer</Label>
                                <Select value={resForm.freelancerId} onValueChange={(v) => setResForm((f) => ({ ...f, freelancerId: v }))}>
                                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                                  <SelectContent>
                                    {freelancers.map((f) => (
                                      <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label>Payment</Label>
                                <Select value={resForm.paymentType} onValueChange={(v) => setResForm((f) => ({ ...f, paymentType: v }))}>
                                  <SelectTrigger><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="MONTHLY">Monthly</SelectItem>
                                    <SelectItem value="ONE_TIME">One-time</SelectItem>
                                    <SelectItem value="BOTH">Both</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div><Label>Monthly cost</Label><Input value={resForm.monthlyCost} onChange={(e) => setResForm((f) => ({ ...f, monthlyCost: e.target.value }))} /></div>
                              <div><Label>One-time cost</Label><Input value={resForm.oneTimeCost} onChange={(e) => setResForm((f) => ({ ...f, oneTimeCost: e.target.value }))} /></div>
                            </TabsContent>
                          </Tabs>
                          <DialogFooter><Button onClick={() => addRes.mutate()}>Add</Button></DialogFooter>
                        </DialogContent>
                      </Dialog>
                    )}
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>%</TableHead>
                          <TableHead>Pay</TableHead>
                          <TableHead className="text-right">Monthly / Once</TableHead>
                          {canWrite && <TableHead />}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {project.resources.map((r) => (
                          <TableRow key={r.id}>
                            <TableCell>{r.employee?.user.name ?? r.freelancer?.name}</TableCell>
                            <TableCell><Badge variant="outline">{r.resourceType}</Badge></TableCell>
                            <TableCell>{r.allocationPercent}</TableCell>
                            <TableCell>{r.paymentType}</TableCell>
                            <TableCell className="text-right">{r.monthlyCost} / {r.oneTimeCost}</TableCell>
                            {canWrite && (
                              <TableCell>
                                <Button variant="ghost" size="icon" onClick={() => deleteRes.mutate(r.id)}>
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </ProtectedRoute>
  )
}
