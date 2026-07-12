'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ProtectedRoute } from '@/components/protected-route'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox'
import { apiGet, apiPatch } from '@/lib/api-client'
import { getRoleLabel } from '@/lib/roles'
import { AlertTriangle, Building2, Mail, ShieldCheck, UserRound, Users } from 'lucide-react'
import { toast } from 'sonner'

type PermissionState = {
  enabled: boolean
  source: 'default' | 'override'
}

type MatrixPermission = {
  key: string
  label: string
  description: string
  category: string
  delegableBySuperAdmin: boolean
}

type MatrixUser = {
  id: string
  name: string
  email: string
  role: string
  employee?: {
    department?: {
      id: string
      name: string
    } | null
  } | null
  permissions: Record<string, PermissionState>
}

type MatrixResponse = {
  permissions: MatrixPermission[]
  availableRoles: string[]
  policy: {
    delegablePermissionKeys: string[]
    canDelegate: boolean
  }
  currentUser: {
    role: string
    canManage: boolean
    canDelegate: boolean
  }
  users: MatrixUser[]
}

const PROTECTED_TARGET_ROLES = new Set(['SUPER_ADMIN', 'CRM_ADMIN', 'MD', 'ADMIN'])

export default function CrmAccessMatrixPage() {
  const queryClient = useQueryClient()
  const [userSearch, setUserSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)

  const { data, isLoading, error } = useQuery<MatrixResponse>({
    queryKey: ['crm-access-matrix', roleFilter],
    queryFn: () => {
      const params = new URLSearchParams()
      if (roleFilter !== 'all') params.set('role', roleFilter)
      return apiGet<MatrixResponse>(`/api/crm/access-matrix?${params}`)
    },
    retry: false,
  })

  const updatePermissionMutation = useMutation({
    mutationFn: (payload: { userId: string; permissionKey: string; enabled: boolean }) =>
      apiPatch('/api/crm/access-matrix', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-access-matrix'] })
      toast.success('CRM permission updated')
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to update CRM permission')
    },
  })

  const updatePolicyMutation = useMutation({
    mutationFn: (delegablePermissionKeys: string[]) =>
      apiPatch('/api/crm/access-matrix/policy', { delegablePermissionKeys }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-access-matrix'] })
      toast.success('Delegation policy updated')
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to update delegation policy')
    },
  })

  const permissions = data?.permissions ?? []
  const users = useMemo(() => data?.users ?? [], [data?.users])
  const currentUserCanManage = data?.currentUser.canManage ?? false
  const filteredUsers = useMemo(() => {
    const normalizedSearch = userSearch.trim().toLowerCase()
    if (!normalizedSearch) return users

    return users.filter((user) => {
      const department = user.employee?.department?.name ?? ''
      const haystack = `${user.name} ${user.email} ${user.role} ${department}`.toLowerCase()
      return haystack.includes(normalizedSearch)
    })
  }, [users, userSearch])

  const selectedUser = useMemo(() => {
    if (filteredUsers.length === 0) return null
    return filteredUsers.find((user) => user.id === selectedUserId) ?? filteredUsers[0]
  }, [filteredUsers, selectedUserId])

  const permissionsByCategory = (() => {
    if (permissions.length === 0) return []
    const grouped = new Map<string, MatrixPermission[]>()
    for (const permission of permissions) {
      const current = grouped.get(permission.category) ?? []
      current.push(permission)
      grouped.set(permission.category, current)
    }
    return Array.from(grouped.entries())
  })()

  if (error && !isLoading) {
    return (
      <ProtectedRoute>
        <div className="mx-auto max-w-[1000px] p-4 md:p-6">
          <Card className="w-full">
            <CardHeader>
              <CardTitle>No access</CardTitle>
              <CardDescription>
                You do not have permission to view the CRM Access Matrix.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </ProtectedRoute>
    )
  }

  const handlePermissionToggle = (user: MatrixUser, permissionKey: string) => {
    const current = user.permissions[permissionKey]
    updatePermissionMutation.mutate({
      userId: user.id,
      permissionKey,
      enabled: !current.enabled,
    })
  }

  const handlePolicyToggle = (permissionKey: string, enabled: boolean) => {
    const current = new Set(data?.policy.delegablePermissionKeys ?? [])
    if (enabled) current.add(permissionKey)
    else current.delete(permissionKey)
    updatePolicyMutation.mutate([...current])
  }

  const blockedTarget = selectedUser ? PROTECTED_TARGET_ROLES.has(selectedUser.role) : false

  return (
    <ProtectedRoute>
      <div className="mx-auto max-w-[1400px] space-y-6 p-4 md:p-6">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold">
            <ShieldCheck className="h-8 w-8" />
            CRM Access Matrix
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            CRM-only permissions for Super Admin and CRM Admin workflows. This matrix is
            registry-driven so future CRM capabilities can be added without restructuring the UI.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Delegation Policy</CardTitle>
            <CardDescription>
              Choose which CRM permissions remain manageable for matrix operators without full
              delegation authority. Super Admin can extend this later without code changes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading policy...</p>
            ) : (
              permissionsByCategory.map(([category, permissions]) => (
                <div key={category} className="space-y-3">
                  <div>
                    <h2 className="text-sm font-semibold">{category}</h2>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {permissions.map((permission) => {
                      const inPolicy = data?.policy.delegablePermissionKeys.includes(permission.key) ?? false
                      return (
                        <div key={permission.key} className="rounded-xl border p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-medium">{permission.label}</p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {permission.description}
                              </p>
                              {!permission.delegableBySuperAdmin && (
                                <Badge variant="secondary" className="mt-2">
                                  Fixed
                                </Badge>
                              )}
                            </div>
                            <Switch
                              checked={inPolicy}
                              disabled={
                                !data?.currentUser.canDelegate ||
                                !permission.delegableBySuperAdmin ||
                                updatePolicyMutation.isPending
                              }
                              onCheckedChange={(enabled) => handlePolicyToggle(permission.key, enabled)}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>User Permissions</CardTitle>
            <CardDescription>
              Pick a user first, then update just that person&apos;s CRM permissions without scrolling
              through a wide matrix.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-[minmax(320px,420px)_1fr]">
              <Card className="border-dashed">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Users className="h-4 w-4" />
                    Select User
                  </CardTitle>
                  <CardDescription>
                    Search by name, email, role, or department and then manage that user&apos;s CRM access.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Select value={roleFilter} onValueChange={setRoleFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Filter by role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All roles</SelectItem>
                      {(data?.availableRoles ?? []).map((role) => (
                        <SelectItem key={role} value={role}>
                          {getRoleLabel(role)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Combobox<MatrixUser>
                    items={filteredUsers}
                    value={selectedUser}
                    onValueChange={(user) => setSelectedUserId(user?.id ?? null)}
                    itemToStringLabel={(user) => `${user.name} ${user.email} ${getRoleLabel(user.role)}`}
                    isItemEqualToValue={(a, b) => a?.id === b?.id}
                    inputValue={userSearch}
                    onInputValueChange={setUserSearch}
                  >
                    <ComboboxInput
                      placeholder="Search user by name, email, role, or department"
                      showClear
                      className="w-full"
                    />
                    <ComboboxContent>
                      <ComboboxEmpty>No users match the current filters.</ComboboxEmpty>
                      <ComboboxList>
                        {(user: MatrixUser) => (
                          <ComboboxItem key={user.id} value={user}>
                            <div className="min-w-0">
                              <div className="truncate font-medium">{user.name}</div>
                              <div className="truncate text-xs opacity-80">{user.email}</div>
                            </div>
                          </ComboboxItem>
                        )}
                      </ComboboxList>
                    </ComboboxContent>
                  </Combobox>

                  {selectedUser ? (
                    <div className="rounded-xl border bg-muted/30 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-base font-semibold">{selectedUser.name}</p>
                          <div className="mt-1 flex flex-wrap gap-2">
                            <Badge variant="secondary">{getRoleLabel(selectedUser.role)}</Badge>
                            {selectedUser.employee?.department?.name && (
                              <Badge variant="outline">{selectedUser.employee.department.name}</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4" />
                          <span className="truncate">{selectedUser.email}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <UserRound className="h-4 w-4" />
                          <span>{getRoleLabel(selectedUser.role)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4" />
                          <span>{selectedUser.employee?.department?.name ?? 'No department assigned'}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
                      {isLoading ? 'Loading users...' : 'Pick a user to manage CRM permissions.'}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Permission Editor</CardTitle>
                  <CardDescription>
                    {selectedUser
                      ? `Update CRM access for ${selectedUser.name}.`
                      : 'Select a user from the left to edit permissions.'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  {selectedUser && blockedTarget && (
                    <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900">
                      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                      <div className="text-sm">
                        Protected roles such as `SUPER_ADMIN`, `CRM_ADMIN`, `MD`, and `ADMIN` cannot be edited from this matrix.
                      </div>
                    </div>
                  )}

                  {!selectedUser ? (
                    <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
                      Choose a user from the searchable dropdown to see their CRM permissions here.
                    </div>
                  ) : (
                    permissionsByCategory.map(([category, categoryPermissions]) => (
                      <div key={category} className="space-y-3">
                        <div>
                          <h2 className="text-sm font-semibold">{category}</h2>
                        </div>
                        <div className="grid gap-3 xl:grid-cols-2">
                          {categoryPermissions.map((permission) => {
                            const state = selectedUser.permissions[permission.key]
                            return (
                              <div key={permission.key} className="rounded-xl border p-4">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium">{permission.label}</p>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                      {permission.description}
                                    </p>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                      <Badge variant={state.source === 'override' ? 'default' : 'outline'}>
                                        {state.source === 'override' ? 'Override' : 'Default'}
                                      </Badge>
                                      {!permission.delegableBySuperAdmin && (
                                        <Badge variant="secondary">Fixed delegation</Badge>
                                      )}
                                    </div>
                                  </div>
                                  <Switch
                                    checked={state.enabled}
                                    disabled={
                                      !currentUserCanManage ||
                                      blockedTarget ||
                                      updatePermissionMutation.isPending
                                    }
                                    onCheckedChange={() => handlePermissionToggle(selectedUser, permission.key)}
                                  />
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>
      </div>
    </ProtectedRoute>
  )
}
