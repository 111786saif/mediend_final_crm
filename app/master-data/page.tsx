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
import { Switch } from '@/components/ui/switch'
import { apiGet, apiPost, apiPatch } from '@/lib/api-client'
import { useAuth } from '@/hooks/use-auth'
import { hasPermission } from '@/lib/rbac'
import { toast } from 'sonner'
import { Pencil, Plus, Database, ExternalLink } from 'lucide-react'
import type { MasterItem, MasterType } from '@/components/ui/master-combobox'
import Link from 'next/link'

type TabKey = 'hospitals' | 'doctors' | 'tpas' | 'anesthesia' | 'insurance' | 'treatments'

const TAB_TO_TYPE: Record<TabKey, MasterType> = {
  hospitals: 'hospitals',
  doctors: 'doctors',
  tpas: 'tpas',
  anesthesia: 'anesthesia',
  insurance: 'insurance',
  treatments: 'treatments',
}

const TAB_LABEL: Record<TabKey, string> = {
  hospitals: 'Hospital',
  doctors: 'Doctor',
  tpas: 'TPA',
  insurance: 'Insurance Company',
  anesthesia: 'Anesthesia Type',
  treatments: 'Treatment',
}

const API_BASE: Record<MasterType, string> = {
  hospitals: '/api/masters/hospitals',
  doctors: '/api/masters/doctors',
  tpas: '/api/masters/tpas',
  anesthesia: '/api/masters/anesthesia',
  insurance: '/api/masters/insurance',
  treatments: '/api/masters/treatments',
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
  const [formCategory, setFormCategory] = useState('')
  const [formAtsNewDelhi, setFormAtsNewDelhi] = useState('')
  const [formAtsMumbai, setFormAtsMumbai] = useState('')
  const [formAtsPune, setFormAtsPune] = useState('')
  const [formAtsHyderabad, setFormAtsHyderabad] = useState('')
  const [formAtsBangalore, setFormAtsBangalore] = useState('')
  const [formIsActive, setFormIsActive] = useState(true)

  const canAccess = !!(user && hasPermission(user, 'masters:read'))
  const canWrite = !!(user && hasPermission(user, 'masters:write'))

  const { data, isLoading, refetch } = useMasterList(tab, search, canAccess && !authLoading)

  const items = data?.items ?? []

  const openCreate = () => {
    setEditing(null)
    setFormName('')
    setFormAddress('')
    setFormMap('')
    setFormCategory('')
    setFormAtsNewDelhi('')
    setFormAtsMumbai('')
    setFormAtsPune('')
    setFormAtsHyderabad('')
    setFormAtsBangalore('')
    setFormIsActive(true)
    setDialogOpen(true)
  }

  const openEdit = (row: MasterItem & {
    category?: string
    atsNewDelhi?: number
    atsMumbai?: number
    atsPune?: number
    atsHyderabad?: number
    atsBangalore?: number
  }) => {
    setEditing(row)
    setFormName(row.name)
    setFormAddress(row.address || '')
    setFormMap(row.googleMapLink || '')
    setFormCategory(row.category || '')
    setFormAtsNewDelhi(row.atsNewDelhi?.toString() || '')
    setFormAtsMumbai(row.atsMumbai?.toString() || '')
    setFormAtsPune(row.atsPune?.toString() || '')
    setFormAtsHyderabad(row.atsHyderabad?.toString() || '')
    setFormAtsBangalore(row.atsBangalore?.toString() || '')
    setFormIsActive(row.isActive)
    setDialogOpen(true)
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const type = TAB_TO_TYPE[tab]
      const base = API_BASE[type]
      const buildPayload = (forEdit: boolean) => {
        const status = forEdit || type === 'hospitals' ? { isActive: formIsActive } : {}
        if (type === 'hospitals') {
          return {
            name: formName.trim(),
            address: formAddress.trim() || null,
            googleMapLink: formMap.trim() || null,
            ...status,
          }
        }
        if (type === 'treatments') {
          return {
            name: formName.trim(),
            category: formCategory.trim(),
            atsNewDelhi: formAtsNewDelhi ? Number(formAtsNewDelhi) : null,
            atsMumbai: formAtsMumbai ? Number(formAtsMumbai) : null,
            atsPune: formAtsPune ? Number(formAtsPune) : null,
            atsHyderabad: formAtsHyderabad ? Number(formAtsHyderabad) : null,
            atsBangalore: formAtsBangalore ? Number(formAtsBangalore) : null,
            ...status,
          }
        }
        return { name: formName.trim(), ...status }
      }
      if (editing) {
        const payload = buildPayload(true)
        return apiPatch<{ item: MasterItem }>(`${base}/${editing.id}`, payload)
      }
      const payload = buildPayload(false)
      return apiPost<{ item: MasterItem }>(base, payload)
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
              Add {TAB_LABEL[tab]}
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
          <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6">
            <TabsTrigger value="hospitals">Hospitals</TabsTrigger>
            <TabsTrigger value="doctors">Doctors</TabsTrigger>
            <TabsTrigger value="tpas">TPAs</TabsTrigger>
            <TabsTrigger value="insurance">Insurance</TabsTrigger>
            <TabsTrigger value="anesthesia">Anesthesia</TabsTrigger>
            <TabsTrigger value="treatments">Treatments</TabsTrigger>
          </TabsList>

        <div className="mt-4 rounded-md border overflow-x-auto">
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
                {tab === 'treatments' && (
                  <>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Delhi</TableHead>
                    <TableHead className="text-right">Mumbai</TableHead>
                    <TableHead className="text-right">Pune</TableHead>
                    <TableHead className="text-right">Hyderabad</TableHead>
                    <TableHead className="text-right">Bangalore</TableHead>
                  </>
                )}
                <TableHead className="w-[100px]">Status</TableHead>
                {canWrite && <TableHead className="w-[140px]">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={10}>Loading…</TableCell>
                </TableRow>
              )}
              {!isLoading && items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="text-muted-foreground">
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
                    {tab === 'treatments' && (
                      <>
                        <TableCell className="text-muted-foreground text-sm">{row.category || '—'}</TableCell>
                        <TableCell className="text-right font-mono text-sm">{row.atsNewDelhi != null ? `₹${row.atsNewDelhi.toLocaleString('en-IN')}` : '—'}</TableCell>
                        <TableCell className="text-right font-mono text-sm">{row.atsMumbai != null ? `₹${row.atsMumbai.toLocaleString('en-IN')}` : '—'}</TableCell>
                        <TableCell className="text-right font-mono text-sm">{row.atsPune != null ? `₹${row.atsPune.toLocaleString('en-IN')}` : '—'}</TableCell>
                        <TableCell className="text-right font-mono text-sm">{row.atsHyderabad != null ? `₹${row.atsHyderabad.toLocaleString('en-IN')}` : '—'}</TableCell>
                        <TableCell className="text-right font-mono text-sm">{row.atsBangalore != null ? `₹${row.atsBangalore.toLocaleString('en-IN')}` : '—'}</TableCell>
                      </>
                    )}
                    <TableCell>
                      <Badge variant={row.isActive ? 'default' : 'secondary'}>
                        {row.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    {canWrite && (
                      <TableCell>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => openEdit(row as any)}
                        >
                          <Pencil className="size-3" />
                          Edit
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>
        </Tabs>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>
                {editing ? 'Edit' : 'Add'} {TAB_LABEL[tab]}
              </DialogTitle>
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
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <Label htmlFor="md-active">Status</Label>
                      <p className="text-muted-foreground text-sm">
                        {formIsActive
                          ? 'Active — shown in dropdowns and forms'
                          : 'Inactive — hidden from dropdowns'}
                      </p>
                    </div>
                    <Switch
                      id="md-active"
                      checked={formIsActive}
                      onCheckedChange={setFormIsActive}
                    />
                  </div>
                </>
              )}
              {tab === 'treatments' && (
                <>
                  <div>
                    <Label htmlFor="md-category">Category *</Label>
                    <Input
                      id="md-category"
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value)}
                      placeholder="e.g. Cosmetic, Proctology, Vascular"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">ATS (Average Ticket Size) by City</Label>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                      <div>
                        <Label htmlFor="ats-delhi" className="text-xs text-muted-foreground">New Delhi (₹)</Label>
                        <Input
                          id="ats-delhi"
                          type="number"
                          min={0}
                          value={formAtsNewDelhi}
                          onChange={(e) => setFormAtsNewDelhi(e.target.value)}
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <Label htmlFor="ats-mumbai" className="text-xs text-muted-foreground">Mumbai (₹)</Label>
                        <Input
                          id="ats-mumbai"
                          type="number"
                          min={0}
                          value={formAtsMumbai}
                          onChange={(e) => setFormAtsMumbai(e.target.value)}
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <Label htmlFor="ats-pune" className="text-xs text-muted-foreground">Pune (₹)</Label>
                        <Input
                          id="ats-pune"
                          type="number"
                          min={0}
                          value={formAtsPune}
                          onChange={(e) => setFormAtsPune(e.target.value)}
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <Label htmlFor="ats-hyd" className="text-xs text-muted-foreground">Hyderabad (₹)</Label>
                        <Input
                          id="ats-hyd"
                          type="number"
                          min={0}
                          value={formAtsHyderabad}
                          onChange={(e) => setFormAtsHyderabad(e.target.value)}
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <Label htmlFor="ats-blr" className="text-xs text-muted-foreground">Bangalore (₹)</Label>
                        <Input
                          id="ats-blr"
                          type="number"
                          min={0}
                          value={formAtsBangalore}
                          onChange={(e) => setFormAtsBangalore(e.target.value)}
                          placeholder="0"
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}
              {tab !== 'hospitals' && (
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <Label htmlFor="md-active-other">Status</Label>
                    <p className="text-muted-foreground text-sm">
                      {formIsActive
                        ? 'Active — shown in dropdowns and forms'
                        : 'Inactive — hidden from dropdowns'}
                    </p>
                  </div>
                  <Switch
                    id="md-active-other"
                    checked={formIsActive}
                    onCheckedChange={setFormIsActive}
                  />
                </div>
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
