'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPatch } from '@/lib/api-client'
import { useAuth } from '@/hooks/use-auth'
import { hasPermission } from '@/lib/rbac'
import { FEATURE_KEYS } from '@/lib/feature-keys'
import { Shield, Search, Building2 } from 'lucide-react'
import { toast } from 'sonner'

interface UserWithPermissions {
  id: string
  name: string
  email: string
  role: string
  employee?: {
    department?: { id: string; name: string } | null
  } | null
  permissions: {
    [FEATURE_KEYS.MD_APPROVAL_REQUEST]: boolean | null
    [FEATURE_KEYS.CREATE_NOTICE]: boolean | null
    [FEATURE_KEYS.WORKLOG_ENFORCEMENT]: boolean | null
    [FEATURE_KEYS.CREATE_MEET]: boolean | null
  }
}

const FEATURE_LABELS: Record<string, string> = {
  [FEATURE_KEYS.MD_APPROVAL_REQUEST]: 'Ask MD Approval',
  [FEATURE_KEYS.CREATE_NOTICE]: 'Create Notice',
  [FEATURE_KEYS.WORKLOG_ENFORCEMENT]: 'Work Log Enforcement',
  [FEATURE_KEYS.CREATE_MEET]: 'Create Meet',
}

export default function ITPermissionsPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')

  const canAccess = user && hasPermission(user, 'it:permissions')

  const { data: users, isLoading } = useQuery<UserWithPermissions[]>({
    queryKey: ['it-permissions', search, roleFilter],
    queryFn: () => {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (roleFilter && roleFilter !== 'all') params.set('role', roleFilter)
      return apiGet<UserWithPermissions[]>(`/api/it/permissions?${params}`)
    },
    enabled: !!canAccess,
  })

  const toggleMutation = useMutation({
    mutationFn: ({
      userId,
      featureKey,
      enabled,
    }: {
      userId: string
      featureKey: string
      enabled: boolean
    }) => apiPatch('/api/it/permissions', { userId, featureKey, enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['it-permissions'] })
      toast.success('Permission updated')
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to update permission')
    },
  })

  const handleToggle = (userId: string, featureKey: string, current: boolean | null) => {
    const enabled = current === true ? false : true
    toggleMutation.mutate({ userId, featureKey, enabled })
  }

  if (!canAccess) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        You do not have permission to view this page.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Shield className="h-8 w-8" />
          IT Permissions
        </h1>
        <p className="text-muted-foreground mt-1">
          Manage feature access for users. Toggle permissions to grant or revoke access.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>User Permissions</CardTitle>
          <CardDescription>
            Search and filter users, then toggle their feature access. Gray (null) means default
            (role-based). Green = enabled, Gray off = disabled.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                <SelectItem value="MD">MD</SelectItem>
                <SelectItem value="ADMIN">Admin</SelectItem>
                <SelectItem value="IT_HEAD">IT Head</SelectItem>
                <SelectItem value="HR_HEAD">HR Head</SelectItem>
                <SelectItem value="FINANCE_HEAD">Finance Head</SelectItem>
                <SelectItem value="SALES_HEAD">Sales Head</SelectItem>
                <SelectItem value="INSURANCE_HEAD">Insurance Head</SelectItem>
                <SelectItem value="PL_HEAD">PL Head</SelectItem>
                <SelectItem value="OUTSTANDING_HEAD">Outstanding Head</SelectItem>
                <SelectItem value="DIGITAL_MARKETING_HEAD">Digital Marketing Head</SelectItem>
                <SelectItem value="EXECUTIVE_ASSISTANT">Executive Assistant</SelectItem>
                <SelectItem value="TEAM_LEAD">Team Lead</SelectItem>
                <SelectItem value="BD">BD</SelectItem>
                <SelectItem value="USER">User</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>{FEATURE_LABELS[FEATURE_KEYS.MD_APPROVAL_REQUEST]}</TableHead>
                  <TableHead>{FEATURE_LABELS[FEATURE_KEYS.CREATE_NOTICE]}</TableHead>
                  <TableHead>{FEATURE_LABELS[FEATURE_KEYS.WORKLOG_ENFORCEMENT]}</TableHead>
                  <TableHead>{FEATURE_LABELS[FEATURE_KEYS.CREATE_MEET]}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : (
                  users?.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{u.name}</div>
                          <div className="text-sm text-muted-foreground">{u.email}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{u.role}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm flex items-center gap-1">
                          {u.employee?.department?.name ? (
                            <>
                              <Building2 className="h-3 w-3" />
                              {u.employee.department.name}
                            </>
                          ) : (
                            '-'
                          )}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={u.permissions[FEATURE_KEYS.MD_APPROVAL_REQUEST] ?? false}
                          onCheckedChange={() =>
                            handleToggle(
                              u.id,
                              FEATURE_KEYS.MD_APPROVAL_REQUEST,
                              u.permissions[FEATURE_KEYS.MD_APPROVAL_REQUEST]
                            )
                          }
                          disabled={toggleMutation.isPending}
                        />
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={u.permissions[FEATURE_KEYS.CREATE_NOTICE] ?? false}
                          onCheckedChange={() =>
                            handleToggle(
                              u.id,
                              FEATURE_KEYS.CREATE_NOTICE,
                              u.permissions[FEATURE_KEYS.CREATE_NOTICE]
                            )
                          }
                          disabled={toggleMutation.isPending}
                        />
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={u.permissions[FEATURE_KEYS.WORKLOG_ENFORCEMENT] ?? false}
                          onCheckedChange={() =>
                            handleToggle(
                              u.id,
                              FEATURE_KEYS.WORKLOG_ENFORCEMENT,
                              u.permissions[FEATURE_KEYS.WORKLOG_ENFORCEMENT]
                            )
                          }
                          disabled={toggleMutation.isPending}
                        />
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={u.permissions[FEATURE_KEYS.CREATE_MEET] ?? false}
                          onCheckedChange={() =>
                            handleToggle(
                              u.id,
                              FEATURE_KEYS.CREATE_MEET,
                              u.permissions[FEATURE_KEYS.CREATE_MEET]
                            )
                          }
                          disabled={toggleMutation.isPending}
                        />
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
  )
}
