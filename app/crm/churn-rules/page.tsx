'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Edit, Plus, RefreshCw, Route } from 'lucide-react'
import { ProtectedRoute } from '@/components/protected-route'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox'
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
import { toast } from 'sonner'

type ScopeOption = {
  key: string
  scopeType: 'GLOBAL' | 'ADMIN' | 'SALES_HEAD' | 'TEAM_LEAD'
  scopeUserId: string | null
  label: string
  description: string
  user: {
    id: string
    name: string
    email: string
    role: string
  } | null
}

type RuleRecord = {
  id: string
  scopeType: ScopeOption['scopeType']
  scopeUserId: string | null
  scopeKey: string
  scopeLabel: string
  scopeDescription: string
  behavior: 'RESET_TO_NEW_LEAD' | 'SET_FOLLOW_UP_DATE'
  followUpDays: number | null
  isActive: boolean
  updatedAt: string
  updatedByName: string | null
  user: ScopeOption['user']
}

type ChurnRulesResponse = {
  currentUser: {
    id: string
    role: string
    canManageGlobal: boolean
  }
  scopes: ScopeOption[]
  rules: RuleRecord[]
  precedence: string[]
}

type DrawerState =
  | { mode: 'create' }
  | { mode: 'edit'; rule: RuleRecord }
  | null

type RuleFormState = {
  scopeKey: string
  behavior: 'RESET_TO_NEW_LEAD' | 'SET_FOLLOW_UP_DATE'
  followUpDays: string
  isActive: boolean
}

function createEmptyForm(scopeKey: string): RuleFormState {
  return {
    scopeKey,
    behavior: 'RESET_TO_NEW_LEAD',
    followUpDays: '1',
    isActive: true,
  }
}

function buildForm(rule: RuleRecord): RuleFormState {
  return {
    scopeKey: rule.scopeKey,
    behavior: rule.behavior,
    followUpDays: String(rule.followUpDays ?? 1),
    isActive: rule.isActive,
  }
}

function formatBehavior(rule: Pick<RuleRecord, 'behavior' | 'followUpDays'>) {
  if (rule.behavior === 'RESET_TO_NEW_LEAD') {
    return 'Reset to New Lead'
  }

  return `Follow-up 1 in ${rule.followUpDays ?? 1} day${(rule.followUpDays ?? 1) === 1 ? '' : 's'}`
}

function formatUpdatedAt(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return 'Unknown'
  }
  return date.toLocaleString()
}

export default function CrmChurnRulesPage() {
  const queryClient = useQueryClient()
  const { user, isLoading: isAuthLoading } = useAuth()
  const [drawer, setDrawer] = useState<DrawerState>(null)
  const [form, setForm] = useState<RuleFormState>(createEmptyForm(''))

  const hasAccess =
    user?.role === 'SUPER_ADMIN' ||
    user?.role === 'ADMIN' ||
    user?.role === 'SALES_HEAD' ||
    user?.role === 'TEAM_LEAD'

  const { data, isLoading, error } = useQuery<ChurnRulesResponse, Error>({
    queryKey: ['crm-churn-rules'],
    queryFn: () => apiGet<ChurnRulesResponse>('/api/crm/churn-rules'),
    enabled: hasAccess,
    retry: false,
  })

  const rules = data?.rules ?? []
  const scopes = data?.scopes ?? []
  const usedScopeKeys = new Set(rules.map((rule) => rule.scopeKey))
  const availableCreateScopes = scopes.filter((scope) => !usedScopeKeys.has(scope.key))

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => apiPost('/api/crm/churn-rules', payload),
    onSuccess: () => {
      toast.success('Churn rule created')
      setDrawer(null)
      void queryClient.invalidateQueries({ queryKey: ['crm-churn-rules'] })
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to create churn rule'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) =>
      apiPatch(`/api/crm/churn-rules/${id}`, payload),
    onSuccess: () => {
      toast.success('Churn rule updated')
      setDrawer(null)
      void queryClient.invalidateQueries({ queryKey: ['crm-churn-rules'] })
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to update churn rule'),
  })

  const isSaving = createMutation.isPending || updateMutation.isPending
  const selectedScope =
    scopes.find((scope) => scope.key === form.scopeKey) ??
    availableCreateScopes.find((scope) => scope.key === form.scopeKey) ??
    null

  const openCreateDrawer = () => {
    const firstScope = availableCreateScopes[0]?.key ?? ''
    setForm(createEmptyForm(firstScope))
    setDrawer({ mode: 'create' })
  }

  const openEditDrawer = (rule: RuleRecord) => {
    setForm(buildForm(rule))
    setDrawer({ mode: 'edit', rule })
  }

  const handleSave = () => {
    if (!drawer) return

    if (!form.scopeKey && drawer.mode === 'create') {
      toast.error('Select a scope first')
      return
    }

    const followUpDays =
      form.behavior === 'SET_FOLLOW_UP_DATE'
        ? Number.parseInt(form.followUpDays, 10)
        : null

    if (
      form.behavior === 'SET_FOLLOW_UP_DATE' &&
      (!Number.isFinite(followUpDays ?? Number.NaN) || (followUpDays ?? 0) < 1)
    ) {
      toast.error('Follow-up days must be at least 1')
      return
    }

    if (drawer.mode === 'create') {
      const scope = scopes.find((item) => item.key === form.scopeKey)
      if (!scope) {
        toast.error('Selected scope is no longer available')
        return
      }

      createMutation.mutate({
        scopeType: scope.scopeType,
        scopeUserId: scope.scopeUserId,
        behavior: form.behavior,
        followUpDays,
        isActive: form.isActive,
      })
      return
    }

    updateMutation.mutate({
      id: drawer.rule.id,
      payload: {
        behavior: form.behavior,
        followUpDays,
        isActive: form.isActive,
      },
    })
  }

  if (!hasAccess && !isAuthLoading) {
    return (
      <ProtectedRoute>
        <div className="mx-auto max-w-5xl p-4 md:p-6">
          <Card>
            <CardHeader>
              <CardTitle>No access</CardTitle>
              <CardDescription>
                Only Super Admin, Admin, Sales Head, and Team Lead roles can manage churn reassignment rules.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-3xl font-bold">
              <Route className="h-8 w-8" />
              CRM Churn Rules
            </h1>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => void queryClient.invalidateQueries({ queryKey: ['crm-churn-rules'] })}
              disabled={isLoading}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button onClick={openCreateDrawer} disabled={availableCreateScopes.length === 0}>
              <Plus className="mr-2 h-4 w-4" />
              Add rule
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Configured scopes</CardTitle>
            <CardDescription>
              Each scope can have one rule. Super Admin can manage the global override plus all sales-head and team-level scopes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error ? (
              <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                <div className="text-sm">
                  {error.message || 'We could not load churn rules right now.'}
                </div>
              </div>
            ) : null}

            {isLoading ? (
              <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
                Loading churn rules...
              </div>
            ) : rules.length === 0 ? (
              <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
                No churn rules have been added yet.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Scope</TableHead>
                      <TableHead>Behavior</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Updated</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rules.map((rule) => (
                      <TableRow key={rule.id}>
                        <TableCell className="align-top">
                          <div className="font-medium">{rule.scopeLabel}</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {rule.scopeDescription}
                          </div>
                        </TableCell>
                        <TableCell className="align-top text-sm">
                          {formatBehavior(rule)}
                        </TableCell>
                        <TableCell className="align-top">
                          {rule.isActive ? (
                            <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">Active</Badge>
                          ) : (
                            <Badge variant="secondary">Inactive</Badge>
                          )}
                        </TableCell>
                        <TableCell className="align-top text-sm text-muted-foreground">
                          {formatUpdatedAt(rule.updatedAt)}
                          {rule.updatedByName ? ` · ${rule.updatedByName}` : ''}
                        </TableCell>
                        <TableCell className="text-right align-top">
                          <Button variant="ghost" size="sm" onClick={() => openEditDrawer(rule)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Sheet open={!!drawer} onOpenChange={(open) => !open && setDrawer(null)}>
          <SheetContent side="right" className="w-full max-w-xl p-0">
            <SheetHeader className="border-b">
              <SheetTitle>{drawer?.mode === 'edit' ? 'Edit churn rule' : 'Add churn rule'}</SheetTitle>
              <SheetDescription>
                Manage what happens after a `Junk` or `Churned` lead is automatically reassigned within the same team.
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-5 px-4 py-4">
              <div className="space-y-2">
                <Label>Scope</Label>
                {drawer?.mode === 'edit' ? (
                  <div className="rounded-xl border bg-muted/30 px-3 py-3">
                    <div className="font-medium">{drawer.rule.scopeLabel}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {drawer.rule.scopeDescription}
                    </div>
                  </div>
                ) : (
                  <Combobox<ScopeOption>
                    items={availableCreateScopes}
                    value={selectedScope}
                    onValueChange={(scope) =>
                      setForm((current) => ({ ...current, scopeKey: scope?.key ?? '' }))
                    }
                    itemToStringLabel={(scope) => `${scope.label} ${scope.description}`}
                    isItemEqualToValue={(left, right) => left?.key === right?.key}
                  >
                    <ComboboxInput
                      placeholder="Search scope by manager or hierarchy"
                      className="w-full"
                      showClear
                    />
                    <ComboboxContent>
                      <ComboboxEmpty>No available scopes left to add.</ComboboxEmpty>
                      <ComboboxList>
                        {(scope: ScopeOption) => (
                          <ComboboxItem key={scope.key} value={scope}>
                            <div className="min-w-0">
                              <div className="truncate font-medium">{scope.label}</div>
                              <div className="truncate text-xs opacity-80">
                                {scope.description}
                              </div>
                            </div>
                          </ComboboxItem>
                        )}
                      </ComboboxList>
                    </ComboboxContent>
                  </Combobox>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="churn-rule-behavior">Post-reassignment behavior</Label>
                <Select
                  value={form.behavior}
                  onValueChange={(value: RuleFormState['behavior']) =>
                    setForm((current) => ({ ...current, behavior: value }))
                  }
                >
                  <SelectTrigger id="churn-rule-behavior">
                    <SelectValue placeholder="Select behavior" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RESET_TO_NEW_LEAD">Reset to New Lead</SelectItem>
                    <SelectItem value="SET_FOLLOW_UP_DATE">Set Follow-up Date</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {form.behavior === 'SET_FOLLOW_UP_DATE' ? (
                <div className="space-y-2">
                  <Label htmlFor="churn-rule-follow-up-days">Follow-up after (days)</Label>
                  <Input
                    id="churn-rule-follow-up-days"
                    type="number"
                    min={1}
                    max={60}
                    value={form.followUpDays}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, followUpDays: event.target.value }))
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    The reassigned lead will move to `Follow-up 1` and get a follow-up date after this many days.
                  </p>
                </div>
              ) : null}

              <div className="flex items-start justify-between gap-4 rounded-xl border p-4">
                <div>
                  <p className="text-sm font-medium">Active rule</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Inactive rules stay saved but are skipped during automatic churn reassignment.
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

            <SheetFooter className="border-t">
              <Button variant="outline" onClick={() => setDrawer(null)} disabled={isSaving}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving || !drawer}>
                {drawer?.mode === 'edit' ? 'Save changes' : 'Create rule'}
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>
    </ProtectedRoute>
  )
}
