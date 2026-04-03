'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api-client'
import { useAuth } from '@/hooks/use-auth'
import { canReadItPnl, canWriteItPnl } from '@/lib/pnl/auth-it-pnl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

type Freelancer = {
  id: string
  name: string
  email: string | null
  phone: string | null
  skill: string | null
  isActive: boolean
}

export function ItPnlResourcesPanel() {
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

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiDelete(`/api/it/freelancers/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['it-freelancers'] })
      toast.success('Freelancer deleted')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  if (!can) {
    return (
      <Card>
        <CardContent className="pt-6 text-muted-foreground">No access</CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
          <Users className="h-5 w-5 text-violet-600" />
          Resources
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Freelancer pool and guidance for salaried allocations per project.
        </p>
      </div>

      <Tabs defaultValue="freelancers" className="w-full">
        <TabsList className="rounded-xl bg-muted/60 p-1 h-auto flex-wrap">
          <TabsTrigger value="freelancers" className="rounded-lg data-[state=active]:shadow-sm">
            Freelancers
          </TabsTrigger>
          <TabsTrigger value="salaried" className="rounded-lg data-[state=active]:shadow-sm">
            Salaried (by project)
          </TabsTrigger>
        </TabsList>
        <TabsContent value="freelancers" className="mt-4 space-y-4">
          <Card className="rounded-2xl border shadow-sm overflow-hidden">
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-violet-500/8 to-fuchsia-500/8 border-b">
              <div>
                <CardTitle className="text-base">Freelancer directory</CardTitle>
                <CardDescription>People available for project assignments</CardDescription>
              </div>
              {canWrite && (
                <Button
                  size="sm"
                  className="rounded-xl"
                  onClick={() => {
                    setEdit(null)
                    setForm({ name: '', email: '', phone: '', skill: '' })
                    setOpen(true)
                  }}
                >
                  <Plus className="h-4 w-4 mr-1" /> Add freelancer
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <p className="p-6 text-muted-foreground text-sm">Loading…</p>
              ) : freelancers.length === 0 ? (
                <p className="p-8 text-center text-sm text-muted-foreground">
                  No freelancers yet. {canWrite ? 'Add one to get started.' : ''}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Skill</TableHead>
                        <TableHead>Active</TableHead>
                        {canWrite && <TableHead className="w-[52px]" />}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {freelancers.map((f) => (
                        <TableRow key={f.id} className="group">
                          <TableCell className="font-medium">{f.name}</TableCell>
                          <TableCell className="text-muted-foreground">{f.email || '—'}</TableCell>
                          <TableCell className="tabular-nums text-muted-foreground">
                            {f.phone || '—'}
                          </TableCell>
                          <TableCell>{f.skill || '—'}</TableCell>
                          <TableCell>
                            <Badge variant={f.isActive ? 'default' : 'secondary'} className="rounded-full">
                              {f.isActive ? 'Yes' : 'No'}
                            </Badge>
                          </TableCell>
                          {canWrite && (
                            <TableCell>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="rounded-full opacity-70 group-hover:opacity-100"
                                  onClick={() => {
                                    setEdit(f)
                                    setForm({
                                      name: f.name,
                                      email: f.email || '',
                                      phone: f.phone || '',
                                      skill: f.skill || '',
                                    })
                                    setOpen(true)
                                  }}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="rounded-full opacity-70 group-hover:opacity-100 text-destructive hover:text-destructive"
                                  onClick={() => { if (confirm(`Delete "${f.name}"?`)) deleteMut.mutate(f.id) }}
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
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="salaried" className="mt-4">
          <Card className="rounded-2xl border-dashed border-2">
            <CardHeader>
              <CardTitle className="text-base">Salaried allocations</CardTitle>
              <CardDescription>
                Salaried employees use a % split per project. Open any project to add or edit
                allocations.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="rounded-xl" asChild>
                <Link href="/it/pnl?tab=projects">Browse projects</Link>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Sheet
        open={open}
        onOpenChange={(o) => {
          setOpen(o)
          if (!o) setEdit(null)
        }}
      >
        <SheetContent className="w-full sm:max-w-md overflow-y-auto border-l-2 border-violet-200/60">
          <SheetHeader className="text-left border-b pb-4 bg-gradient-to-br from-violet-500/10 to-fuchsia-500/5 -mx-6 px-6 -mt-6 pt-6 mb-2">
            <SheetTitle>{edit ? 'Edit freelancer' : 'New freelancer'}</SheetTitle>
            <SheetDescription>Contact details and primary skill.</SheetDescription>
          </SheetHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                className="rounded-xl h-11"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                className="rounded-xl h-11"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input
                className="rounded-xl h-11"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Skill</Label>
              <Input
                className="rounded-xl h-11"
                value={form.skill}
                onChange={(e) => setForm((f) => ({ ...f, skill: e.target.value }))}
                placeholder="e.g. React, DevOps"
              />
            </div>
          </div>
          <SheetFooter className="gap-2 border-t pt-4">
            <Button variant="outline" className="rounded-xl" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              className="rounded-xl bg-violet-600 hover:bg-violet-700"
              onClick={() => saveMut.mutate()}
              disabled={!form.name.trim() || saveMut.isPending}
            >
              {saveMut.isPending ? 'Saving…' : 'Save'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}
