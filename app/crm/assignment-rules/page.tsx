'use client'

import { useDeferredValue, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { GitBranch, Pencil, Play, Plus, ShieldCheck, Trash2, Users } from 'lucide-react'
import { ProtectedRoute } from '@/components/protected-route'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { apiDelete, apiGet, apiPatch, apiPost } from '@/lib/api-client'
import { getRoleLabel } from '@/lib/roles'
import { toast } from 'sonner'

type AssignmentStrategy = 'TARGET_BALANCED' | 'ROUND_ROBIN' | 'MANUAL_POOL_ORDER'

type DepartmentOption = {
  id: string
  name: string
}

type EligibleMember = {
  id: string
  employeeCode: string | null
  circle: string | null
  designation: string | null
  departmentId: string | null
  department: DepartmentOption | null
  managerId: string | null
  manager: {
    id: string
    userId: string
    user: {
      id: string
      name: string
      role: string
    }
  } | null
  user: {
    id: string
    name: string
    role: string
  }
}

type AssignmentRuleMember = {
  id: string
  employeeId: string
  priority: number
  isActive: boolean
  employee: EligibleMember
}

type AssignmentRule = {
  id: string
  name: string
  description: string | null
  isActive: boolean
  priority: number
  city: string | null
  category: string | null
  departmentId: string | null
  strategy: AssignmentStrategy
  department: DepartmentOption | null
  createdBy?: {
    id: string
    name: string
    role: string
  } | null
  updatedBy?: {
    id: string
    name: string
    role: string
  } | null
  members: AssignmentRuleMember[]
  createdAt?: string
  updatedAt?: string
}

type AssignmentOptionsResponse = {
  currentUser: {
    canViewRules: boolean
    canManageRules: boolean
    canDryRun: boolean
  }
  departments: DepartmentOption[]
  eligibleMembers: EligibleMember[]
}

type DryRunMetrics = {
  assignedThisMonth: number
  openLeadCount: number
  lastAssignedAt: string | null
}

type DryRunResult = {
  input: {
    leadId: string | null
    city: string | null
    category: string | null
    departmentId: string | null
    assignmentDate: string
  }
  matchedRule: {
    id: string
    name: string
    strategy: AssignmentStrategy
    priority: number
    city: string | null
    category: string | null
    departmentId: string | null
    departmentName: string | null
    specificity: number
  } | null
  assignment: {
    bd: { employeeId: string; userId: string; name: string }
    teamLead: { employeeId: string; userId: string; name: string } | null
    salesHead: { employeeId: string; userId: string; name: string } | null
    managementChain: Array<{ employeeId: string; userId: string; name: string; role: string }>
    metrics: DryRunMetrics
  } | null
  candidateDiagnostics: Array<{
    employeeId: string
    userId: string
    employeeName: string
    eligible: boolean
    reason: string
    metrics?: DryRunMetrics
  }>
  explanation: string
}

type RuleMemberDraft = {
  employeeId: string
  isActive: boolean
}

type RuleFormState = {
  id: string | null
  name: string
  description: string
  isActive: boolean
  priority: string
  city: string
  category: string
  departmentId: string
  strategy: AssignmentStrategy
  members: RuleMemberDraft[]
}

type DryRunFormState = {
  leadId: string
  city: string
  category: string
  departmentId: string
  assignmentDate: string
}

function getTodayValue() {
  return new Date().toISOString().slice(0, 10)
}

function createEmptyRuleForm(): RuleFormState {
  return {
    id: null,
    name: '',
    description: '',
    isActive: true,
    priority: '100',
    city: '',
    category: '',
    departmentId: 'all',
    strategy: 'ROUND_ROBIN',
    members: [],
  }
}

function createEmptyDryRunForm(): DryRunFormState {
  return {
    leadId: '',
    city: '',
    category: '',
    departmentId: 'all',
    assignmentDate: getTodayValue(),
  }
}

function ruleToFormState(rule: AssignmentRule): RuleFormState {
  return {
    id: rule.id,
    name: rule.name,
    description: rule.description ?? '',
    isActive: rule.isActive,
    priority: String(rule.priority),
    city: rule.city ?? '',
    category: rule.category ?? '',
    departmentId: rule.departmentId ?? 'all',
    strategy: rule.strategy,
    members: rule.members.map((member) => ({
      employeeId: member.employeeId,
      isActive: member.isActive,
    })),
  }
}

function buildRulePayload(form: RuleFormState) {
  return {
    name: form.name.trim(),
    description: form.description.trim() || null,
    isActive: form.isActive,
    priority: Number.parseInt(form.priority, 10) || 0,
    city: form.city.trim() || null,
    category: form.category.trim() || null,
    departmentId: form.departmentId === 'all' ? null : form.departmentId,
    strategy: form.strategy,
    members: form.members.map((member) => ({
      employeeId: member.employeeId,
      isActive: member.isActive,
    })),
  }
}

function formatScope(rule: AssignmentRule) {
  const parts: string[] = []
  if (rule.city) parts.push(`City: ${rule.city}`)
  if (rule.category) parts.push(`Category: ${rule.category}`)
  if (rule.department?.name) parts.push(`Department: ${rule.department.name}`)
  return parts.length > 0 ? parts : ['Fallback rule']
}

export default function CrmAssignmentRulesPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [memberSearch, setMemberSearch] = useState('')
  const deferredSearch = useDeferredValue(search)
  const deferredMemberSearch = useDeferredValue(memberSearch)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<RuleFormState>(createEmptyRuleForm())
  const [dryRunForm, setDryRunForm] = useState<DryRunFormState>(createEmptyDryRunForm())

  const optionsQuery = useQuery<AssignmentOptionsResponse>({
    queryKey: ['crm-assignment-options'],
    queryFn: () => apiGet<AssignmentOptionsResponse>('/api/crm/assignment-rules/options'),
    retry: false,
  })

  const canViewRules = optionsQuery.data?.currentUser.canViewRules ?? false
  const canManageRules = optionsQuery.data?.currentUser.canManageRules ?? false
  const canDryRun = optionsQuery.data?.currentUser.canDryRun ?? false
  const canReadRules = canViewRules || canManageRules

  const rulesQuery = useQuery<AssignmentRule[]>({
    queryKey: ['crm-assignment-rules'],
    queryFn: () => apiGet<AssignmentRule[]>('/api/crm/assignment-rules'),
    enabled: canReadRules,
    retry: false,
  })

  const saveRuleMutation = useMutation({
    mutationFn: async () => {
      const payload = buildRulePayload(form)
      if (form.id) {
        return apiPatch<AssignmentRule>(`/api/crm/assignment-rules/${form.id}`, payload)
      }
      return apiPost<AssignmentRule>('/api/crm/assignment-rules', payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-assignment-rules'] })
      toast.success(form.id ? 'Assignment rule updated' : 'Assignment rule created')
      setDialogOpen(false)
      setForm(createEmptyRuleForm())
      setMemberSearch('')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to save assignment rule')
    },
  })

  const deleteRuleMutation = useMutation({
    mutationFn: (ruleId: string) => apiDelete(`/api/crm/assignment-rules/${ruleId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-assignment-rules'] })
      toast.success('Assignment rule deleted')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete assignment rule')
    },
  })

  const dryRunMutation = useMutation({
    mutationFn: () => {
      const payload: Record<string, string | null> = {}
      if (dryRunForm.leadId.trim()) payload.leadId = dryRunForm.leadId.trim()
      if (dryRunForm.city.trim()) payload.city = dryRunForm.city.trim()
      if (dryRunForm.category.trim()) payload.category = dryRunForm.category.trim()
      if (dryRunForm.departmentId !== 'all') payload.departmentId = dryRunForm.departmentId
      if (dryRunForm.assignmentDate) {
        payload.assignmentDate = new Date(`${dryRunForm.assignmentDate}T00:00:00`).toISOString()
      }
      return apiPost<DryRunResult>('/api/crm/assignment-rules/dry-run', payload)
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to run assignment preview')
    },
  })

  const rules = rulesQuery.data ?? []
  const eligibleMembers = optionsQuery.data?.eligibleMembers ?? []
  const departments = optionsQuery.data?.departments ?? []

  const filteredRules = rules.filter((rule) => {
    if (!deferredSearch.trim()) return true
    const haystack = [
      rule.name,
      rule.description ?? '',
      rule.city ?? '',
      rule.category ?? '',
      rule.department?.name ?? '',
    ]
      .join(' ')
      .toLowerCase()
    return haystack.includes(deferredSearch.trim().toLowerCase())
  })

  const selectedMembers = form.members.reduce<Array<{ draft: RuleMemberDraft; employee: EligibleMember }>>(
    (list, member) => {
      const employee = eligibleMembers.find((candidate) => candidate.id === member.employeeId)
      if (employee) {
        list.push({ draft: member, employee })
      }
      return list
    },
    []
  )

  const visibleMembers = eligibleMembers.filter((employee) => {
    const query = deferredMemberSearch.trim().toLowerCase()
    if (!query) return true
    const haystack = [
      employee.user.name,
      employee.employeeCode ?? '',
      employee.circle ?? '',
      employee.designation ?? '',
      employee.department?.name ?? '',
      employee.manager?.user.name ?? '',
    ]
      .join(' ')
      .toLowerCase()
    return haystack.includes(query)
  })

  const openCreateDialog = () => {
    setForm(createEmptyRuleForm())
    setMemberSearch('')
    setDialogOpen(true)
  }

  const openEditDialog = (rule: AssignmentRule) => {
    setForm(ruleToFormState(rule))
    setMemberSearch('')
    setDialogOpen(true)
  }

  const updateFormField = <K extends keyof RuleFormState>(key: K, value: RuleFormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const toggleMember = (employeeId: string, enabled: boolean) => {
    setForm((current) => {
      if (enabled) {
        if (current.members.some((member) => member.employeeId === employeeId)) return current
        return {
          ...current,
          members: [
            ...current.members,
            {
              employeeId,
              isActive: true,
            },
          ],
        }
      }
      return {
        ...current,
        members: current.members.filter((member) => member.employeeId !== employeeId),
      }
    })
  }

  const updateMember = (
    employeeId: string,
    key: keyof RuleMemberDraft,
    value: RuleMemberDraft[keyof RuleMemberDraft]
  ) => {
    setForm((current) => ({
      ...current,
      members: current.members.map((member) =>
        member.employeeId === employeeId ? { ...member, [key]: value } : member
      ),
    }))
  }

  const handleDeleteRule = (rule: AssignmentRule) => {
    if (!window.confirm(`Delete assignment rule "${rule.name}"?`)) return
    deleteRuleMutation.mutate(rule.id)
  }

  const handleRunDryPreview = () => {
    dryRunMutation.mutate()
  }

  const noPageAccess =
    !optionsQuery.isLoading &&
    !canReadRules &&
    !canDryRun

  if ((optionsQuery.error || noPageAccess) && !optionsQuery.isLoading) {
    return (
      <ProtectedRoute>
        <div className="mx-auto max-w-[1000px] p-4 md:p-6">
          <Card className="w-full">
            <CardHeader>
              <CardTitle>No access</CardTitle>
              <CardDescription>
                You do not have permission to view CRM assignment rules or assignment previews.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <div className="mx-auto max-w-[1500px] space-y-6 p-4 md:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-3xl font-bold">
              <GitBranch className="h-8 w-8" />
              CRM Assignment Rules
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              Configure category and department pools for lead auto-assignment, then preview how
              leave checks, employee circles, and round-robin selection behave before wiring the
              same logic into live MySQL lead intake.
            </p>
          </div>
          {canManageRules && (
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4" />
              New Rule
            </Button>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Active rules</CardDescription>
              <CardTitle>{rules.filter((rule) => rule.isActive).length}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Eligible BD pool</CardDescription>
              <CardTitle>{eligibleMembers.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>CRM controls</CardDescription>
              <CardTitle className="text-base font-semibold">
                {canManageRules ? 'Manage + preview' : canDryRun ? 'Preview only' : 'View only'}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        {canDryRun && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" />
                Assignment Dry Run
              </CardTitle>
              <CardDescription>
                Preview rule matching plus leave-aware, circle-aware, department-aware round-robin
                selection without changing any live lead assignment.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                <div className="space-y-2">
                  <Label htmlFor="dry-lead-id">Lead ID</Label>
                  <Input
                    id="dry-lead-id"
                    placeholder="Optional existing lead ID"
                    value={dryRunForm.leadId}
                    onChange={(event) =>
                      setDryRunForm((current) => ({ ...current, leadId: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dry-city">City</Label>
                  <Input
                    id="dry-city"
                    placeholder="e.g. Indore"
                    value={dryRunForm.city}
                    onChange={(event) =>
                      setDryRunForm((current) => ({ ...current, city: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dry-category">Category</Label>
                  <Input
                    id="dry-category"
                    placeholder="e.g. IPD"
                    value={dryRunForm.category}
                    onChange={(event) =>
                      setDryRunForm((current) => ({ ...current, category: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Department</Label>
                  <Select
                    value={dryRunForm.departmentId}
                    onValueChange={(value) =>
                      setDryRunForm((current) => ({ ...current, departmentId: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All departments" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All departments</SelectItem>
                      {departments.map((department) => (
                        <SelectItem key={department.id} value={department.id}>
                          {department.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dry-date">Assignment date</Label>
                  <Input
                    id="dry-date"
                    type="date"
                    value={dryRunForm.assignmentDate}
                    onChange={(event) =>
                      setDryRunForm((current) => ({ ...current, assignmentDate: event.target.value }))
                    }
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleRunDryPreview} disabled={dryRunMutation.isPending}>
                  <Play className="h-4 w-4" />
                  {dryRunMutation.isPending ? 'Running preview...' : 'Run Preview'}
                </Button>
              </div>

              {dryRunMutation.data && (
                <div className="space-y-4 rounded-2xl border p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-sm font-semibold">Preview result</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {dryRunMutation.data.explanation}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {dryRunMutation.data.matchedRule ? (
                        <Badge>{dryRunMutation.data.matchedRule.name}</Badge>
                      ) : (
                        <Badge variant="secondary">No matching rule</Badge>
                      )}
                      {dryRunMutation.data.assignment ? (
                        <Badge variant="secondary">
                          Assigned to {dryRunMutation.data.assignment.bd.name}
                        </Badge>
                      ) : null}
                    </div>
                  </div>

                  {dryRunMutation.data.assignment && (
                    <div className="grid gap-4 lg:grid-cols-3">
                      <div className="rounded-xl border p-4">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                          Business Developer
                        </p>
                        <p className="mt-1 font-semibold">{dryRunMutation.data.assignment.bd.name}</p>
                        <p className="mt-3 text-sm text-muted-foreground">
                          Month assigned: {dryRunMutation.data.assignment.metrics.assignedThisMonth}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Open leads: {dryRunMutation.data.assignment.metrics.openLeadCount}
                        </p>
                      </div>
                      <div className="rounded-xl border p-4">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                          Team Lead
                        </p>
                        <p className="mt-1 font-semibold">
                          {dryRunMutation.data.assignment.teamLead?.name ?? 'Not found'}
                        </p>
                        <p className="mt-3 text-sm text-muted-foreground">
                          Sales Head: {dryRunMutation.data.assignment.salesHead?.name ?? 'Not found'}
                        </p>
                      </div>
                      <div className="rounded-xl border p-4">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                          Rule Match
                        </p>
                        <p className="mt-1 font-semibold">
                          {dryRunMutation.data.matchedRule?.name ?? 'No rule'}
                        </p>
                        <p className="mt-3 text-sm text-muted-foreground">
                          Category: {dryRunMutation.data.input.category ?? 'Not provided'}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Department: {dryRunMutation.data.matchedRule?.departmentName ?? 'Derived from pool'}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold">Candidate diagnostics</p>
                      <Badge variant="secondary">
                        {dryRunMutation.data.candidateDiagnostics.length} checked
                      </Badge>
                    </div>
                    <div className="overflow-x-auto rounded-xl border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Candidate</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Reason</TableHead>
                            <TableHead>Month assigned</TableHead>
                            <TableHead>Open leads</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {dryRunMutation.data.candidateDiagnostics.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                                No pool candidates were evaluated for this preview.
                              </TableCell>
                            </TableRow>
                          ) : (
                            dryRunMutation.data.candidateDiagnostics.map((candidate) => (
                              <TableRow key={candidate.employeeId}>
                                <TableCell className="font-medium">{candidate.employeeName}</TableCell>
                                <TableCell>
                                  <Badge variant={candidate.eligible ? 'default' : 'secondary'}>
                                    {candidate.eligible ? 'Eligible' : 'Skipped'}
                                  </Badge>
                                </TableCell>
                                <TableCell className="max-w-[360px] text-sm text-muted-foreground">
                                  {candidate.reason}
                                </TableCell>
                                <TableCell>{candidate.metrics?.assignedThisMonth ?? '-'}</TableCell>
                                <TableCell>{candidate.metrics?.openLeadCount ?? '-'}</TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {canReadRules && (
          <Card>
            <CardHeader>
              <CardTitle>Rule Registry</CardTitle>
              <CardDescription>
                Rules still provide category and department pools. Leave checks, employee-circle
                filtering, and round-robin selection now happen automatically in the assignment
                engine.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <Input
                  className="sm:max-w-sm"
                  placeholder="Search rules by name or scope..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
                <p className="text-sm text-muted-foreground">
                  {filteredRules.length} of {rules.length} rules
                </p>
              </div>

              <div className="overflow-x-auto rounded-xl border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rule</TableHead>
                      <TableHead>Scope</TableHead>
                      <TableHead>Pool</TableHead>
                      <TableHead>Status</TableHead>
                      {canManageRules && <TableHead className="text-right">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rulesQuery.isLoading ? (
                      <TableRow>
                        <TableCell colSpan={canManageRules ? 5 : 4} className="text-center text-sm text-muted-foreground">
                          Loading assignment rules...
                        </TableCell>
                      </TableRow>
                    ) : rulesQuery.error ? (
                      <TableRow>
                        <TableCell colSpan={canManageRules ? 5 : 4} className="text-center text-sm text-muted-foreground">
                          Failed to load assignment rules.
                        </TableCell>
                      </TableRow>
                    ) : filteredRules.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={canManageRules ? 5 : 4} className="text-center text-sm text-muted-foreground">
                          No assignment rules found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredRules.map((rule) => (
                        <TableRow key={rule.id}>
                          <TableCell className="min-w-[240px] align-top">
                            <div>
                              <p className="font-medium">{rule.name}</p>
                              {rule.description && (
                                <p className="mt-1 text-sm text-muted-foreground">{rule.description}</p>
                              )}
                              <p className="mt-2 text-xs text-muted-foreground">
                                Priority {rule.priority}
                                {rule.updatedBy?.name ? ` • Updated by ${rule.updatedBy.name}` : ''}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="min-w-[260px] align-top">
                            <div className="flex flex-wrap gap-2">
                              {formatScope(rule).map((item) => (
                                <Badge key={item} variant="secondary">
                                  {item}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell className="align-top">
                            <div className="space-y-1">
                              <p className="font-medium">{rule.members.length} members</p>
                              <p className="text-xs text-muted-foreground">
                                {rule.members.filter((member) => member.isActive).length} active in pool
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="align-top">
                            <Badge variant={rule.isActive ? 'default' : 'secondary'}>
                              {rule.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </TableCell>
                          {canManageRules && (
                            <TableCell className="align-top">
                              <div className="flex justify-end gap-2">
                                <Button variant="outline" size="sm" onClick={() => openEditDialog(rule)}>
                                  <Pencil className="h-4 w-4" />
                                  Edit
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => handleDeleteRule(rule)}
                                  disabled={deleteRuleMutation.isPending}
                                >
                                  <Trash2 className="h-4 w-4" />
                                  Delete
                                </Button>
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open)
            if (!open) {
              setMemberSearch('')
            }
          }}
        >
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
            <DialogHeader>
              <DialogTitle>{form.id ? 'Edit assignment rule' : 'Create assignment rule'}</DialogTitle>
              <DialogDescription>
                Define the category and department pool here. Employee circles, leave checks, and
                round-robin distribution are handled automatically during assignment.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="rule-name">Rule name</Label>
                    <Input
                      id="rule-name"
                      value={form.name}
                      onChange={(event) => updateFormField('name', event.target.value)}
                      placeholder="North IPD fallback"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="rule-description">Description</Label>
                    <Textarea
                      id="rule-description"
                      value={form.description}
                      onChange={(event) => updateFormField('description', event.target.value)}
                      placeholder="Optional notes about why this pool exists"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rule-category">Category</Label>
                    <Input
                      id="rule-category"
                      value={form.category}
                      onChange={(event) => updateFormField('category', event.target.value)}
                      placeholder="Any category when blank"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Department</Label>
                    <Select
                      value={form.departmentId}
                      onValueChange={(value) => updateFormField('departmentId', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Any department" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Any department</SelectItem>
                        {departments.map((department) => (
                          <SelectItem key={department.id} value={department.id}>
                            {department.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rule-priority">Rule priority</Label>
                    <Input
                      id="rule-priority"
                      type="number"
                      min={0}
                      value={form.priority}
                      onChange={(event) => updateFormField('priority', event.target.value)}
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-xl border p-3">
                    <div>
                      <p className="text-sm font-medium">Rule active</p>
                      <p className="text-xs text-muted-foreground">
                        Inactive rules stay saved but are ignored during matching.
                      </p>
                    </div>
                    <Switch
                      checked={form.isActive}
                      onCheckedChange={(checked) => updateFormField('isActive', checked === true)}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">Selected BD pool</h3>
                      <p className="text-sm text-muted-foreground">
                        These members are the only BDs considered after the rule matches.
                      </p>
                    </div>
                    <Badge variant="secondary">{selectedMembers.length} selected</Badge>
                  </div>

                  <div className="overflow-x-auto rounded-xl border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Member</TableHead>
                          <TableHead>Active</TableHead>
                          <TableHead className="text-right">Remove</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedMembers.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center text-sm text-muted-foreground">
                              No BD selected yet.
                            </TableCell>
                          </TableRow>
                        ) : (
                          selectedMembers.map(({ draft, employee }) => (
                            <TableRow key={draft.employeeId}>
                              <TableCell>
                                <div>
                                  <p className="font-medium">{employee.user.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {employee.employeeCode ?? 'No code'}
                                    {employee.circle ? ` • ${employee.circle}` : ''}
                                    {employee.department?.name ? ` • ${employee.department.name}` : ''}
                                  </p>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Switch
                                  checked={draft.isActive}
                                  onCheckedChange={(checked) =>
                                    updateMember(draft.employeeId, 'isActive', checked === true)
                                  }
                                />
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => toggleMember(draft.employeeId, false)}
                                >
                                  Remove
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">Eligible BD directory</h3>
                    <p className="text-sm text-muted-foreground">
                      Active BD employees only. Circle and department filters happen automatically
                      during assignment preview.
                    </p>
                  </div>
                  <Badge variant="secondary">
                    <Users className="mr-1 h-3.5 w-3.5" />
                    {eligibleMembers.length}
                  </Badge>
                </div>

                <Input
                  placeholder="Search by name, code, circle, department, or manager..."
                  value={memberSearch}
                  onChange={(event) => setMemberSearch(event.target.value)}
                />

                <div className="max-h-[500px] space-y-3 overflow-y-auto rounded-xl border p-3">
                  {visibleMembers.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No matching BD employees found.</p>
                  ) : (
                    visibleMembers.map((employee) => {
                      const checked = form.members.some((member) => member.employeeId === employee.id)
                      return (
                        <label
                          key={employee.id}
                          className="flex cursor-pointer items-start gap-3 rounded-xl border p-3"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(value) => toggleMember(employee.id, value === true)}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium">{employee.user.name}</p>
                              <Badge variant="secondary">{getRoleLabel(employee.user.role)}</Badge>
                              {employee.department?.name ? (
                                <Badge variant="outline">{employee.department.name}</Badge>
                              ) : null}
                            </div>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {employee.employeeCode ?? 'No employee code'}
                              {employee.circle ? ` • ${employee.circle}` : ''}
                              {employee.designation ? ` • ${employee.designation}` : ''}
                            </p>
                            {employee.manager?.user ? (
                              <p className="mt-1 text-xs text-muted-foreground">
                                Reports to {employee.manager.user.name} (
                                {getRoleLabel(employee.manager.user.role)})
                              </p>
                            ) : null}
                          </div>
                        </label>
                      )
                    })
                  )}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => saveRuleMutation.mutate()}
                disabled={saveRuleMutation.isPending || !form.name.trim()}
              >
                {saveRuleMutation.isPending
                  ? 'Saving...'
                  : form.id
                    ? 'Update rule'
                    : 'Create rule'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </ProtectedRoute>
  )
}
