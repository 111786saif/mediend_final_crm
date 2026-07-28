'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Database, Edit, MapPinned, Plus, RefreshCw, RadioTower } from 'lucide-react'
import { ProtectedRoute } from '@/components/protected-route'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useAuth } from '@/hooks/use-auth'
import { apiGet, apiPatch, apiPost } from '@/lib/api-client'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

type SourceMaster = {
  id: string
  name: string
  isActive: boolean
}

type LeadSourceMaster = {
  id: string
  name: string
  cpl: number | null
  sourceId: string
  isActive: boolean
  source: SourceMaster
}

type CircleMaster = {
  id: string
  name: string
  isActive: boolean
}

type CityMaster = {
  id: string
  name: string
  circleId: string
  isActive: boolean
  circle: CircleMaster
}

type SubStatusMaster = {
  id: string
  key: number
  value: string
  isActive: boolean
}

type CampaignPageData = {
  masters: {
    sources: SourceMaster[]
    leadSources: LeadSourceMaster[]
    circles: CircleMaster[]
    cities: CityMaster[]
    subStatuses: SubStatusMaster[]
  }
}

export type CampaignMasterType = 'source' | 'leadSource' | 'circle' | 'city' | 'subStatus'

type MasterRecord =
  | SourceMaster
  | LeadSourceMaster
  | CircleMaster
  | CityMaster
  | SubStatusMaster

type MasterFormState = {
  name: string
  cpl: string
  isActive: boolean
  sourceId: string
  circleId: string
  key: string
  value: string
}

const MASTER_PAGE_CONFIG: Record<
  CampaignMasterType,
  {
    title: string
    description: string
    actionLabel: string
    emptyMessage: string
    loadErrorMessage: string
    icon: typeof Database
  }
> = {
  source: {
    title: 'CRM Sources',
    description: 'Top-level marketing platforms such as Meta or Google used in campaign mapping.',
    actionLabel: 'Add source',
    emptyMessage: 'No sources created yet.',
    loadErrorMessage: 'Source masters could not be loaded.',
    icon: Database,
  },
  leadSource: {
    title: 'CRM Lead Sources',
    description: 'Sub-source labels used as the CRM campaign name when webhook leads are created.',
    actionLabel: 'Add lead source',
    emptyMessage: 'No lead sources created yet.',
    loadErrorMessage: 'Lead source masters could not be loaded.',
    icon: RadioTower,
  },
  circle: {
    title: 'CRM Circles',
    description: 'High-level routing geography used to prefer BD assignment for a campaign.',
    actionLabel: 'Add circle',
    emptyMessage: 'No circles created yet.',
    loadErrorMessage: 'Circle masters could not be loaded.',
    icon: MapPinned,
  },
  city: {
    title: 'CRM Cities',
    description: 'Optional city metadata attached to campaigns under a selected circle.',
    actionLabel: 'Add city',
    emptyMessage: 'No cities created yet.',
    loadErrorMessage: 'City masters could not be loaded.',
    icon: MapPinned,
  },
  subStatus: {
    title: 'CRM Sub Statuses',
    description: 'Number-to-label mappings used when applying lead sub status during bulk reassignment.',
    actionLabel: 'Add sub status',
    emptyMessage: 'No sub statuses created yet.',
    loadErrorMessage: 'Sub status masters could not be loaded.',
    icon: Database,
  },
}

const MASTER_TABS: Array<{
  type: CampaignMasterType
  label: string
  href: string
}> = [
  { type: 'source', label: 'Sources', href: '/crm/masters' },
  { type: 'leadSource', label: 'Lead Sources', href: '/crm/masters/lead-sources' },
  { type: 'circle', label: 'Circles', href: '/crm/masters/circles' },
  { type: 'city', label: 'Cities', href: '/crm/masters/cities' },
  { type: 'subStatus', label: 'Sub Statuses', href: '/crm/masters/sub-statuses' },
]

function createEmptyMasterForm(): MasterFormState {
  return {
    name: '',
    cpl: '',
    isActive: true,
    sourceId: '',
    circleId: '',
    key: '',
    value: '',
  }
}

function buildMasterForm(masterType: CampaignMasterType, item?: MasterRecord): MasterFormState {
  if (!item) {
    return createEmptyMasterForm()
  }

  if (masterType === 'leadSource') {
    const leadSource = item as LeadSourceMaster
    return {
      name: leadSource.name,
      cpl: leadSource.cpl === null ? '' : String(leadSource.cpl),
      isActive: leadSource.isActive,
      sourceId: leadSource.sourceId,
      circleId: '',
      key: '',
      value: '',
    }
  }

  if (masterType === 'city') {
    const city = item as CityMaster
    return {
      name: city.name,
      cpl: '',
      isActive: city.isActive,
      sourceId: '',
      circleId: city.circleId,
      key: '',
      value: '',
    }
  }

  if (masterType === 'subStatus') {
    const subStatus = item as SubStatusMaster
    return {
      name: '',
      cpl: '',
      isActive: subStatus.isActive,
      sourceId: '',
      circleId: '',
      key: String(subStatus.key),
      value: subStatus.value,
    }
  }

  return {
    name: item.name,
    cpl: '',
    isActive: item.isActive,
    sourceId: '',
    circleId: '',
    key: '',
    value: '',
  }
}

function statusBadge(isActive: boolean) {
  return isActive ? (
    <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">Active</Badge>
  ) : (
    <Badge variant="secondary">Inactive</Badge>
  )
}

export function CrmMasterPage({ masterType }: { masterType: CampaignMasterType }) {
  const queryClient = useQueryClient()
  const { user, isLoading: isAuthLoading } = useAuth()
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [drawerItem, setDrawerItem] = useState<MasterRecord | null>(null)
  const [form, setForm] = useState<MasterFormState>(createEmptyMasterForm())
  const hasAccess = user?.role === 'SUPER_ADMIN'
  const config = MASTER_PAGE_CONFIG[masterType]
  const Icon = config.icon

  const { data, isLoading, error } = useQuery<CampaignPageData>({
    queryKey: ['crm-campaign-masters', masterType],
    queryFn: () => apiGet<CampaignPageData>('/api/crm/campaigns'),
    retry: false,
    enabled: hasAccess,
  })

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => apiPost('/api/crm/campaigns/masters', payload),
    onSuccess: () => {
      toast.success('Master record created')
      setIsDrawerOpen(false)
      setDrawerItem(null)
      setForm(createEmptyMasterForm())
      void queryClient.invalidateQueries({ queryKey: ['crm-campaign-masters'] })
      void queryClient.invalidateQueries({ queryKey: ['crm-campaigns-admin'] })
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to create master record'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) =>
      apiPatch(`/api/crm/campaigns/masters/${masterType}/${id}`, payload),
    onSuccess: () => {
      toast.success('Master record updated')
      setIsDrawerOpen(false)
      setDrawerItem(null)
      setForm(createEmptyMasterForm())
      void queryClient.invalidateQueries({ queryKey: ['crm-campaign-masters'] })
      void queryClient.invalidateQueries({ queryKey: ['crm-campaigns-admin'] })
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to update master record'),
  })

  const errorMessage =
    error instanceof Error ? error.message : 'We could not load the CRM master console right now.'

  const items =
    masterType === 'source'
      ? (data?.masters.sources ?? [])
      : masterType === 'leadSource'
        ? (data?.masters.leadSources ?? [])
        : masterType === 'circle'
          ? (data?.masters.circles ?? [])
          : masterType === 'city'
            ? (data?.masters.cities ?? [])
            : (data?.masters.subStatuses ?? [])

  const openDrawer = (item?: MasterRecord) => {
    setIsDrawerOpen(true)
    setDrawerItem(item ?? null)
    setForm(buildMasterForm(masterType, item))
  }

  const closeDrawer = () => {
    setIsDrawerOpen(false)
    setDrawerItem(null)
    setForm(createEmptyMasterForm())
  }

  const handleSave = () => {
    const payload: Record<string, unknown> = {
      isActive: form.isActive,
    }

    if (masterType === 'subStatus') {
      const trimmedValue = form.value.trim()
      const parsedKey = Number.parseInt(form.key, 10)

      if (!Number.isInteger(parsedKey) || parsedKey <= 0) {
        toast.error('Key must be a whole number greater than 0')
        return
      }

      if (!trimmedValue) {
        toast.error('Value is required')
        return
      }

      payload.key = parsedKey
      payload.value = trimmedValue
    } else {
      payload.name = form.name.trim()

      if (!payload.name) {
        toast.error('Name is required')
        return
      }
    }

    if (masterType === 'leadSource') {
      if (!form.sourceId) {
        toast.error('Source is required')
        return
      }
      if (form.cpl.trim()) {
        const parsedCpl = Number.parseFloat(form.cpl)
        if (!Number.isFinite(parsedCpl) || parsedCpl < 0) {
          toast.error('CPL must be a valid non-negative number')
          return
        }
        payload.cpl = parsedCpl
      } else {
        payload.cpl = null
      }
      payload.sourceId = form.sourceId
    }

    if (masterType === 'city') {
      if (!form.circleId) {
        toast.error('Circle is required')
        return
      }
      payload.circleId = form.circleId
    }

    if (!drawerItem) {
      createMutation.mutate({
        type: masterType,
        ...payload,
      })
      return
    }

    updateMutation.mutate({
      id: drawerItem.id,
      payload,
    })
  }

  const isSaving = createMutation.isPending || updateMutation.isPending

  if (!isAuthLoading && !hasAccess) {
    return (
      <ProtectedRoute>
        <div className="mx-auto w-full max-w-6xl p-4 md:p-6">
          <Card className="w-full">
            <CardHeader>
              <CardTitle>No access</CardTitle>
              <CardDescription>
                This CRM master console is restricted to Super Admin users.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <div className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
              <Icon className="h-8 w-8 text-cyan-600" />
              {config.title}
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{config.description}</p>
          </div>

          <Button type="button" onClick={() => openDrawer()}>
            <Plus className="mr-2 h-4 w-4" />
            {config.actionLabel}
          </Button>
        </div>

        <div className="overflow-x-auto">
          <div className="inline-flex min-w-full gap-1 rounded-2xl border border-border/70 bg-muted/50 p-1.5">
            {MASTER_TABS.map((tab) => {
              const isActive = tab.type === masterType

              return (
                <Link
                  key={tab.type}
                  href={tab.href}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'rounded-xl px-4 py-2 text-sm font-medium transition-[color,background-color,box-shadow] whitespace-nowrap',
                    isActive
                      ? 'border border-border/70 bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:bg-background/70 hover:text-foreground'
                  )}
                >
                  {tab.label}
                </Link>
              )
            })}
          </div>
        </div>

        {error && !isLoading && (
          <Card className="w-full border-amber-300 bg-amber-50/70">
            <CardHeader className="flex flex-row items-start gap-3 space-y-0">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
              <div className="space-y-1">
                <CardTitle>Unable to load master data</CardTitle>
                <CardDescription className="text-amber-900/80">{errorMessage}</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="pb-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => queryClient.invalidateQueries({ queryKey: ['crm-campaign-masters'] })}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry loading
              </Button>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <div>
              <CardTitle>{config.title}</CardTitle>
              <CardDescription>
                {masterType === 'subStatus'
                  ? 'Changes here are reflected in bulk reassignment sub-status selection.'
                  : 'Changes here are reflected in campaign mapping dropdowns and SaveMyLeads routing.'}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    {masterType === 'subStatus' ? <TableHead>Key</TableHead> : <TableHead>Name</TableHead>}
                    {masterType === 'subStatus' && <TableHead>Value</TableHead>}
                    {masterType === 'leadSource' && <TableHead>Source</TableHead>}
                    {masterType === 'leadSource' && <TableHead>CPL</TableHead>}
                    {masterType === 'city' && <TableHead>Circle</TableHead>}
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[120px] text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell
                        colSpan={masterType === 'leadSource' ? 5 : masterType === 'city' ? 4 : masterType === 'subStatus' ? 4 : 3}
                        className="py-10 text-center text-muted-foreground"
                      >
                        Loading data...
                      </TableCell>
                    </TableRow>
                  ) : error ? (
                    <TableRow>
                      <TableCell
                        colSpan={masterType === 'leadSource' ? 5 : masterType === 'city' ? 4 : masterType === 'subStatus' ? 4 : 3}
                        className="py-10 text-center text-muted-foreground"
                      >
                        {config.loadErrorMessage}
                      </TableCell>
                    </TableRow>
                  ) : items.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={masterType === 'leadSource' ? 5 : masterType === 'city' ? 4 : masterType === 'subStatus' ? 4 : 3}
                        className="py-10 text-center text-muted-foreground"
                      >
                        {config.emptyMessage}
                      </TableCell>
                    </TableRow>
                  ) : (
                    items.map((item) => (
                      <TableRow key={item.id}>
                        {masterType === 'subStatus' ? (
                          <>
                            <TableCell className="font-medium">{(item as SubStatusMaster).key}</TableCell>
                            <TableCell>{(item as SubStatusMaster).value}</TableCell>
                          </>
                        ) : (
                          <TableCell className="font-medium">{(item as SourceMaster | LeadSourceMaster | CircleMaster | CityMaster).name}</TableCell>
                        )}
                        {masterType === 'leadSource' && (
                          <TableCell>{(item as LeadSourceMaster).source.name}</TableCell>
                        )}
                        {masterType === 'leadSource' && (
                          <TableCell>
                            {(item as LeadSourceMaster).cpl === null
                              ? '—'
                              : (item as LeadSourceMaster).cpl}
                          </TableCell>
                        )}
                        {masterType === 'city' && (
                          <TableCell>{(item as CityMaster).circle.name}</TableCell>
                        )}
                        <TableCell>{statusBadge(item.isActive)}</TableCell>
                        <TableCell className="text-right">
                          <Button type="button" variant="ghost" size="sm" onClick={() => openDrawer(item)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Sheet open={isDrawerOpen} onOpenChange={(open) => !open && closeDrawer()}>
        <SheetContent
          side="right"
          className="flex h-full w-full max-w-2xl flex-col gap-0 overflow-hidden rounded-none border-l p-0 sm:max-w-2xl"
        >
          <SheetHeader className="shrink-0 border-b p-4 text-left">
            <SheetTitle>
              {drawerItem ? 'Edit' : 'Add'}{' '}
              {masterType === 'leadSource'
                ? 'lead source'
                : masterType === 'source'
                  ? 'source'
                  : masterType === 'circle'
                    ? 'circle'
                    : masterType === 'city'
                      ? 'city'
                      : 'sub status'}
            </SheetTitle>
            <SheetDescription>Super Admin-only CRM master data management.</SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-5 overflow-y-auto p-4">
            {masterType === 'subStatus' ? (
              <>
                <div className="space-y-2">
                  <Label>Key</Label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min="1"
                    step="1"
                    value={form.key}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, key: event.target.value }))
                    }
                    placeholder="Enter key, for example 1"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Value</Label>
                  <Input
                    value={form.value}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, value: event.target.value }))
                    }
                    placeholder="Enter sub status label"
                  />
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Enter name"
                />
              </div>
            )}

            {masterType === 'leadSource' && (
              <>
                <div className="space-y-2">
                  <Label>Source</Label>
                  <Select
                    value={form.sourceId || 'none'}
                    onValueChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        sourceId: value === 'none' ? '' : value,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select source" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Select source</SelectItem>
                      {(data?.masters.sources ?? []).map((source) => (
                        <SelectItem key={source.id} value={source.id}>
                          {source.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>CPL (Cost per lead)</Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={form.cpl}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, cpl: event.target.value }))
                    }
                    placeholder="Enter CPL"
                  />
                </div>
              </>
            )}

            {masterType === 'city' && (
              <div className="space-y-2">
                <Label>Circle</Label>
                <Select
                  value={form.circleId || 'none'}
                  onValueChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      circleId: value === 'none' ? '' : value,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select circle" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select circle</SelectItem>
                    {(data?.masters.circles ?? []).map((circle) => (
                      <SelectItem key={circle.id} value={circle.id}>
                        {circle.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex items-center justify-between rounded-xl border px-4 py-3">
              <div>
                <p className="text-sm font-medium">Active</p>
                <p className="text-xs text-muted-foreground">
                  Inactive records remain visible for audit but stop being selectable.
                </p>
              </div>
              <Switch
                checked={form.isActive}
                onCheckedChange={(checked) =>
                  setForm((current) => ({ ...current, isActive: checked }))
                }
              />
            </div>
          </div>

          <SheetFooter className="shrink-0 border-t bg-background/95 p-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={closeDrawer} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save changes'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </ProtectedRoute>
  )
}
