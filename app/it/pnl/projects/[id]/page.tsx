'use client'

import { use, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api-client'
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
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

const SEAT_COST = 25000

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
    resourceName: string | null
    monthlyCost: number
    seatCostApplied: boolean
    allocationPercent: number
    paymentType: string
    oneTimeCost: number
    employee: { user: { name: string } } | null
    freelancer: { name: string } | null
  }[]
}

export default function ItProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { user } = useAuth()
  const can = user && canReadItPnl(user)
  const canWrite = user && canWriteItPnl(user)
  const qc = useQueryClient()

  // Booking state
  const [bookingOpen, setBookingOpen] = useState(false)
  const [editBookingId, setEditBookingId] = useState<string | null>(null)
  const [bk, setBk] = useState({ month: new Date().getMonth() + 1, year: new Date().getFullYear(), amount: '', notes: '' })

  // Resource state
  const [resOpen, setResOpen] = useState(false)
  const [editResId, setEditResId] = useState<string | null>(null)
  const [resForm, setResForm] = useState({
    resourceType: 'SALARIED' as 'SALARIED' | 'FREELANCE',
    resourceName: '',
    monthlyCost: '',
    seatCostApplied: false,
  })

  const { data: project, isLoading } = useQuery({
    queryKey: ['it-project', id],
    queryFn: () => apiGet<ProjectDetail>(`/api/it/projects/${id}`),
    enabled: !!can && !!id,
  })

  // --- Booking mutations ---
  const saveBooking = useMutation({
    mutationFn: () => {
      if (editBookingId) {
        return apiPatch('/api/it/project-bookings', {
          id: editBookingId,
          amount: parseFloat(bk.amount) || 0,
          notes: bk.notes || null,
        })
      }
      return apiPost('/api/it/project-bookings', {
        projectId: id,
        month: bk.month,
        year: bk.year,
        amount: parseFloat(bk.amount) || 0,
        notes: bk.notes || null,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['it-project', id] })
      qc.invalidateQueries({ queryKey: ['it-pnl-summary'] })
      toast.success(editBookingId ? 'Booking updated' : 'Booking saved')
      setBookingOpen(false)
      setEditBookingId(null)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const deleteBooking = useMutation({
    mutationFn: (bid: string) => apiDelete(`/api/it/project-bookings?id=${bid}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['it-project', id] })
      qc.invalidateQueries({ queryKey: ['it-pnl-summary'] })
      toast.success('Booking deleted')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  // --- Resource mutations ---
  const saveRes = useMutation({
    mutationFn: () => {
      const payload = {
        resourceType: resForm.resourceType,
        resourceName: resForm.resourceName,
        monthlyCost: parseFloat(resForm.monthlyCost) || 0,
        seatCostApplied: resForm.seatCostApplied,
      }
      if (editResId) {
        return apiPatch(`/api/it/projects/${id}/resources/${editResId}`, payload)
      }
      return apiPost(`/api/it/projects/${id}/resources`, payload)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['it-project', id] })
      toast.success(editResId ? 'Resource updated' : 'Resource added')
      setResOpen(false)
      setEditResId(null)
      setResForm({ resourceType: 'SALARIED', resourceName: '', monthlyCost: '', seatCostApplied: false })
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

  const totalBooked = project?.bookings.reduce((s, b) => s + b.amount, 0) ?? 0

  function resDisplayName(r: ProjectDetail['resources'][0]): string {
    return r.resourceName || r.employee?.user.name || r.freelancer?.name || '\u2014'
  }

  function openNewBooking() {
    setEditBookingId(null)
    setBk({ month: new Date().getMonth() + 1, year: new Date().getFullYear(), amount: '', notes: '' })
    setBookingOpen(true)
  }

  function openEditBooking(b: ProjectDetail['bookings'][0]) {
    setEditBookingId(b.id)
    setBk({ month: b.month, year: b.year, amount: String(b.amount), notes: '' })
    setBookingOpen(true)
  }

  function openNewResource() {
    setEditResId(null)
    setResForm({ resourceType: 'SALARIED', resourceName: '', monthlyCost: '', seatCostApplied: false })
    setResOpen(true)
  }

  function openEditResource(r: ProjectDetail['resources'][0]) {
    setEditResId(r.id)
    setResForm({
      resourceType: r.resourceType as 'SALARIED' | 'FREELANCE',
      resourceName: resDisplayName(r),
      monthlyCost: String(r.monthlyCost),
      seatCostApplied: r.seatCostApplied,
    })
    setResOpen(true)
  }

  return (
    <ProtectedRoute>
      <div className="space-y-6 p-4 md:p-6 w-full min-w-0">
        <Button variant="ghost" asChild>
          <Link href="/it/pnl?tab=projects">&larr; Projects</Link>
        </Button>

        {!can || isLoading || !project ? (
          <p className="text-muted-foreground">{!can ? 'No access' : 'Loading\u2026'}</p>
        ) : (
          <>
            <Card>
              <CardHeader>
                <div className="flex justify-between gap-4 flex-wrap">
                  <div>
                    <CardTitle className="text-2xl">{project.name}</CardTitle>
                    <p className="text-muted-foreground">{project.clientName || '\u2014'}</p>
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

              {/* ---- BOOKINGS TAB ---- */}
              <TabsContent value="bookings" className="mt-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Monthly bookings</CardTitle>
                    {canWrite && (
                      <Button size="sm" onClick={openNewBooking}><Plus className="h-4 w-4 mr-1" /> Add booking</Button>
                    )}
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Period</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          {canWrite && <TableHead className="w-[80px]" />}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {project.bookings.map((b) => (
                          <TableRow key={b.id}>
                            <TableCell>{b.month}/{b.year}</TableCell>
                            <TableCell className="text-right">{b.amount.toLocaleString('en-IN')}</TableCell>
                            {canWrite && (
                              <TableCell>
                                <div className="flex gap-1">
                                  <Button variant="ghost" size="icon" onClick={() => openEditBooking(b)}>
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-destructive hover:text-destructive"
                                    onClick={() => { if (confirm(`Delete booking ${b.month}/${b.year}?`)) deleteBooking.mutate(b.id) }}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                {/* Booking dialog */}
                <Dialog open={bookingOpen} onOpenChange={(o) => { setBookingOpen(o); if (!o) setEditBookingId(null) }}>
                  <DialogContent>
                    <DialogHeader><DialogTitle>{editBookingId ? 'Edit booking' : 'Add booking'}</DialogTitle></DialogHeader>
                    <div className="grid gap-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div><Label>Month</Label><Input type="number" min={1} max={12} value={bk.month} disabled={!!editBookingId} onChange={(e) => setBk((b) => ({ ...b, month: parseInt(e.target.value, 10) }))} /></div>
                        <div><Label>Year</Label><Input type="number" value={bk.year} disabled={!!editBookingId} onChange={(e) => setBk((b) => ({ ...b, year: parseInt(e.target.value, 10) }))} /></div>
                      </div>
                      <div><Label>Amount</Label><Input value={bk.amount} onChange={(e) => setBk((b) => ({ ...b, amount: e.target.value }))} /></div>
                      <div><Label>Notes</Label><Input value={bk.notes} onChange={(e) => setBk((b) => ({ ...b, notes: e.target.value }))} /></div>
                    </div>
                    <DialogFooter><Button onClick={() => saveBooking.mutate()}>{editBookingId ? 'Update' : 'Save'}</Button></DialogFooter>
                  </DialogContent>
                </Dialog>
              </TabsContent>

              {/* ---- RESOURCES TAB ---- */}
              <TabsContent value="resources" className="mt-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Allocated resources</CardTitle>
                    {canWrite && (
                      <Button size="sm" onClick={openNewResource}><Plus className="h-4 w-4 mr-1" /> Add resource</Button>
                    )}
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead className="text-right">Monthly Cost</TableHead>
                          <TableHead className="text-right">Seat Cost</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          {canWrite && <TableHead className="w-[80px]" />}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {project.resources.map((r) => {
                          const seat = r.seatCostApplied ? SEAT_COST : 0
                          return (
                            <TableRow key={r.id}>
                              <TableCell>{resDisplayName(r)}</TableCell>
                              <TableCell><Badge variant="outline">{r.resourceType}</Badge></TableCell>
                              <TableCell className="text-right">{r.monthlyCost.toLocaleString('en-IN')}</TableCell>
                              <TableCell className="text-right">{seat > 0 ? seat.toLocaleString('en-IN') : '\u2014'}</TableCell>
                              <TableCell className="text-right font-medium">{(r.monthlyCost + seat).toLocaleString('en-IN')}</TableCell>
                              {canWrite && (
                                <TableCell>
                                  <div className="flex gap-1">
                                    <Button variant="ghost" size="icon" onClick={() => openEditResource(r)}>
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="text-destructive hover:text-destructive"
                                      onClick={() => deleteRes.mutate(r.id)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              )}
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                {/* Resource dialog */}
                <Dialog open={resOpen} onOpenChange={(o) => { setResOpen(o); if (!o) setEditResId(null) }}>
                  <DialogContent className="max-w-md">
                    <DialogHeader><DialogTitle>{editResId ? 'Edit resource' : 'Add resource'}</DialogTitle></DialogHeader>
                    <div className="space-y-4 mt-2">
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant={resForm.resourceType === 'SALARIED' ? 'default' : 'outline'}
                          className="flex-1"
                          onClick={() => setResForm((f) => ({ ...f, resourceType: 'SALARIED' }))}
                        >
                          Salaried
                        </Button>
                        <Button
                          type="button"
                          variant={resForm.resourceType === 'FREELANCE' ? 'default' : 'outline'}
                          className="flex-1"
                          onClick={() => setResForm((f) => ({ ...f, resourceType: 'FREELANCE' }))}
                        >
                          Freelance
                        </Button>
                      </div>
                      <div>
                        <Label>Name</Label>
                        <Input
                          placeholder="Resource name"
                          value={resForm.resourceName}
                          onChange={(e) => setResForm((f) => ({ ...f, resourceName: e.target.value }))}
                        />
                      </div>
                      <div>
                        <Label>Monthly Cost (INR)</Label>
                        <Input
                          type="number"
                          placeholder="0"
                          value={resForm.monthlyCost}
                          onChange={(e) => setResForm((f) => ({ ...f, monthlyCost: e.target.value }))}
                        />
                      </div>
                      <div className="flex items-center justify-between rounded-md border p-3">
                        <div>
                          <p className="text-sm font-medium">Apply seat cost</p>
                          <p className="text-xs text-muted-foreground">+{SEAT_COST.toLocaleString('en-IN')}/mo</p>
                        </div>
                        <Switch
                          checked={resForm.seatCostApplied}
                          onCheckedChange={(v) => setResForm((f) => ({ ...f, seatCostApplied: v }))}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button onClick={() => saveRes.mutate()} disabled={!resForm.resourceName.trim()}>
                        {editResId ? 'Update' : 'Add'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </ProtectedRoute>
  )
}
