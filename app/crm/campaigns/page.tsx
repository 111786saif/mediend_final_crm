'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  Edit,
  Megaphone,
  Plus,
  RefreshCw,
  Route,
  Users,
} from 'lucide-react'
import { ProtectedRoute } from '@/components/protected-route'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/hooks/use-auth'
import { apiGet, apiPatch, apiPost, apiPut } from '@/lib/api-client'
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

type DepartmentOption = {
  id: string
  name: string
}

type TeamLeadOption = {
  id: string
  userId: string
  name: string
  email: string
  employeeCode: string
  circle: string | null
  department: {
    id: string
    name: string
  } | null
  activeBdCount: number
}

type CampaignAssignment = {
  id: string
  teamLeadEmployeeId: string
  teamLeadUserId: string
  month: number
  year: number
  weight: number
  priority: number
  isActive: boolean
  teamLeadEmployee: {
    id: string
    employeeCode: string
    department: {
      id: string
      name: string
    } | null
    user: {
      id: string
      name: string
      email: string
      role: string
    }
  }
}

type CampaignRecord = {
  id: string
  externalCampaignId: string
  displayName: string
  category: string | null
  departmentId: string | null
  isActive: boolean
  sourceId: string
  leadSourceId: string
  circleId: string
  cityId: string | null
  source: SourceMaster
  leadSource: LeadSourceMaster
  circle: CircleMaster
  city: CityMaster | null
  department: DepartmentOption | null
  assignments: CampaignAssignment[]
}

type CampaignPageData = {
  month: number
  year: number
  masters: {
    sources: SourceMaster[]
    leadSources: LeadSourceMaster[]
    circles: CircleMaster[]
    cities: CityMaster[]
    departments: DepartmentOption[]
  }
  teamLeads: TeamLeadOption[]
  campaigns: CampaignRecord[]
}

type DrawerState =
  | {
      type: 'campaign'
      mode: 'create' | 'edit'
      item?: CampaignRecord
    }
  | {
      type: 'assignment'
      mode: 'edit'
      item: CampaignRecord
    }
  | null

type CampaignFormState = {
  externalCampaignId: string
  displayName: string
  category: string
  departmentId: string
  sourceId: string
  leadSourceId: string
  circleId: string
  cityId: string
  isActive: boolean
}

type AssignmentDraft = {
  teamLeadEmployeeId: string
  enabled: boolean
  weight: string
  priority: string
  isActive: boolean
}

const MONTH_OPTIONS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
] as const

function getInitialMonthYear() {
  const now = new Date()
  return {
    month: now.getMonth() + 1,
    year: now.getFullYear(),
  }
}

function createEmptyCampaignForm(): CampaignFormState {
  return {
    externalCampaignId: '',
    displayName: '',
    category: '',
    departmentId: 'none',
    sourceId: '',
    leadSourceId: '',
    circleId: '',
    cityId: 'none',
    isActive: true,
  }
}

function buildCampaignForm(drawer: DrawerState): CampaignFormState {
  if (!drawer || drawer.type !== 'campaign' || drawer.mode === 'create') {
    return createEmptyCampaignForm()
  }

  const item = drawer.item
  return {
    externalCampaignId: item?.externalCampaignId ?? '',
    displayName: item?.displayName ?? '',
    category: item?.category ?? '',
    departmentId: item?.departmentId ?? 'none',
    sourceId: item?.sourceId ?? '',
    leadSourceId: item?.leadSourceId ?? '',
    circleId: item?.circleId ?? '',
    cityId: item?.cityId ?? 'none',
    isActive: item?.isActive ?? true,
  }
}

function buildAssignmentDrafts(campaign: CampaignRecord, teamLeads: TeamLeadOption[]) {
  const assignmentMap = new Map(
    campaign.assignments.map((assignment) => [assignment.teamLeadEmployeeId, assignment])
  )

  return teamLeads.map((teamLead) => {
    const existing = assignmentMap.get(teamLead.id)
    return {
      teamLeadEmployeeId: teamLead.id,
      enabled: Boolean(existing),
      weight: String(existing?.weight ?? 1),
      priority: String(existing?.priority ?? 100),
      isActive: existing?.isActive ?? true,
    }
  })
}

function statusBadge(isActive: boolean) {
  return isActive ? (
    <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">Active</Badge>
  ) : (
    <Badge variant="secondary">Inactive</Badge>
  )
}

function filterLeadSources(leadSources: LeadSourceMaster[], sourceId: string) {
  if (!sourceId) return leadSources
  return leadSources.filter((leadSource) => leadSource.sourceId === sourceId)
}

function filterCities(cities: CityMaster[], circleId: string) {
  if (!circleId) return cities
  return cities.filter((city) => city.circleId === circleId)
}

function filterTeamLeadsForCampaign(teamLeads: TeamLeadOption[], campaign: CampaignRecord) {
  if (!campaign.departmentId) return teamLeads
  return teamLeads.filter((teamLead) => teamLead.department?.id === campaign.departmentId)
}

function assignmentSummary(assignments: CampaignAssignment[]) {
  if (assignments.length === 0) return 'No Team Leads mapped'
  return assignments
    .map((assignment) => `${assignment.teamLeadEmployee.user.name} (w${assignment.weight})`)
    .join(', ')
}

export default function CrmCampaignsPage() {
  const queryClient = useQueryClient()
  const { user, isLoading: isAuthLoading } = useAuth()
  const initialMonthYear = getInitialMonthYear()
  const [month, setMonth] = useState(String(initialMonthYear.month))
  const [year, setYear] = useState(String(initialMonthYear.year))
  const [activeTab, setActiveTab] = useState('campaigns')
  const [drawer, setDrawer] = useState<DrawerState>(null)
  const [campaignForm, setCampaignForm] = useState<CampaignFormState>(createEmptyCampaignForm())
  const [assignmentDrafts, setAssignmentDrafts] = useState<AssignmentDraft[]>([])
  const hasAccess = String(user?.role) === 'SUPER_ADMIN' || String(user?.role) === 'CRM_ADMIN'

  const selectedMonth = Number.parseInt(month, 10) || initialMonthYear.month
  const selectedYear = Number.parseInt(year, 10) || initialMonthYear.year

  const { data, isLoading, error } = useQuery<CampaignPageData>({
    queryKey: ['crm-campaigns-admin', selectedMonth, selectedYear],
    queryFn: () =>
      apiGet<CampaignPageData>(`/api/crm/campaigns?month=${selectedMonth}&year=${selectedYear}`),
    retry: false,
    enabled: hasAccess,
  })

  const errorMessage =
    error instanceof Error ? error.message : 'We could not load the CRM campaign console right now.'

  const refreshData = () =>
    queryClient.invalidateQueries({ queryKey: ['crm-campaigns-admin'] })

  const createCampaignMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => apiPost('/api/crm/campaigns', payload),
    onSuccess: () => {
      toast.success('Campaign created')
      setDrawer(null)
      refreshData()
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to create campaign'),
  })

  const updateCampaignMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) =>
      apiPatch(`/api/crm/campaigns/${id}`, payload),
    onSuccess: () => {
      toast.success('Campaign updated')
      setDrawer(null)
      refreshData()
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to update campaign'),
  })

  const updateAssignmentsMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) =>
      apiPut(`/api/crm/campaigns/${id}/assignments`, payload),
    onSuccess: () => {
      toast.success('Campaign assignments updated')
      setDrawer(null)
      refreshData()
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to update campaign assignments'),
  })

  const isSaving =
    createCampaignMutation.isPending ||
    updateCampaignMutation.isPending ||
    updateAssignmentsMutation.isPending

  const availableLeadSources = useMemo(
    () => filterLeadSources(data?.masters.leadSources ?? [], campaignForm.sourceId),
    [data?.masters.leadSources, campaignForm.sourceId]
  )

  const availableCities = useMemo(
    () => filterCities(data?.masters.cities ?? [], campaignForm.circleId),
    [data?.masters.cities, campaignForm.circleId]
  )

  const drawerTitle =
    drawer?.type === 'campaign'
      ? drawer.mode === 'create'
        ? 'Add campaign'
        : 'Edit campaign'
      : drawer?.type === 'assignment'
        ? `Manage assignments for ${drawer.item.displayName}`
        : ''

  const drawerDescription =
    drawer?.type === 'assignment'
      ? `Configure Team Lead coverage for ${MONTH_OPTIONS.find((option) => option.value === selectedMonth)?.label} ${selectedYear}.${drawer.item.department?.name ? ` Only Team Leads from ${drawer.item.department.name} are eligible for this campaign.` : ''}`
      : 'Campaign routing determines which Team Lead and BD receive SaveMyLeads traffic.'

  const openCampaignDrawer = (item?: CampaignRecord) => {
    const nextDrawer: DrawerState = { type: 'campaign', mode: item ? 'edit' : 'create', item }
    setDrawer(nextDrawer)
    setCampaignForm(buildCampaignForm(nextDrawer))
  }

  const openAssignmentDrawer = (campaign: CampaignRecord) => {
    const nextDrawer: DrawerState = { type: 'assignment', mode: 'edit', item: campaign }
    setDrawer(nextDrawer)
    setAssignmentDrafts(
      buildAssignmentDrafts(campaign, filterTeamLeadsForCampaign(data?.teamLeads ?? [], campaign))
    )
  }

  const closeDrawer = () => {
    setDrawer(null)
  }

  const handleCampaignSave = () => {
    if (!drawer || drawer.type !== 'campaign') return

    const payload = {
      externalCampaignId: campaignForm.externalCampaignId.trim(),
      displayName: campaignForm.displayName.trim(),
      category: campaignForm.category.trim() || null,
      departmentId: campaignForm.departmentId === 'none' ? null : campaignForm.departmentId,
      sourceId: campaignForm.sourceId,
      leadSourceId: campaignForm.leadSourceId,
      circleId: campaignForm.circleId,
      cityId: campaignForm.cityId === 'none' ? null : campaignForm.cityId,
      isActive: campaignForm.isActive,
    }

    if (
      !payload.externalCampaignId ||
      !payload.displayName ||
      !payload.sourceId ||
      !payload.leadSourceId ||
      !payload.circleId
    ) {
      toast.error('Campaign ID, name, source, lead source, and circle are required')
      return
    }

    if (drawer.mode === 'create') {
      createCampaignMutation.mutate(payload)
      return
    }

    updateCampaignMutation.mutate({
      id: drawer.item!.id,
      payload,
    })
  }

  const handleAssignmentSave = () => {
    if (!drawer || drawer.type !== 'assignment') return

    const payload = {
      month: selectedMonth,
      year: selectedYear,
      assignments: assignmentDrafts
        .filter((assignment) => assignment.enabled)
        .map((assignment) => ({
          teamLeadEmployeeId: assignment.teamLeadEmployeeId,
          weight: Number.parseInt(assignment.weight, 10) || 1,
          priority: Number.parseInt(assignment.priority, 10) || 0,
          isActive: assignment.isActive,
        })),
    }

    updateAssignmentsMutation.mutate({
      id: drawer.item.id,
      payload,
    })
  }

  const renderDrawerBody = () => {
    if (!drawer) return null

    if (drawer.type === 'campaign') {
      return (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Campaign ID</Label>
              <Input
                value={campaignForm.externalCampaignId}
                onChange={(event) =>
                  setCampaignForm((current) => ({
                    ...current,
                    externalCampaignId: event.target.value,
                  }))
                }
                placeholder="e.g. 123456789"
              />
            </div>
            <div className="space-y-2">
              <Label>Display name</Label>
              <Input
                value={campaignForm.displayName}
                onChange={(event) =>
                  setCampaignForm((current) => ({
                    ...current,
                    displayName: event.target.value,
                  }))
                }
                placeholder="Campaign name"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Source</Label>
              <Select
                value={campaignForm.sourceId || 'none'}
                onValueChange={(value) =>
                  setCampaignForm((current) => ({
                    ...current,
                    sourceId: value === 'none' ? '' : value,
                    leadSourceId: value === current.sourceId ? current.leadSourceId : '',
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
              <Label>Lead source</Label>
              <Select
                value={campaignForm.leadSourceId || 'none'}
                onValueChange={(value) =>
                  setCampaignForm((current) => ({
                    ...current,
                    leadSourceId: value === 'none' ? '' : value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select lead source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select lead source</SelectItem>
                  {availableLeadSources.map((leadSource) => (
                    <SelectItem key={leadSource.id} value={leadSource.id}>
                      {leadSource.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Circle</Label>
              <Select
                value={campaignForm.circleId || 'none'}
                onValueChange={(value) =>
                  setCampaignForm((current) => ({
                    ...current,
                    circleId: value === 'none' ? '' : value,
                    cityId: value === current.circleId ? current.cityId : 'none',
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
            <div className="space-y-2">
              <Label>City</Label>
              <Select
                value={campaignForm.cityId || 'none'}
                onValueChange={(value) =>
                  setCampaignForm((current) => ({
                    ...current,
                    cityId: value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Optional city" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No city</SelectItem>
                  {availableCities.map((city) => (
                    <SelectItem key={city.id} value={city.id}>
                      {city.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Category</Label>
              <Input
                value={campaignForm.category}
                onChange={(event) =>
                  setCampaignForm((current) => ({
                    ...current,
                    category: event.target.value,
                  }))
                }
                placeholder="Optional category"
              />
            </div>
            <div className="space-y-2">
              <Label>Department</Label>
              <Select
                value={campaignForm.departmentId || 'none'}
                onValueChange={(value) =>
                  setCampaignForm((current) => ({
                    ...current,
                    departmentId: value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Optional department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No department</SelectItem>
                  {(data?.masters.departments ?? []).map((department) => (
                    <SelectItem key={department.id} value={department.id}>
                      {department.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border px-4 py-3">
            <div>
              <p className="text-sm font-medium">Active</p>
              <p className="text-xs text-muted-foreground">
                Inactive campaigns stay on file but stop receiving new webhook leads.
              </p>
            </div>
            <Switch
              checked={campaignForm.isActive}
              onCheckedChange={(checked) =>
                setCampaignForm((current) => ({ ...current, isActive: checked }))
              }
            />
          </div>
        </div>
      )
    }

    const campaign = drawer.item as CampaignRecord
    const teamLeadMap = new Map((data?.teamLeads ?? []).map((teamLead) => [teamLead.id, teamLead]))

    return (
      <div className="space-y-4">
        <div className="grid gap-4 rounded-xl border p-4 sm:grid-cols-2 xl:grid-cols-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Campaign</p>
            <p className="font-medium">{campaign.displayName}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Campaign ID</p>
            <p className="font-mono text-sm">{campaign.externalCampaignId}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Month / Year</p>
            <p className="font-medium">
              {MONTH_OPTIONS.find((option) => option.value === selectedMonth)?.label} {selectedYear}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Department</p>
            <p className="font-medium">{campaign.department?.name ?? 'Any department'}</p>
          </div>
        </div>

        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Enable</TableHead>
                <TableHead>Team Lead</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Active BDs</TableHead>
                <TableHead>Weight</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Active</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assignmentDrafts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                    {campaign.department?.name
                      ? `No active Team Lead options were found in ${campaign.department.name}.`
                      : 'No Team Lead options are available right now.'}
                  </TableCell>
                </TableRow>
              ) : (
                assignmentDrafts.map((draft) => {
                  const teamLead = teamLeadMap.get(draft.teamLeadEmployeeId)
                  if (!teamLead) return null

                  return (
                    <TableRow key={draft.teamLeadEmployeeId}>
                      <TableCell>
                        <Checkbox
                          checked={draft.enabled}
                          onCheckedChange={(checked) =>
                            setAssignmentDrafts((current) =>
                              current.map((item) =>
                                item.teamLeadEmployeeId === draft.teamLeadEmployeeId
                                  ? { ...item, enabled: checked === true }
                                  : item
                              )
                            )
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{teamLead.name}</div>
                        <div className="text-xs text-muted-foreground">{teamLead.employeeCode}</div>
                      </TableCell>
                      <TableCell>{teamLead.department?.name ?? '—'}</TableCell>
                      <TableCell>{teamLead.activeBdCount}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={1}
                          value={draft.weight}
                          disabled={!draft.enabled}
                          onChange={(event) =>
                            setAssignmentDrafts((current) =>
                              current.map((item) =>
                                item.teamLeadEmployeeId === draft.teamLeadEmployeeId
                                  ? { ...item, weight: event.target.value }
                                  : item
                              )
                            )
                          }
                          className="w-24"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          value={draft.priority}
                          disabled={!draft.enabled}
                          onChange={(event) =>
                            setAssignmentDrafts((current) =>
                              current.map((item) =>
                                item.teamLeadEmployeeId === draft.teamLeadEmployeeId
                                  ? { ...item, priority: event.target.value }
                                  : item
                              )
                            )
                          }
                          className="w-24"
                        />
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={draft.isActive}
                          disabled={!draft.enabled}
                          onCheckedChange={(checked) =>
                            setAssignmentDrafts((current) =>
                              current.map((item) =>
                                item.teamLeadEmployeeId === draft.teamLeadEmployeeId
                                  ? { ...item, isActive: checked }
                                  : item
                              )
                            )
                          }
                        />
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    )
  }

  const renderDrawerFooter = () => {
    if (!drawer) return null

    const onSave = drawer.type === 'campaign' ? handleCampaignSave : handleAssignmentSave

    return (
      <SheetFooter className="shrink-0 border-t bg-background/95 p-4 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={closeDrawer} disabled={isSaving}>
          Cancel
        </Button>
        <Button type="button" onClick={onSave} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save changes'}
        </Button>
      </SheetFooter>
    )
  }

  if (!isAuthLoading && !hasAccess) {
    return (
      <ProtectedRoute>
        <div className="mx-auto w-full max-w-6xl p-4 md:p-6">
          <Card className="w-full">
            <CardHeader>
              <CardTitle>No access</CardTitle>
              <CardDescription>
                This Super Admin campaign console is restricted to Super Admin users.
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
              <Megaphone className="h-8 w-8 text-cyan-600" />
              CRM Campaigns
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage campaign routing and monthly Team Lead ownership for SaveMyLeads traffic.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="space-y-2">
              <Label>Month</Label>
              <Select value={month} onValueChange={setMonth}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Month" />
                </SelectTrigger>
                <SelectContent>
                  {MONTH_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={String(option.value)}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Year</Label>
              <Input
                type="number"
                min={2000}
                max={2100}
                value={year}
                onChange={(event) => setYear(event.target.value)}
                className="w-[140px]"
              />
            </div>
            <Button type="button" onClick={() => openCampaignDrawer()}>
              <Plus className="mr-2 h-4 w-4" />
              Add campaign
            </Button>
          </div>
        </div>

        {error && !isLoading && (
          <Card className="w-full border-amber-300 bg-amber-50/70">
            <CardHeader className="flex flex-row items-start gap-3 space-y-0">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
              <div className="space-y-1">
                <CardTitle>Unable to load campaign data</CardTitle>
                <CardDescription className="text-amber-900/80">{errorMessage}</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="pb-6">
              <Button type="button" variant="outline" onClick={refreshData}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry loading
              </Button>
            </CardContent>
          </Card>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="campaigns">
              <Megaphone className="h-4 w-4" />
              Campaigns
            </TabsTrigger>
            <TabsTrigger value="assignments">
              <Users className="h-4 w-4" />
              Assignments
            </TabsTrigger>
          </TabsList>

          <TabsContent value="campaigns">
            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                  <CardTitle>Campaign registry</CardTitle>
                  <CardDescription>
                    External campaign IDs map SaveMyLeads traffic into your CRM routing rules.
                  </CardDescription>
                </div>
                <Button type="button" variant="outline" onClick={() => openCampaignDrawer()}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add campaign
                </Button>
              </CardHeader>
              <CardContent>
                <div className="rounded-xl border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Campaign ID</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>Lead Source</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Circle</TableHead>
                        <TableHead>City</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-[120px] text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoading ? (
                        <TableRow>
                          <TableCell colSpan={10} className="py-10 text-center text-muted-foreground">
                            Loading campaigns...
                          </TableCell>
                        </TableRow>
                      ) : error ? (
                        <TableRow>
                          <TableCell colSpan={10} className="py-10 text-center text-muted-foreground">
                            Campaign data could not be loaded.
                          </TableCell>
                        </TableRow>
                      ) : (data?.campaigns.length ?? 0) === 0 ? (
                        <TableRow>
                          <TableCell colSpan={10} className="py-10 text-center text-muted-foreground">
                            No campaigns created yet.
                          </TableCell>
                        </TableRow>
                      ) : (
                        data?.campaigns.map((campaign) => (
                          <TableRow key={campaign.id}>
                            <TableCell className="font-mono text-sm">{campaign.externalCampaignId}</TableCell>
                            <TableCell className="font-medium">{campaign.displayName}</TableCell>
                            <TableCell>{campaign.source.name}</TableCell>
                            <TableCell>{campaign.leadSource.name}</TableCell>
                            <TableCell>{campaign.category ?? '—'}</TableCell>
                            <TableCell>{campaign.department?.name ?? '—'}</TableCell>
                            <TableCell>{campaign.circle.name}</TableCell>
                            <TableCell>{campaign.city?.name ?? '—'}</TableCell>
                            <TableCell>{statusBadge(campaign.isActive)}</TableCell>
                            <TableCell className="text-right">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => openCampaignDrawer(campaign)}
                              >
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
          </TabsContent>

          <TabsContent value="assignments">
            <Card>
              <CardHeader>
                <CardTitle>Monthly Team Lead assignments</CardTitle>
                <CardDescription>
                  Assign one or more Team Leads for the selected month and year, then webhook leads
                  route to BDs under the chosen Team Lead.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-xl border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Campaign</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>Lead Source</TableHead>
                        <TableHead>Circle</TableHead>
                        <TableHead>Assignments</TableHead>
                        <TableHead className="w-[140px] text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoading ? (
                        <TableRow>
                          <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                            Loading assignments...
                          </TableCell>
                        </TableRow>
                      ) : error ? (
                        <TableRow>
                          <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                            Assignment data could not be loaded.
                          </TableCell>
                        </TableRow>
                      ) : (data?.campaigns.length ?? 0) === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                            Add a campaign first to manage assignments.
                          </TableCell>
                        </TableRow>
                      ) : (
                        data?.campaigns.map((campaign) => (
                          <TableRow key={campaign.id}>
                            <TableCell>
                              <div className="font-medium">{campaign.displayName}</div>
                              <div className="font-mono text-xs text-muted-foreground">
                                {campaign.externalCampaignId}
                              </div>
                            </TableCell>
                            <TableCell>{campaign.source.name}</TableCell>
                            <TableCell>{campaign.leadSource.name}</TableCell>
                            <TableCell>{campaign.circle.name}</TableCell>
                            <TableCell className="max-w-[360px] text-sm text-muted-foreground">
                              {assignmentSummary(campaign.assignments)}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => openAssignmentDrawer(campaign)}
                              >
                                <Route className="mr-2 h-4 w-4" />
                                Configure
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
          </TabsContent>
        </Tabs>
      </div>

      <Sheet open={Boolean(drawer)} onOpenChange={(open) => !open && closeDrawer()}>
        <SheetContent
          side="right"
          className="flex h-full w-full max-w-2xl flex-col gap-0 overflow-hidden rounded-none border-l p-0 sm:max-w-2xl"
        >
          <SheetHeader className="shrink-0 border-b p-4 text-left">
            <SheetTitle>{drawerTitle}</SheetTitle>
            <SheetDescription>{drawerDescription}</SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto p-4">{renderDrawerBody()}</div>
          {renderDrawerFooter()}
        </SheetContent>
      </Sheet>
    </ProtectedRoute>
  )
}
