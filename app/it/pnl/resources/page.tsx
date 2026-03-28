'use client'

import { useState } from 'react'
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
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { Plus, Pencil } from 'lucide-react'

type Freelancer = {
  id: string
  name: string
  email: string | null
  phone: string | null
  skill: string | null
  isActive: boolean
}

export default function ItResourcesPage() {
  const { user } = useAuth()
  const can = user && canReadItPnl(user)
  const canWrite = user && canWriteItPnl(user)
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [edit, setEdit] = useState<Freelancer | null>(null)
  const [form, setForm] = useState({ name: '', email: '', phone: '', skill: '' })

  const { data: freelancers = [], isLoading } = useQuery({
    queryKey: ['it-freelancers'],
    queryFn: () => apiGet<Freelancer[]>('/api/it/freelancers'),
    enabled: !!can,
  })

  const saveMut = useMutation({
    mutationFn: async () => {
      if (edit) {
        return apiPatch(`/api/it/freelancers/${edit.id}`, {
          name: form.name,
          email: form.email || null,
          phone: form.phone || null,
          skill: form.skill || null,
        })
      }
      return apiPost('/api/it/freelancers', {
        name: form.name,
        email: form.email || null,
        phone: form.phone || null,
        skill: form.skill || null,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['it-freelancers'] })
      toast.success(edit ? 'Updated' : 'Created')
      setOpen(false)
      setEdit(null)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <ProtectedRoute>
      <div className="space-y-6 p-4 md:p-6 w-full min-w-0">
        <Button variant="ghost" asChild><Link href="/it/pnl">← IT P&amp;L</Link></Button>
        <h1 className="text-2xl font-bold">IT Resources</h1>

        {!can ? (
          <Card><CardContent className="pt-6">No access</CardContent></Card>
        ) : (
          <Tabs defaultValue="freelancers">
            <TabsList>
              <TabsTrigger value="freelancers">Freelancers</TabsTrigger>
              <TabsTrigger value="salaried">Salaried (by project)</TabsTrigger>
            </TabsList>
            <TabsContent value="freelancers" className="mt-4">
              <Card>
                <CardHeader className="flex flex-row justify-between items-center">
                  <CardTitle>Freelancer directory</CardTitle>
                  {canWrite && (
                    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEdit(null) }}>
                      <Button
                        size="sm"
                        onClick={() => {
                          setEdit(null)
                          setForm({ name: '', email: '', phone: '', skill: '' })
                          setOpen(true)
                        }}
                      >
                        <Plus className="h-4 w-4 mr-1" /> Add
                      </Button>
                      <DialogContent>
                        <DialogHeader><DialogTitle>{edit ? 'Edit' : 'New'} freelancer</DialogTitle></DialogHeader>
                        <div className="grid gap-2">
                          <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></div>
                          <div><Label>Email</Label><Input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} /></div>
                          <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} /></div>
                          <div><Label>Skill</Label><Input value={form.skill} onChange={(e) => setForm((f) => ({ ...f, skill: e.target.value }))} /></div>
                        </div>
                        <DialogFooter><Button onClick={() => saveMut.mutate()}>Save</Button></DialogFooter>
                      </DialogContent>
                    </Dialog>
                  )}
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <p className="text-muted-foreground">Loading…</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Skill</TableHead>
                          <TableHead>Active</TableHead>
                          {canWrite && <TableHead />}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {freelancers.map((f) => (
                          <TableRow key={f.id}>
                            <TableCell>{f.name}</TableCell>
                            <TableCell>{f.email || '—'}</TableCell>
                            <TableCell>{f.skill || '—'}</TableCell>
                            <TableCell>{f.isActive ? 'Yes' : 'No'}</TableCell>
                            {canWrite && (
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    setEdit(f)
                                    setForm({ name: f.name, email: f.email || '', phone: f.phone || '', skill: f.skill || '' })
                                    setOpen(true)
                                  }}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="salaried" className="mt-4">
              <Card>
                <CardHeader><CardTitle>Salaried allocations</CardTitle></CardHeader>
                <CardContent className="text-muted-foreground text-sm">
                  Salaried employees are allocated per project with a % split. Open a{' '}
                  <Link href="/it/pnl/projects" className="text-primary underline">project</Link> to add or edit
                  salaried resources.
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </ProtectedRoute>
  )
}
