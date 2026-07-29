'use client'

import { useState, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPatch, apiDelete } from '@/lib/api-client'
import { useAuth } from '@/hooks/use-auth'
import { hasPermission } from '@/lib/rbac'
import { Shield, ArrowLeft, Lock, Building2, Search, AlertCircle, Users } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

// Import modular sub-components
import { UserDirectoryTable } from '@/components/it/UserDirectoryTable'
import { ModuleSidebar } from '@/components/it/ModuleSidebar'
import { PermissionsMatrix } from '@/components/it/PermissionsMatrix'
import { StickyActionFooter } from '@/components/it/StickyActionFooter'

interface UserInList {
  id: string
  name: string
  email: string
  role: string
  employee?: {
    department?: { id: string; name: string } | null
  } | null
}

const SYSTEM_ROLES = [
  'MD',
  'ADMIN',
  'EXECUTIVE_ASSISTANT',
  'SALES_HEAD',
  'CATEGORY_MANAGER',
  'TEAM_LEAD',
  'ASSISTANT_CATEGORY_MANAGER',
  'BD',
  'INSURANCE_HEAD',
  'INSURANCE',
  'PL_HEAD',
  'PL_ENTRY',
  'PL_VIEWER',
  'OUTSTANDING_HEAD',
  'HR_HEAD',
  'FINANCE_HEAD',
  'IT_HEAD',
  'DIGITAL_MARKETING_HEAD',
  'COMPLIANCE_HEAD',
  'ACCOUNTS',
  'SUPER_ADMIN',
  'CRM_ADMIN',
  'USER',
  'TESTER',
]

export default function ITPermissionsPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  // 1. Directory list state
  const [activeTab, setActiveTab] = useState<'user' | 'role'>('user')
  const [selectedRole, setSelectedRole] = useState<string | null>(null)
  const [roleSearch, setRoleSearch] = useState('')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const ITEMS_PER_PAGE = 10

  const filteredRoles = useMemo(() => {
    if (!roleSearch) return SYSTEM_ROLES
    return SYSTEM_ROLES.filter((r) => r.toLowerCase().includes(roleSearch.toLowerCase()))
  }, [roleSearch])

  // 2. Editor state
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [selectedModuleKey, setSelectedModuleKey] = useState<string | null>(null)
  const [openSectionKey, setOpenSectionKey] = useState<string | null>(null)
  const [editedPermissions, setEditedPermissions] = useState<Record<string, { level: string; canGrant: boolean }>>({})
  const [originalPermissions, setOriginalPermissions] = useState<Record<string, { level: string; canGrant: boolean }>>({})
  const [roleDefaults, setRoleDefaults] = useState<Record<string, { level: string; canGrant: boolean }>>({})
  const [isSaving, setIsSaving] = useState(false)

  // Gate administrative access
  const canAccess = user && hasPermission(user, 'it:permissions')

  // Debouncing search field to avoid unnecessary query requests
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search)
      setCurrentPage(1)
    }, 300)
    return () => clearTimeout(handler)
  }, [search])

  // Invalidate query caches to force fetching fresh trees on tab switches and resource selections
  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ['admin-permissions'] })
    queryClient.invalidateQueries({ queryKey: ['role-permissions'] })
  }, [activeTab, queryClient])

  useEffect(() => {
    if (selectedUserId) {
      queryClient.invalidateQueries({ queryKey: ['admin-permissions', selectedUserId] })
    }
  }, [selectedUserId, queryClient])

  useEffect(() => {
    if (selectedRole) {
      queryClient.invalidateQueries({ queryKey: ['role-permissions', selectedRole] })
    }
  }, [selectedRole, queryClient])

  // Fetch users matching search and filter
  const { data: usersResponse, isLoading: isUsersLoading } = useQuery<{ data: UserInList[]; total: number } | UserInList[]>({
    queryKey: ['it-permissions-users', debouncedSearch, roleFilter, currentPage],
    queryFn: () => {
      const params = new URLSearchParams()
      if (debouncedSearch) params.set('search', debouncedSearch)
      if (roleFilter && roleFilter !== 'all') params.set('role', roleFilter)
      params.set('page', currentPage.toString())
      params.set('limit', ITEMS_PER_PAGE.toString())
      return apiGet<any>(`/api/it/permissions?${params}`)
    },
    enabled: !!canAccess && activeTab === 'user',
  })

  // Fetch specific user permission tree when selected
  const { data: permissionTreeData, isLoading: isTreeLoading } = useQuery({
    queryKey: ['admin-permissions', selectedUserId],
    queryFn: () => apiGet<{ user: any; resourceTree: any[] }>(`/api/admin/users/${selectedUserId}/permissions`),
    enabled: !!selectedUserId && !!canAccess,
  })

  // Fetch specific role permission tree when selected
  const { data: rolePermissionTreeData, isLoading: isRoleTreeLoading } = useQuery({
    queryKey: ['role-permissions', selectedRole],
    queryFn: () => apiGet<{ role: string; resourceTree: any[] }>(`/api/admin/roles/${selectedRole}/permissions`),
    enabled: !!selectedRole && !!canAccess,
  })

  // Initialize permissions state when target user tree loads
  useEffect(() => {
    if (permissionTreeData?.resourceTree) {
      const flat: Record<string, { level: string; canGrant: boolean }> = {}
      const defaults: Record<string, { level: string; canGrant: boolean }> = {}

      const traverse = (nodes: any[]) => {
        for (const node of nodes) {
          const roleLevel = node.roleAssignment?.permissionLevel ?? 'NONE'
          const roleCanGrant = node.roleAssignment?.canGrant ?? false

          defaults[node.id] = {
            level: roleLevel,
            canGrant: roleCanGrant,
          }

          flat[node.id] = {
            level: node.assignment?.permissionLevel ?? roleLevel,
            canGrant: node.assignment?.canGrant ?? roleCanGrant,
          }
          if (node.children && node.children.length > 0) {
            traverse(node.children)
          }
        }
      }

      traverse(permissionTreeData.resourceTree)
      setEditedPermissions(flat)
      setOriginalPermissions(flat)
      setRoleDefaults(defaults)

      // Select first module automatically
      if (permissionTreeData.resourceTree.length > 0) {
        setSelectedModuleKey(permissionTreeData.resourceTree[0].key)
      }
    }
  }, [permissionTreeData])

  // Initialize permissions state when target role tree loads
  useEffect(() => {
    if (rolePermissionTreeData?.resourceTree) {
      const flat: Record<string, { level: string; canGrant: boolean }> = {}

      const traverse = (nodes: any[]) => {
        for (const node of nodes) {
          const defaultLevel = node.assignment?.permissionLevel ?? 'NONE'
          const defaultCanGrant = node.assignment?.canGrant ?? false

          flat[node.id] = {
            level: defaultLevel,
            canGrant: defaultCanGrant,
          }
          if (node.children && node.children.length > 0) {
            traverse(node.children)
          }
        }
      }

      traverse(rolePermissionTreeData.resourceTree)
      setEditedPermissions(flat)
      setOriginalPermissions(flat)
      setRoleDefaults({})

      // Select first module automatically
      if (rolePermissionTreeData.resourceTree.length > 0) {
        setSelectedModuleKey(rolePermissionTreeData.resourceTree[0].key)
      }
    }
  }, [rolePermissionTreeData])

  // Reset open accordion section when module switches
  useEffect(() => {
    setOpenSectionKey(null)
  }, [selectedModuleKey])

  // Pagination helper
  const totalUsers = useMemo(() => {
    if (!usersResponse) return 0
    if (Array.isArray(usersResponse)) return usersResponse.length
    return usersResponse.total
  }, [usersResponse])

  const totalPages = Math.ceil(totalUsers / ITEMS_PER_PAGE)

  const paginatedUsers = useMemo(() => {
    if (!usersResponse) return []
    if (Array.isArray(usersResponse)) {
      const start = (currentPage - 1) * ITEMS_PER_PAGE
      return usersResponse.slice(start, start + ITEMS_PER_PAGE)
    }
    return usersResponse.data
  }, [usersResponse, currentPage])

  // Handle single row update
  const handleUpdatePermission = (resourceId: string, updates: { level: string; canGrant: boolean }) => {
    setEditedPermissions((prev) => ({
      ...prev,
      [resourceId]: updates,
    }))
  }

  // Bulk Section toggle logic
  const handleToggleSection = (sectionNode: any, checked: boolean) => {
    const newLevel = checked ? 'READ' : 'NONE'
    const updates = { ...editedPermissions }

    const traverse = (node: any) => {
      updates[node.id] = {
        level: newLevel,
        canGrant: false,
      }
      if (node.children) {
        for (const child of node.children) {
          traverse(child)
        }
      }
    }
    traverse(sectionNode)
    setEditedPermissions(updates)
  }

  // Bulk Module toggle logic
  const handleToggleModule = (moduleNode: any, checked: boolean) => {
    const newLevel = checked ? 'FULL_ACCESS' : 'NONE'
    const newCanGrant = checked
    const updates = { ...editedPermissions }

    const traverse = (node: any) => {
      updates[node.id] = {
        level: newLevel,
        canGrant: newCanGrant,
      }
      if (node.children) {
        for (const child of node.children) {
          traverse(child)
        }
      }
    }
    traverse(moduleNode)
    setEditedPermissions(updates)
  }

  // Dirty check: check if any permissions have changed
  const isDirty = useMemo(() => {
    const keys = Object.keys(editedPermissions)
    if (keys.length === 0) return false
    return keys.some((key) => {
      const cur = editedPermissions[key]
      const orig = originalPermissions[key]
      return !orig || cur.level !== orig.level || cur.canGrant !== orig.canGrant
    })
  }, [editedPermissions, originalPermissions])

  // Save changes via single batch PATCH call
  const handleSaveChanges = async () => {
    if (!selectedUserId && !selectedRole) return
    setIsSaving(true)

    try {
      const resourceIds = Object.keys(editedPermissions)

      if (resourceIds.length === 0) {
        toast.info('No resources loaded to save.')
        setIsSaving(false)
        return
      }

      // Build batch assignments array
      const assignments = resourceIds.map((id) => ({
        resourceId: id,
        permissionLevel: editedPermissions[id].level,
        canGrant: editedPermissions[id].canGrant,
      }))

      if (selectedUserId) {
        // Single batch request instead of hundreds of individual PATCH calls
        await apiPatch(`/api/admin/users/${selectedUserId}/permissions`, {
          assignments,
        })
        toast.success('User permissions updated successfully!')
        queryClient.invalidateQueries({ queryKey: ['admin-permissions', selectedUserId] })
        queryClient.invalidateQueries({ queryKey: ['it-permissions-users'] })
      } else if (selectedRole) {
        // Batch request for role-level permissions
        await apiPatch(`/api/admin/roles/${selectedRole}/permissions`, {
          assignments,
        })
        toast.success('Role permissions updated successfully!')
        queryClient.invalidateQueries({ queryKey: ['role-permissions', selectedRole] })
      }

      setOriginalPermissions({ ...editedPermissions })
    } catch (err: any) {
      console.error('Error saving permissions:', err)
      toast.error(err.message || 'Failed to save changes.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDiscardChanges = () => {
    setEditedPermissions({ ...originalPermissions })
    toast.info('All pending edits discarded.')
  }

  // Get initials for profile picture fallback
  const getInitials = (name: string) => {
    if (!name) return ''
    return name
      .split(' ')
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .substring(0, 2)
  }

  // Get vibrant theme-matching gradient based on userId hash
  const getAvatarGradient = (userId: string) => {
    const gradients = [
      { bg: 'from-cyan-500/10 to-blue-500/20 text-cyan-700 dark:text-cyan-300', border: 'border-cyan-500' },
      { bg: 'from-indigo-500/10 to-purple-500/20 text-indigo-700 dark:text-indigo-300', border: 'border-indigo-500' },
      { bg: 'from-teal-500/10 to-emerald-500/20 text-teal-700 dark:text-teal-300', border: 'border-teal-500' },
      { bg: 'from-blue-500/10 to-violet-500/20 text-blue-700 dark:text-blue-300', border: 'border-blue-500' },
      { bg: 'from-violet-500/10 to-fuchsia-500/20 text-violet-700 dark:text-violet-300', border: 'border-fuchsia-500' },
    ]
    if (!userId) return gradients[0]
    let hash = 0
    for (let i = 0; i < userId.length; i++) {
      hash = userId.charCodeAt(i) + ((hash << 5) - hash)
    }
    const index = Math.abs(hash) % gradients.length
    return gradients[index]
  }

  if (!canAccess) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center text-center">
        <Lock className="h-16 w-16 text-destructive mb-4" />
        <h2 className="text-2xl font-bold">Unauthorized Access</h2>
        <p className="text-muted-foreground mt-2 max-w-sm">
          You do not have administrative privileges to access this portal.
        </p>
      </div>
    )
  }

  // Find active module in loaded tree
  const activeModule = selectedRole
    ? rolePermissionTreeData?.resourceTree?.find((m: any) => m.key === selectedModuleKey)
    : permissionTreeData?.resourceTree?.find((m: any) => m.key === selectedModuleKey)

  const isEditing = !!selectedUserId || !!selectedRole
  const isDataLoading = selectedRole ? isRoleTreeLoading : isTreeLoading
  const activeResourceTree = selectedRole ? rolePermissionTreeData?.resourceTree : permissionTreeData?.resourceTree

  return (
    <div className="space-y-4 pb-24 relative">
      {/* -------------------- VIEW 1: USER & ROLE DIRECTORY LISTS -------------------- */}
      {!isEditing ? (
        <>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Shield className="h-8 w-8 text-cyan-600 dark:text-cyan-400" />
              IT Access Directory
            </h1>
            <p className="text-muted-foreground mt-1">
              Audit institutional access permissions and manage security matrices across all profiles and system roles.
            </p>
          </div>

          {/* Premium Pill Tabs Controller */}
          <div className="flex justify-start mb-6">
            <div className="inline-flex items-center rounded-xl bg-muted/60 p-1 border border-border/40 shadow-sm backdrop-blur-sm">
              <button
                onClick={() => setActiveTab('user')}
                className={`px-5 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 flex items-center gap-2 ${
                  activeTab === 'user'
                    ? 'bg-background text-cyan-600 dark:text-cyan-400 shadow-sm border border-border/20 font-bold'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted-foreground/5'
                }`}
              >
                <Users className="h-4.5 w-4.5" />
                User Permissions
              </button>
              <button
                onClick={() => setActiveTab('role')}
                className={`px-5 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 flex items-center gap-2 ${
                  activeTab === 'role'
                    ? 'bg-background text-cyan-600 dark:text-cyan-400 shadow-sm border border-border/20 font-bold'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted-foreground/5'
                }`}
              >
                <Shield className="h-4.5 w-4.5" />
                Role Permissions
              </button>
            </div>
          </div>

          {activeTab === 'user' ? (
            <UserDirectoryTable
              search={search}
              setSearch={setSearch}
              roleFilter={roleFilter}
              setRoleFilter={setRoleFilter}
              isLoading={isUsersLoading}
              currentPage={currentPage}
              setCurrentPage={setCurrentPage}
              totalPages={totalPages}
              paginatedUsers={paginatedUsers}
              onManagePermissions={setSelectedUserId}
              getInitials={getInitials}
              getAvatarGradient={getAvatarGradient}
              totalUsers={totalUsers}
              itemsPerPage={ITEMS_PER_PAGE}
            />
          ) : (
            /* Roles Table view */
            <Card className="border border-border bg-card text-card-foreground shadow-sm">
              <CardContent className="space-y-4 pt-5">
                {/* Search Toolbar */}
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                      placeholder="Search directory by role name..."
                      value={roleSearch}
                      onChange={(e) => setRoleSearch(e.target.value)}
                      className="pl-12 h-12 bg-background border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring text-sm"
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-border overflow-hidden bg-card text-card-foreground shadow-sm">
                  <Table>
                    <TableHeader className="bg-muted/50 border-b border-border">
                      <TableRow className="border-b border-border">
                        <TableHead className="text-muted-foreground font-semibold px-6 py-4">Role Name</TableHead>
                        <TableHead className="text-muted-foreground font-semibold px-6 py-4">Subject Type</TableHead>
                        <TableHead className="text-muted-foreground font-semibold px-6 py-4 text-center">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRoles.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center py-12 text-muted-foreground border-b border-border">
                            <AlertCircle className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                            <p className="text-sm">No roles found matching search query.</p>
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredRoles.map((role) => (
                          <TableRow key={role} className="border-b border-border hover:bg-muted/40 transition-colors group">
                            <TableCell className="py-4 px-6">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-gradient-to-br from-indigo-500/10 to-purple-500/20 text-indigo-700 dark:text-indigo-300 font-bold text-sm border border-indigo-500/20">
                                  {role.substring(0, 2).toUpperCase()}
                                </div>
                                <div>
                                  <div className="font-bold text-foreground group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">{role}</div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="py-4 px-6">
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border border-cyan-500/20 uppercase tracking-wider">
                                ROLE
                              </span>
                            </TableCell>
                            <TableCell className="py-4 px-6 text-center">
                              <Button
                                variant="outline"
                                onClick={() => setSelectedRole(role)}
                                className="border-border hover:border-cyan-500 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors text-sm font-semibold bg-background hover:bg-muted text-foreground px-5 py-2 h-10"
                              >
                                Manage Permissions
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
          )}
        </>
      ) : (
        /* -------------------- VIEW 2: PERMISSIONS ACCESS MATRIX EDITOR -------------------- */
        <>
          {isDataLoading ? (
            <div className="flex h-[50vh] flex-col items-center justify-center text-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-cyan-600 dark:border-cyan-400 border-r-transparent"></div>
              <p className="mt-4 text-sm text-muted-foreground">Retrieving access configuration tree...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Sticky Top Bar containing back button and user card */}
              <div className="sticky top-0 z-20 bg-background pt-2 pb-4 px-4 space-y-4 rounded-lg">
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedUserId(null)
                      setSelectedRole(null)
                    }}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Access Directory
                  </Button>
                </div>

                {/* Info Card: Adapts to either User or Role */}
                {selectedUserId ? (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-card text-card-foreground border border-border p-5 rounded-xl gap-4 shadow-sm">
                    <div className="flex items-center gap-4">
                      <div className={`w-14 h-14 rounded-full border-2 ${getAvatarGradient(permissionTreeData?.user?.id ?? '').border} flex items-center justify-center bg-gradient-to-br ${getAvatarGradient(permissionTreeData?.user?.id ?? '').bg} font-bold text-base`}>
                        {getInitials(permissionTreeData?.user?.name ?? '')}
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-foreground">{permissionTreeData?.user?.name}</h2>
                        <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Building2 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                          Role: {permissionTreeData?.user?.role}
                        </p>
                      </div>
                    </div>
                    <div className="sm:text-right">
                      <span className="text-xs text-muted-foreground block">User CUID</span>
                      <code className="text-xs text-cyan-700 dark:text-cyan-400 bg-cyan-500/10 px-2.5 py-1 rounded font-mono mt-1 inline-block border border-cyan-500/20">
                        {permissionTreeData?.user?.id}
                      </code>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-card text-card-foreground border border-border p-5 rounded-xl gap-4 shadow-sm">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-full border-2 border-indigo-500 flex items-center justify-center bg-gradient-to-br from-indigo-500/10 to-purple-500/20 text-indigo-700 dark:text-indigo-300 font-bold text-base">
                        {selectedRole?.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-foreground">Role Matrix: {selectedRole}</h2>
                        <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Lock className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                          Default permissions configuration for all users matching this role
                        </p>
                      </div>
                    </div>
                    <div className="sm:text-right">
                      <span className="text-xs text-muted-foreground block">Subject Type</span>
                      <code className="text-xs text-cyan-700 dark:text-cyan-400 bg-cyan-500/10 px-2.5 py-1 rounded font-mono mt-1 inline-block border border-cyan-500/20">
                        ROLE
                      </code>
                    </div>
                  </div>
                )}
              </div>

              {/* Master Split Grid */}
              <div className="flex flex-col lg:flex-row gap-6 items-start">
                {/* Left Sidebar: Modules list */}
                {activeResourceTree && (
                  <ModuleSidebar
                    modules={activeResourceTree}
                    selectedModuleKey={selectedModuleKey}
                    onSelectModule={setSelectedModuleKey}
                  />
                )}

                {/* Right Panel: Sections & Entities */}
                {activeModule && (
                  <PermissionsMatrix
                    activeModule={activeModule}
                    editedPermissions={editedPermissions}
                    onToggleModule={handleToggleModule}
                    onToggleSection={handleToggleSection}
                    onUpdatePermission={handleUpdatePermission}
                    openSectionKey={openSectionKey}
                    setOpenSectionKey={setOpenSectionKey}
                    isRole={!!selectedRole}
                  />
                )}
              </div>
            </div>
          )}

          {/* Sticky Bottom Action Footer */}
          <StickyActionFooter
            isDirty={isDirty}
            isSaving={isSaving}
            onDiscard={handleDiscardChanges}
            onSave={handleSaveChanges}
          />
        </>
      )}
    </div>
  )
}
