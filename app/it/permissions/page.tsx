'use client'

import { useState, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPatch, apiDelete } from '@/lib/api-client'
import { useAuth } from '@/hooks/use-auth'
import { hasPermission } from '@/lib/rbac'
import { Shield, ArrowLeft, Lock, Building2 } from 'lucide-react'
import { toast } from 'sonner'

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

export default function ITPermissionsPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  // 1. Directory list state
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const ITEMS_PER_PAGE = 10

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

  // Fetch users matching search and filter
  const { data: users, isLoading: isUsersLoading } = useQuery<UserInList[]>({
    queryKey: ['it-permissions-users', debouncedSearch, roleFilter],
    queryFn: () => {
      const params = new URLSearchParams()
      if (debouncedSearch) params.set('search', debouncedSearch)
      if (roleFilter && roleFilter !== 'all') params.set('role', roleFilter)
      return apiGet<UserInList[]>(`/api/it/permissions?${params}`)
    },
    enabled: !!canAccess,
  })

  // Fetch specific user permission tree when selected
  const { data: permissionTreeData, isLoading: isTreeLoading } = useQuery({
    queryKey: ['admin-permissions', selectedUserId],
    queryFn: () => apiGet<{ user: any; resourceTree: any[] }>(`/api/admin/users/${selectedUserId}/permissions`),
    enabled: !!selectedUserId && !!canAccess,
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

  // Reset open accordion section when module switches
  useEffect(() => {
    setOpenSectionKey(null)
  }, [selectedModuleKey])

  // Pagination helper
  const totalUsers = users?.length ?? 0
  const totalPages = Math.ceil(totalUsers / ITEMS_PER_PAGE)
  const paginatedUsers = useMemo(() => {
    if (!users) return []
    const start = (currentPage - 1) * ITEMS_PER_PAGE
    return users.slice(start, start + ITEMS_PER_PAGE)
  }, [users, currentPage])

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
    if (!selectedUserId) return
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

      // Single batch request instead of hundreds of individual PATCH calls
      await apiPatch(`/api/admin/users/${selectedUserId}/permissions`, {
        assignments,
      })

      toast.success('Permissions updated successfully!')

      // Refresh cache
      queryClient.invalidateQueries({ queryKey: ['admin-permissions', selectedUserId] })
      queryClient.invalidateQueries({ queryKey: ['it-permissions-users'] })

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
      { bg: 'from-cyan-500/20 to-blue-600/30 border-cyan-500/30 text-cyan-300', border: 'border-[#2fd9f4]' },
      { bg: 'from-indigo-500/20 to-purple-600/30 border-indigo-500/30 text-indigo-300', border: 'border-indigo-400' },
      { bg: 'from-teal-500/20 to-emerald-600/30 border-teal-500/30 text-teal-300', border: 'border-emerald-400' },
      { bg: 'from-blue-500/20 to-violet-600/30 border-blue-500/30 text-blue-300', border: 'border-blue-400' },
      { bg: 'from-violet-500/20 to-fuchsia-600/30 border-violet-500/30 text-violet-300', border: 'border-fuchsia-400' },
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
  const activeModule = permissionTreeData?.resourceTree?.find(
    (m: any) => m.key === selectedModuleKey
  )

  return (
    <div className="space-y-4 pb-24 relative">
      {/* -------------------- VIEW 1: USER DIRECTORY LIST -------------------- */}
      {!selectedUserId ? (
        <>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Shield className="h-8 w-8 text-[#2fd9f4]" />
              IT Access Directory
            </h1>
            <p className="text-muted-foreground mt-1">
              Audit institutional access permissions and manage security matrices across all profiles.
            </p>
          </div>

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
        </>
      ) : (
        /* -------------------- VIEW 2: PERMISSIONS ACCESS MATRIX EDITOR -------------------- */
        <>
          {isTreeLoading ? (
            <div className="flex h-[50vh] flex-col items-center justify-center text-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-[#2fd9f4] border-r-transparent"></div>
              <p className="mt-4 text-sm text-[#c7c6cd]">Retrieving access configuration tree...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Sticky Top Bar containing back button and user card */}
              <div className="sticky top-0 z-20 bg-[#07112f] pt-2 pb-4 px-4 space-y-4 rounded-lg">
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedUserId(null)}
                    className="text-[#c7c6cd] hover:text-white"
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Access Directory
                  </Button>
                </div>

                {/* User summary header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-[#151e3c] border border-[#283150] p-5 rounded-xl gap-4 shadow-md">
                  <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 rounded-full border-2 ${getAvatarGradient(permissionTreeData?.user?.id ?? '').border} flex items-center justify-center bg-gradient-to-br ${getAvatarGradient(permissionTreeData?.user?.id ?? '').bg} font-bold text-white text-base`}>
                      {getInitials(permissionTreeData?.user?.name ?? '')}
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-white">{permissionTreeData?.user?.name}</h2>
                      <p className="text-sm text-[#c7c6cd] flex items-center gap-1 mt-0.5">
                        <Building2 className="h-4 w-4 text-indigo-400" />
                        Role: {permissionTreeData?.user?.role}
                      </p>
                    </div>
                  </div>
                  <div className="sm:text-right">
                    <span className="text-xs text-[#c7c6cd] block">User CUID</span>
                    <code className="text-xs text-[#2fd9f4] bg-[#2fd9f4]/10 px-2.5 py-1 rounded font-mono mt-1 inline-block border border-[#2fd9f4]/20">
                      {permissionTreeData?.user?.id}
                    </code>
                  </div>
                </div>
              </div>

              {/* Master Split Grid */}
              <div className="flex flex-col lg:flex-row gap-6 items-start">

                {/* Left Sidebar: Modules list */}
                {permissionTreeData?.resourceTree && (
                  <ModuleSidebar
                    modules={permissionTreeData.resourceTree}
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
