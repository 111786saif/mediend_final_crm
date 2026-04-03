'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AuthenticatedLayout } from '@/components/authenticated-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api-client'
import { useAuth } from '@/hooks/use-auth'
import { hasPermission } from '@/lib/rbac'
import { toast } from 'sonner'
import { Pencil, Plus, Database, ExternalLink } from 'lucide-react'
import type { MasterItem, MasterType } from '@/components/ui/master-combobox'
import Link from 'next/link'

type TabKey = 'hospitals' | 'doctors' | 'tpas' | 'anesthesia' | 'insurance'

const TAB_TO_TYPE: Record<TabKey, MasterType> = {
  hospitals: 'hospitals',
  doctors: 'doctors',
  tpas: 'tpas',
  anesthesia: 'anesthesia',
  insurance: 'insurance',
}

const API_BASE: Record<MasterType, string> = {
  hospitals: '/api/masters/hospitals',
  doctors: '/api/masters/doctors',
  tpas: '/api/masters/tpas',
  anesthesia: '/api/masters/anesthesia',
  insurance: '/api/masters/insurance',
}

function useMasterList(tab: TabKey, search: string, enabled: boolean) {
  const type = TAB_TO_TYPE[tab]
  const base = API_BASE[type]
  const q = search.trim()
  return useQuery({
    queryKey: ['masters-admin', type, q],
    enabled,
    queryFn: () =>
      apiGet<{ items: MasterItem[] }>(
        `${base}?search=${encodeURIComponent(q)}&includeInactive=true`
      ),
  })
}

export default function MasterDataPage() {
  const { user, isLoading: authLoading } = useAuth()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<TabKey>('hospitals')
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<MasterItem | null>(null)

  const [formName, setFormName] = useState('')
  const [formAddress, setFormAddress] = useState('')
  const [formMap, setFormMap] = useState('')

  const canAccess = !!(user && hasPermission(user, 'masters:read'))
  const canWrite = !!(user && hasPermission(user, 'masters:write'))

  const { data, isLoading, refetch } = useMasterList(tab, search, canAccess && !authLoading)

  const items = data?.items ?? []

  const openCreate = () => {
    setEditing(null)
    setFormName('')
    setFormAddress('')
    setFormMap('')
    setDialogOpen(true)
  }

  const openEdit = (row: MasterItem) => {
    setEditing(row)
    setFormName(row.name)
    setFormAddress((row as MasterItem & { address?: string }).address ?? '')
    setFormMap((row as MasterItem & { googleMapLink?: string }).googleMapLink ?? '')
    setDialogOpen(true)
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const type = TAB_TO_TYPE[tab]
      const base = API_BASE[type]
      if (editing) {
        if (type === 'hospitals') {
          return apiPatch<{ item: MasterItem }>(`${base}/${editing.id}`, {
            name: formName.trim(),
            address: formAddress.trim() || null,
            googleMapLink: formMap.trim() || null,
          })
        }
        return apiPatch<{ item: MasterItem }>(`${base}/${editing.id}`, {
          name: formName.trim(),
        })
      }
      if (type === 'hospitals') {
        return apiPost<{ item: MasterItem }>(base, {
          name: formName.trim(),
          address: formAddress.trim() || null,
          googleMapLink: formMap.trim() || null,
        })
      }
      return apiPost<{ item: MasterItem }>(base, { name: formName.trim() })
    },
    onSuccess: () => {
      toast.success(editing ? 'Updated' : 'Created')
      setDialogOpen(false)
      queryClient.invalidateQueries({ queryKey: ['masters-admin'] })
      queryClient.invalidateQueries({ queryKey: ['masters'] })
      void refetch()
    },
    onError: (e: Error) => toast.error(e.message || 'Save failed'),
  })

  const deactivateMutation = useMutation({
    mutationFn: async (id: string) => {
      const type = TAB_TO_TYPE[tab]
      return apiDelete<{ item: MasterItem }>(`${API_BASE[type]}/${id}`)
    },
    onSuccess: () => {
      toast.success('Marked inactive')
      queryClient.invalidateQueries({ queryKey: ['masters-admin'] })
      queryClient.invalidateQueries({ queryKey: ['masters'] })
      void refetch()
    },
    onError: (e: Error) => toast.error(e.message || 'Failed'),
  })

  if (authLoading) {
    return (
      <AuthenticatedLayout>
        <div className="p-6">Loading…</div>
      </AuthenticatedLayout>
    )
  }

  if (!user || !canAccess) {
    return (
      <AuthenticatedLayout>
        <div className="p-6">
          <p className="text-muted-foreground">You don&apos;t have access to Master Data.</p>
          <Button asChild className="mt-4" variant="outline">
            <Link href="/home">Back</Link>
          </Button>
        </div>
      </AuthenticatedLayout>
    )
  }

  return (
    <AuthenticatedLayout>
      <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Database className="size-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Master Data</h1>
              <p className="text-muted-foreground text-sm">
                Hospitals, doctors, TPAs, insurance companies, and anesthesia types for forms and dropdowns.
              </p>
            </div>
          </div>
          {canWrite && (
            <Button onClick={openCreate}>
              <Plus className="mr-2 size-4" />
              Add new
            </Button>
          )}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            placeholder="Search current tab…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-md"
          />
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
          <TabsList className="grid w-full grid-cols-3 lg:grid-cols-5">
            <TabsTrigger value="hospitals">Hospitals</TabsTrigger>
            <TabsTrigger value="doctors">Doctors</TabsTrigger>
            <TabsTrigger value="tpas">TPAs</TabsTrigger>
            <TabsTrigger value="insurance">Insurance</TabsTrigger>
            <TabsTrigger value="anesthesia">Anesthesia</TabsTrigger>
          </TabsList>

        <div className="mt-4 rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                {tab === 'hospitals' && (
                  <>
                    <TableHead>Address</TableHead>
                    <TableHead className="w-[100px]">Map</TableHead>
                  </>
                )}
                <TableHead className="w-[100px]">Status</TableHead>
                {canWrite && <TableHead className="w-[140px]">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={tab === 'hospitals' ? 5 : 3}>Loading…</TableCell>
                </TableRow>
              )}
              {!isLoading && items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={tab === 'hospitals' ? 5 : 3} className="text-muted-foreground">
                    No rows. {canWrite ? 'Add one or adjust search.' : ''}
                  </TableCell>
                </TableRow>
              )}
              {!isLoading &&
                items.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    {tab === 'hospitals' && (
                      <>
                        <TableCell className="text-muted-foreground max-w-md truncate text-sm">
                          {(row as MasterItem & { address?: string }).address || '—'}
                        </TableCell>
                        <TableCell>
                          {(row as MasterItem & { googleMapLink?: string }).googleMapLink ? (
                            <a
                              href={(row as MasterItem & { googleMapLink?: string }).googleMapLink!}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary inline-flex items-center gap-1 text-sm"
                            >
                              <ExternalLink className="size-3" />
                              Open
                            </a>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                      </>
                    )}
                    <TableCell>
                      <Badge variant={row.isActive ? 'default' : 'secondary'}>
                        {row.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    {canWrite && (
                      <TableCell className="space-x-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => openEdit(row)}
                        >
                          <Pencil className="size-3" />
                          Edit
                        </Button>
                        {row.isActive && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                            onClick={() => {
                              if (confirm(`Deactivate “${row.name}”?`)) {
                                deactivateMutation.mutate(row.id)
                              }
                            }}
                          >
                            Deactivate
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>
        </Tabs>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editing ? 'Edit' : 'Add'} entry</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <Label htmlFor="md-name">Name *</Label>
                <Input
                  id="md-name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Display name"
                />
              </div>
              {tab === 'hospitals' && (
                <>
                  <div>
                    <Label htmlFor="md-addr">Address</Label>
                    <Textarea
                      id="md-addr"
                      value={formAddress}
                      onChange={(e) => setFormAddress(e.target.value)}
                      placeholder="Hospital address"
                      rows={3}
                    />
                  </div>
                  <div>
                    <Label htmlFor="md-map">Google Maps link</Label>
                    <Input
                      id="md-map"
                      value={formMap}
                      onChange={(e) => setFormMap(e.target.value)}
                      placeholder="https://maps.google.com/..."
                    />
                  </div>
                </>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (!formName.trim()) {
                    toast.error('Name is required')
                    return
                  }
                  saveMutation.mutate()
                }}
                disabled={saveMutation.isPending}
              >
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AuthenticatedLayout>
  )
}
