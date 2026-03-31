'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost } from '@/lib/api-client'
import { useAuth } from '@/hooks/use-auth'
import { canReadItPnl, canWriteItPnl } from '@/lib/pnl/auth-it-pnl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
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
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Plus, Briefcase, ArrowRight, Layers } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type Project = {
  id: string
  name: string
  clientName: string | null
  projectValue: number
  billingType: string
  status: string
  _count: { resources: number; bookings: number }
}

export function ItPnlProjectsPanel() {
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
      qc.invalidateQueries({ queryKey: ['it-pnl-summary'] })
      toast.success('Project created')
      setOpen(false)
      setForm({
        name: '',
        clientName: '',
        description: '',
        projectValue: '0',
        billingType: 'MONTHLY',
        monthlyBilling: '',
        status: 'ACTIVE',
      })
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

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-40 rounded-2xl bg-muted/60 animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-sky-600" />
            Projects
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Create and open projects to manage bookings and resource allocation.
          </p>
        </div>
        {canWrite && (
          <Button
            onClick={() => setOpen(true)}
            className="rounded-xl bg-gradient-to-r from-sky-600 to-cyan-600 text-white shadow-md hover:opacity-95"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            New project
          </Button>
        )}
      </div>

      {projects.length === 0 ? (
        <Card className="border-dashed border-2 border-sky-200/80 bg-sky-50/40 dark:bg-sky-950/20">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Layers className="h-12 w-12 text-sky-400 mb-3" />
            <p className="font-medium text-foreground">No projects yet</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              {canWrite
                ? 'Add your first project to start tracking revenue and costs.'
                : 'Projects will appear here once created.'}
            </p>
            {canWrite && (
              <Button className="mt-4 rounded-xl" onClick={() => setOpen(true)}>
                <Plus className="h-4 w-4 mr-1" /> Create project
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map((p) => (
            <Card
              key={p.id}
              className={cn(
                'group rounded-2xl border border-border/80 shadow-sm transition-all duration-200',
                'hover:shadow-lg hover:border-sky-300/60 dark:hover:border-sky-700/50 hover:-translate-y-0.5'
              )}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base leading-snug pr-2">{p.name}</CardTitle>
                  <Badge
                    variant="secondary"
                    className="shrink-0 rounded-full text-[10px] uppercase tracking-wide"
                  >
                    {p.status}
                  </Badge>
                </div>
                <CardDescription className="line-clamp-1">
                  {p.clientName || 'No client name'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span>
                    Value:{' '}
                    <strong className="text-foreground tabular-nums">
                      ₹{p.projectValue.toLocaleString('en-IN')}
                    </strong>
                  </span>
                  <span>
                    Billing: <strong className="text-foreground">{p.billingType}</strong>
                  </span>
                </div>
                <div className="flex gap-4 text-xs text-muted-foreground">
                  <span>{p._count.resources} resources</span>
                  <span>{p._count.bookings} bookings</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full rounded-xl border-sky-200 group-hover:bg-sky-50 dark:group-hover:bg-sky-950/30"
                  asChild
                >
                  <Link href={`/it/pnl/projects/${p.id}`} className="gap-1">
                    Open project
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto border-l-2 border-sky-200/60">
          <SheetHeader className="text-left border-b pb-4 bg-gradient-to-br from-sky-500/10 to-cyan-500/5 -mx-6 px-6 -mt-6 pt-6 mb-2">
            <SheetTitle>New project</SheetTitle>
            <SheetDescription>
              Define billing model and value. You can add resources and bookings after creation.
            </SheetDescription>
          </SheetHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="it-pnl-proj-name">Project name</Label>
              <Input
                id="it-pnl-proj-name"
                className="rounded-xl h-11"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Acme portal rebuild"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="it-pnl-proj-client">Client</Label>
              <Input
                id="it-pnl-proj-client"
                className="rounded-xl h-11"
                value={form.clientName}
                onChange={(e) => setForm((f) => ({ ...f, clientName: e.target.value }))}
                placeholder="Company or contact"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="it-pnl-proj-desc">Description</Label>
              <Textarea
                id="it-pnl-proj-desc"
                className="rounded-xl min-h-[88px] resize-none"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Scope, milestones, notes…"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Project value (₹)</Label>
                <Input
                  className="rounded-xl h-11 tabular-nums"
                  value={form.projectValue}
                  onChange={(e) => setForm((f) => ({ ...f, projectValue: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Billing type</Label>
                <Select
                  value={form.billingType}
                  onValueChange={(v) => setForm((f) => ({ ...f, billingType: v }))}
                >
                  <SelectTrigger className="rounded-xl h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MONTHLY">Monthly</SelectItem>
                    <SelectItem value="FIXED">Fixed</SelectItem>
                    <SelectItem value="MILESTONE">Milestone</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Monthly billing (optional)</Label>
              <Input
                className="rounded-xl h-11 tabular-nums"
                value={form.monthlyBilling}
                onChange={(e) => setForm((f) => ({ ...f, monthlyBilling: e.target.value }))}
                placeholder="If applicable"
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                <SelectTrigger className="rounded-xl h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                  <SelectItem value="ON_HOLD">On hold</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <SheetFooter className="gap-2 sm:gap-0 border-t pt-4">
            <Button variant="outline" className="rounded-xl" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              className="rounded-xl bg-sky-600 hover:bg-sky-700"
              onClick={() => createMut.mutate()}
              disabled={!form.name.trim() || createMut.isPending}
            >
              {createMut.isPending ? 'Creating…' : 'Create project'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}
