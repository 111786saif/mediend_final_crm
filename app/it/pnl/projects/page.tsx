'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost } from '@/lib/api-client'
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
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

type Project = {
  id: string
  name: string
  clientName: string | null
  projectValue: number
  billingType: string
  status: string
  _count: { resources: number; bookings: number }
}

export default function ItProjectsPage() {
  const { user } = useAuth()
  const can = user && canReadItPnl(user)
  const canWrite = user && canWriteItPnl(user)
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    name: '',
    clientName: '',
    description: '',
    projectValue: '0',
    billingType: 'MONTHLY',
    monthlyBilling: '',
    status: 'ACTIVE',
  })

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['it-projects'],
    queryFn: () => apiGet<Project[]>('/api/it/projects'),
    enabled: !!can,
  })

  const createMut = useMutation({
    mutationFn: () =>
      apiPost<Project>('/api/it/projects', {
        name: form.name,
        clientName: form.clientName || null,
        description: form.description || null,
        projectValue: parseFloat(form.projectValue) || 0,
        billingType: form.billingType,
        monthlyBilling: form.monthlyBilling ? parseFloat(form.monthlyBilling) : null,
        status: form.status,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['it-projects'] })
      toast.success('Project created')
      setOpen(false)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <ProtectedRoute>
      <div className="space-y-6 p-4 md:p-6 w-full min-w-0">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">IT Projects</h1>
            <Button variant="link" className="p-0 h-auto" asChild><Link href="/it/pnl">← IT P&amp;L</Link></Button>
          </div>
          {canWrite && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-1" /> New project</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>New project</DialogTitle></DialogHeader>
                <div className="grid gap-3">
                  <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></div>
                  <div><Label>Client</Label><Input value={form.clientName} onChange={(e) => setForm((f) => ({ ...f, clientName: e.target.value }))} /></div>
                  <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label>Value</Label><Input value={form.projectValue} onChange={(e) => setForm((f) => ({ ...f, projectValue: e.target.value }))} /></div>
                    <div>
                      <Label>Billing</Label>
                      <Select value={form.billingType} onValueChange={(v) => setForm((f) => ({ ...f, billingType: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="MONTHLY">Monthly</SelectItem>
                          <SelectItem value="FIXED">Fixed</SelectItem>
                          <SelectItem value="MILESTONE">Milestone</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div><Label>Monthly billing (optional)</Label><Input value={form.monthlyBilling} onChange={(e) => setForm((f) => ({ ...f, monthlyBilling: e.target.value }))} /></div>
                </div>
                <DialogFooter>
                  <Button onClick={() => createMut.mutate()} disabled={!form.name.trim()}>Create</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {!can ? (
          <Card><CardContent className="pt-6">No access</CardContent></Card>
        ) : isLoading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : (
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Resources</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projects.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell>{p.clientName || '—'}</TableCell>
                      <TableCell>{p.projectValue.toLocaleString('en-IN')}</TableCell>
                      <TableCell><Badge variant="secondary">{p.status}</Badge></TableCell>
                      <TableCell>{p._count.resources}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline" asChild>
                          <Link href={`/it/pnl/projects/${p.id}`}>Open</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </ProtectedRoute>
  )
}
