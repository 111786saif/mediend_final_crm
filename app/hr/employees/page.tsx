'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPatch, apiPost } from '@/lib/api-client'
import { useRef, useState } from 'react'
import { Building, Hash, Calendar, Search, Filter, X, Plus, Eye, Wallet } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { Badge } from '@/components/ui/badge'
import { MultiSelectDropdown } from '@/components/case-tracker/multi-select-dropdown'
import { useAuth } from '@/hooks/use-auth'
import { getAvailableRolesForCreator, hasPermission } from '@/lib/rbac'
import { cn } from '@/lib/utils'
import { type UserRole } from '@/generated/prisma/enums'
import { getRoleLabel } from '@/lib/roles'
import { EmployeeDetailDrawer } from '@/components/hr/employee-detail-drawer'
import { AddEmployeeDialog, type OnboardResult } from '@/components/hr/add-employee-dialog'
import { SyncProgressModal } from '@/components/hr/sync-progress-modal'
import { parseEmployeeCircleList } from '@/lib/employee-circles'

const EDIT_EMPLOYEE_ROLE_ORDER: UserRole[] = [
  'SALES_HEAD',
  'CATEGORY_MANAGER',
  'ASSISTANT_CATEGORY_MANAGER',
  'TEAM_LEAD',
  'BD',
  'INSURANCE_HEAD',
  'PL_HEAD',
  'OUTSTANDING_HEAD',
  'HR_HEAD',
  'DIGITAL_MARKETING_HEAD',
  'LOAN_DEMAT_HEAD',
  'COMPLIANCE_HEAD',
  'USER',
  'ACCESS_MATRIX',
]

interface Department {
  id: string
  name: string
}

interface CircleOption {
  id: string
  name: string
  isActive: boolean
}

interface Employee {
  id: string
  employeeCode: string
  joinDate: Date | null
  designation: string | null
  status: string
  bdNumber: number | null
  circle: string | null
  fnfDeadline: string | null
  statusNote: string | null
  finalWorkingDay: string | null
  fnfCompleted: boolean
  dateOfBirth: string | null
  panNumber: string | null
  aadharNumber: string | null
  uanNumber: string | null
  aadharDocUrl: string | null
  panDocUrl: string | null
  bankAccountName: string | null
  bankAccountNumber: string | null
  ifscCode: string | null
  user: {
    id: string
    name: string
    email: string
    role: string
  }
  department: {
    id: string
    name: string
  } | null
  manager: {
    id: string
    user: { id: string; name: string }
  } | null
}

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Active',
  ON_PIP: 'On PIP',
  ON_NOTICE: 'Notice',
  TERMINATED: 'Inactive',
  ABSCONDED: 'Absconded',
}

const ROW_STATUS_CLASS: Record<string, string> = {
  ACTIVE: '',
  ON_PIP: 'bg-orange-50/50 dark:bg-orange-950/20',
  ON_NOTICE: 'bg-amber-50/50 dark:bg-amber-950/20',
  TERMINATED: 'bg-red-50/50 dark:bg-red-950/20',
  ABSCONDED: 'bg-rose-50/50 dark:bg-rose-950/20',
}

const DEFAULT_STATUS_FILTER = 'ACTIVE'

interface EditFormData {
  employeeCode: string
  bdNumber: string
  circles: string[]
  joinDate: string
  departmentId: string
  managerId: string
  designation: string
  role: string
  dateOfBirth: string
  panNumber: string
  aadharNumber: string
  uanNumber: string
  aadharDocUrl: string
  panDocUrl: string
  bankAccountName: string
  bankAccountNumber: string
  ifscCode: string
}

interface EditPatchPayload {
  employeeCode?: string
  circle?: string | null
  circles?: string[]
  joinDate?: string | null
  departmentId?: string | null
  designation?: string | null
  managerId?: string | null
  bdNumber?: number | null
  dateOfBirth?: string | null
  panNumber?: string | null
  aadharNumber?: string | null
  uanNumber?: string | null
  aadharDocUrl?: string | null
  panDocUrl?: string | null
  bankAccountName?: string | null
  bankAccountNumber?: string | null
  ifscCode?: string | null
  role?: UserRole
}

export default function HREmployeesPage() {
  const { user } = useAuth()
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [drawerEmployeeId, setDrawerEmployeeId] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [syncJobId, setSyncJobId] = useState<string | null>(null)
  const [syncModalOpen, setSyncModalOpen] = useState(false)
  const queryClient = useQueryClient()
  const editDialogSkipBackRef = useRef(false)
  const drawerSkipBackRef = useRef(false)
  const canEdit = !!user && hasPermission(user, 'hrms:employees:write')
  const canCreate = !!user && hasPermission(user, 'users:write')

  const [departmentFilter, setDepartmentFilter] = useState<string>('all')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>(DEFAULT_STATUS_FILTER)
  const [searchQuery, setSearchQuery] = useState('')
  const [joinDateFrom, setJoinDateFrom] = useState('')
  const [joinDateTo, setJoinDateTo] = useState('')

  const { data: employees, isLoading } = useQuery<Employee[]>({
    queryKey: ['employees', departmentFilter, statusFilter],
    queryFn: () => {
      const params = new URLSearchParams()
      if (departmentFilter && departmentFilter !== 'all') params.set('departmentId', departmentFilter)
      // Always send status so "all" is explicit (API defaults to active headcount)
      params.set('status', statusFilter || 'all')
      return apiGet<Employee[]>(`/api/employees?${params.toString()}`)
    },
  })

  const { data: departments } = useQuery<Department[]>({
    queryKey: ['departments'],
    queryFn: () => apiGet<Department[]>('/api/departments'),
  })

  const { data: employeeMeta } = useQuery<{ circles: CircleOption[] }>({
    queryKey: ['employee-meta'],
    queryFn: () => apiGet<{ circles: CircleOption[] }>('/api/employees/meta'),
  })

  const syncMutation = useMutation({
    mutationFn: (data: { employees: Array<{ employeeId: string; syncLeads: boolean; syncAttendance: boolean }> }) =>
      apiPost<{ jobId: string }>('/api/employees/sync', data),
    onSuccess: (result) => {
      setSyncJobId(result.jobId)
      setSyncModalOpen(true)
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to start sync')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: EditPatchPayload }) =>
      apiPatch<Employee>(`/api/employees/${id}`, data),
    onSuccess: (updatedEmployee, variables) => {
      queryClient.setQueryData<Employee[] | undefined>(['employees'], (current) =>
        current?.map((employee) =>
          employee.id === variables.id
            ? {
                ...employee,
                ...updatedEmployee,
                user: updatedEmployee.user ?? employee.user,
                department: updatedEmployee.department ?? employee.department,
                manager: employee.manager,
              }
            : employee
        )
      )
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      queryClient.invalidateQueries({ queryKey: ['employee', variables.id] })

      const previous = selectedEmployee
      const codeChanged =
        variables.data.employeeCode !== undefined &&
        previous != null &&
        variables.data.employeeCode !== previous.employeeCode
      const bdChanged =
        variables.data.bdNumber !== undefined &&
        previous != null &&
        (variables.data.bdNumber ?? null) !== (previous.bdNumber ?? null)

      editDialogSkipBackRef.current = true
      setIsDialogOpen(false)
      setSelectedEmployee(null)
      toast.success('Employee updated successfully')

      if (codeChanged || bdChanged) {
        syncMutation.mutate({
          employees: [
            {
              employeeId: variables.id,
              syncLeads: bdChanged,
              syncAttendance: codeChanged,
            },
          ],
        })
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update employee')
    },
  })

  const handleView = (employee: Employee) => {
    setDrawerEmployeeId(employee.id)
    setDrawerOpen(true)
  }

  const handleDrawerOpenChange = (open: boolean) => {
    if (!open) drawerSkipBackRef.current = true
    setDrawerOpen(open)
  }

  const handleEditDialogOpenChange = (open: boolean) => {
    if (!open) editDialogSkipBackRef.current = true
    setIsDialogOpen(open)
    if (!open) setSelectedEmployee(null)
  }

  const handleEditFromDrawer = (emp: unknown) => {
    drawerSkipBackRef.current = true
    setDrawerOpen(false)
    setSelectedEmployee(emp as Employee)
    setIsDialogOpen(true)
  }

  const handleAddSuccess = (
    _result: OnboardResult,
    syncConfig: Array<{ employeeId: string; syncLeads: boolean; syncAttendance: boolean }>
  ) => {
    queryClient.invalidateQueries({ queryKey: ['employees'] })

    const employeesWithSync = syncConfig.filter((c) => c.syncLeads || c.syncAttendance)
    if (employeesWithSync.length > 0) {
      syncMutation.mutate({ employees: employeesWithSync })
    }
  }

  const uniqueRoles = Array.from(new Set(employees?.map(e => e.user.role) || [])).sort()

  const filteredEmployees = employees?.filter((employee) => {
    if (roleFilter !== 'all' && employee.user.role !== roleFilter) return false
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      if (!employee.user.name.toLowerCase().includes(query) && !employee.user.email.toLowerCase().includes(query) && !employee.employeeCode.toLowerCase().includes(query)) return false
    }
    if (joinDateFrom && employee.joinDate) {
      if (new Date(employee.joinDate) < new Date(joinDateFrom)) return false
    }
    if (joinDateTo && employee.joinDate) {
      const toDate = new Date(joinDateTo)
      toDate.setHours(23, 59, 59, 999)
      if (new Date(employee.joinDate) > toDate) return false
    }
    return true
  }) || []

  const hasActiveFilters =
    departmentFilter !== 'all' ||
    roleFilter !== 'all' ||
    statusFilter !== DEFAULT_STATUS_FILTER ||
    searchQuery ||
    joinDateFrom ||
    joinDateTo

  const clearFilters = () => {
    setDepartmentFilter('all')
    setRoleFilter('all')
    setStatusFilter(DEFAULT_STATUS_FILTER)
    setSearchQuery('')
    setJoinDateFrom('')
    setJoinDateTo('')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Employee Management</h1>
          <p className="text-muted-foreground mt-1">Manage employee details and information</p>
        </div>
        {canCreate && (
          <Button onClick={() => setAddDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Employee
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              <CardTitle>Filters</CardTitle>
            </div>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4 mr-1" />
                Clear Filters
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            <div>
              <Label>Search</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Name, email, or code..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-8" />
              </div>
            </div>
            <div>
              <Label>Department</Label>
              <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                <SelectTrigger><SelectValue placeholder="All departments" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments?.map((dept) => (<SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Role</Label>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger><SelectValue placeholder="All roles" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  {uniqueRoles.map((role) => (<SelectItem key={role} value={role}>{role.replace('_', ' ')}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger><SelectValue placeholder="All statuses" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="ON_PIP">On PIP</SelectItem>
                  <SelectItem value="ON_NOTICE">On Notice</SelectItem>
                  <SelectItem value="TERMINATED">Inactive</SelectItem>
                  <SelectItem value="ABSCONDED">Absconded</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Join Date From</Label>
              <Input type="date" value={joinDateFrom} onChange={(e) => setJoinDateFrom(e.target.value)} />
            </div>
            <div>
              <Label>Join Date To</Label>
              <Input type="date" value={joinDateTo} onChange={(e) => setJoinDateTo(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Employees</CardTitle>
          <CardDescription>View and edit employee details</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Employee Code</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Join Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmployees.map((employee) => (
                  <TableRow
                    key={employee.id}
                    className={cn(
                      'hover:bg-muted/50 transition-colors',
                      ROW_STATUS_CLASS[employee.status] ?? ''
                    )}
                  >
                    <TableCell className="font-medium">{employee.user.name}</TableCell>
                    <TableCell>{employee.user.email}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{employee.user.role.replace('_', ' ')}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Badge
                          variant="outline"
                          className={cn(
                            'w-fit',
                            employee.status === 'ACTIVE' && 'border-emerald-300 text-emerald-700 bg-emerald-50/80 dark:border-emerald-800 dark:text-emerald-300 dark:bg-emerald-950/30',
                            employee.status === 'ON_PIP' && 'border-orange-300 text-orange-700 bg-orange-50/80 dark:border-orange-800 dark:text-orange-300 dark:bg-orange-950/30',
                            employee.status === 'ON_NOTICE' && 'border-amber-300 text-amber-700 bg-amber-50/80 dark:border-amber-800 dark:text-amber-300 dark:bg-amber-950/30',
                            employee.status === 'TERMINATED' && 'border-red-300 text-red-700 bg-red-50/80 dark:border-red-800 dark:text-red-300 dark:bg-red-950/30',
                            employee.status === 'ABSCONDED' && 'border-rose-300 text-rose-700 bg-rose-50/80 dark:border-rose-800 dark:text-rose-300 dark:bg-rose-950/30'
                          )}
                        >
                          {STATUS_LABELS[employee.status] ?? employee.status}
                        </Badge>
                        {employee.status === 'TERMINATED' && employee.fnfDeadline && (
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 text-[10px] font-medium',
                              employee.fnfCompleted
                                ? 'text-emerald-700 dark:text-emerald-300'
                                : 'text-purple-700 dark:text-purple-300'
                            )}
                          >
                            <Wallet className="h-3 w-3" />
                            FnF: {format(new Date(employee.fnfDeadline), 'MMM d')}
                            {employee.fnfCompleted ? ' ✓' : ''}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Hash className="h-4 w-4 text-muted-foreground" />
                        {employee.employeeCode}
                      </div>
                    </TableCell>
                    <TableCell>
                      {employee.department ? (
                        <div className="flex items-center gap-2">
                          <Building className="h-4 w-4 text-muted-foreground" />
                          {employee.department.name}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">N/A</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {employee.joinDate ? (
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {format(new Date(employee.joinDate), 'PPP')}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">N/A</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => handleView(employee)}>
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredEmployees.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      {hasActiveFilters ? 'No employees match the filters' : 'No employees found'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={isDialogOpen}
        onOpenChange={handleEditDialogOpenChange}
        skipBackOnCloseRef={editDialogSkipBackRef}
      >
        <DialogContent className="w-[min(96vw,80rem)] max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Employee Details</DialogTitle>
            <DialogDescription>Update employee information. Salary and salary structure are managed separately by Finance.</DialogDescription>
          </DialogHeader>
          {selectedEmployee && (
            <EmployeeEditForm
              key={selectedEmployee.id}
              employee={selectedEmployee}
              departments={departments || []}
              circleOptions={employeeMeta?.circles ?? []}
              managerOptions={employees?.filter((e) => e.id !== selectedEmployee.id) ?? []}
              canEditRole={canCreate}
              onSubmit={(data) => updateMutation.mutate({ id: selectedEmployee.id, data })}
              isLoading={updateMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      <EmployeeDetailDrawer
        open={drawerOpen}
        onOpenChange={handleDrawerOpenChange}
        skipBackOnCloseRef={drawerSkipBackRef}
        employeeId={drawerEmployeeId}
        canEdit={canEdit}
        onEditRequest={handleEditFromDrawer}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['employees'] })}
      />

      <AddEmployeeDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onSuccess={handleAddSuccess}
      />

      <SyncProgressModal
        open={syncModalOpen}
        onOpenChange={setSyncModalOpen}
        jobId={syncJobId}
      />
    </div>
  )
}

function toDateInput(value: string | Date | null | undefined): string {
  if (!value) return ''
  const d = value instanceof Date ? value : new Date(value)
  if (isNaN(d.getTime())) return ''
  return format(d, 'yyyy-MM-dd')
}

function EmployeeEditForm({
  employee,
  departments,
  circleOptions,
  managerOptions,
  canEditRole,
  onSubmit,
  isLoading,
}: {
  employee: Employee
  departments: Department[]
  circleOptions: CircleOption[]
  managerOptions: Employee[]
  canEditRole: boolean
  onSubmit: (data: EditPatchPayload) => void
  isLoading: boolean
}) {
  const { user } = useAuth()
  const currentRole = employee.user.role as UserRole
  const [formData, setFormData] = useState<EditFormData>({
    employeeCode: employee.employeeCode,
    bdNumber: employee.bdNumber != null ? String(employee.bdNumber) : '',
    circles: parseEmployeeCircleList(employee.circle),
    joinDate: toDateInput(employee.joinDate),
    departmentId: employee.department?.id || 'none',
    managerId: employee.manager?.id || 'none',
    designation: employee.designation || employee.user.role.replace('_', ' ') || '',
    role: employee.user.role,
    dateOfBirth: toDateInput(employee.dateOfBirth),
    panNumber: employee.panNumber || '',
    aadharNumber: employee.aadharNumber || '',
    uanNumber: employee.uanNumber || '',
    aadharDocUrl: employee.aadharDocUrl || '',
    panDocUrl: employee.panDocUrl || '',
    bankAccountName: employee.bankAccountName || '',
    bankAccountNumber: employee.bankAccountNumber || '',
    ifscCode: employee.ifscCode || '',
  })

  const availableRoles = (() => {
    if (!canEditRole || !user) return []
    const allowed = new Set(getAvailableRolesForCreator(user))
    const ordered = EDIT_EMPLOYEE_ROLE_ORDER.filter((role) => allowed.has(role))
    // Keep locked current role visible only while still selected (cannot re-assign it after leaving)
    if (
      currentRole &&
      !allowed.has(currentRole) &&
      formData.role === currentRole
    ) {
      return [currentRole, ...ordered]
    }
    return ordered
  })()

  const set = <K extends keyof EditFormData>(key: K, value: EditFormData[K]) =>
    setFormData((prev) => ({ ...prev, [key]: value }))
  const circleSelectOptions = (() => {
    const options = circleOptions.map((circle) => ({
      value: circle.name,
      label: `${circle.name}${!circle.isActive ? ' (Inactive)' : ''}`,
    }))

    for (const legacyCircle of formData.circles) {
      if (!options.some((option) => option.value.toLowerCase() === legacyCircle.toLowerCase())) {
        options.push({
          value: legacyCircle,
          label: `${legacyCircle} (Legacy)`,
        })
      }
    }

    return options.sort((a, b) => a.label.localeCompare(b.label))
  })()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.employeeCode.trim()) {
      toast.error('Employee code is required')
      return
    }

    const trimmedBd = formData.bdNumber.trim()
    let bdNumber: number | null = null
    if (trimmedBd) {
      const parsed = Number(trimmedBd)
      if (!Number.isInteger(parsed) || parsed <= 0) {
        toast.error('CRM Number must be a positive integer')
        return
      }
      bdNumber = parsed
    }

    const payload: EditPatchPayload = {
      employeeCode: formData.employeeCode.trim(),
      circles: formData.circles,
      joinDate: formData.joinDate || null,
      departmentId: formData.departmentId === 'none' ? null : formData.departmentId || null,
      managerId: formData.managerId === 'none' ? null : formData.managerId || null,
      designation: formData.designation.trim() || null,
      bdNumber,
      dateOfBirth: formData.dateOfBirth || null,
      panNumber: formData.panNumber.trim() || null,
      aadharNumber: formData.aadharNumber.trim() || null,
      uanNumber: formData.uanNumber.trim() || null,
      aadharDocUrl: formData.aadharDocUrl.trim() || null,
      panDocUrl: formData.panDocUrl.trim() || null,
      bankAccountName: formData.bankAccountName.trim() || null,
      bankAccountNumber: formData.bankAccountNumber.trim() || null,
      ifscCode: formData.ifscCode.trim().toUpperCase() || null,
    }

    if (canEditRole && formData.role) {
      payload.role = formData.role as UserRole
    }

    onSubmit(payload)
  }

  const allowedForCreator = user ? new Set(getAvailableRolesForCreator(user)) : new Set<UserRole>()

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <FormSection title="Employment">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Position</Label>
            <Input
              value={formData.designation}
              onChange={(e) => set('designation', e.target.value)}
              placeholder="e.g. Business Development Executive"
            />
          </div>
          {canEditRole && availableRoles.length > 0 && (
            <div>
              <Label>Role</Label>
              <Select
                value={formData.role}
                onValueChange={(value) => set('role', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {availableRoles.map((role) => (
                    <SelectItem key={role} value={role}>
                      {getRoleLabel(role)}
                      {!allowedForCreator.has(role) ? ' (current)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label>Employee Code *</Label>
            <Input
              value={formData.employeeCode}
              onChange={(e) => set('employeeCode', e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground mt-1">
              Changing this will resync attendance from biometrics.
            </p>
          </div>
          <div>
            <Label>CRM Number</Label>
            <Input
              type="number"
              min={1}
              value={formData.bdNumber}
              onChange={(e) => set('bdNumber', e.target.value)}
              placeholder="e.g. 1234"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Changing this will resync leads from the CRM.
            </p>
          </div>
          <div className="md:col-span-2">
            <Label>Circles</Label>
            <MultiSelectDropdown
              options={circleSelectOptions}
              selected={formData.circles}
              onChange={(value) => set('circles', value)}
              placeholder="Select circles"
              searchPlaceholder="Search circles"
              emptyMeansAll={false}
              emptyLabel="No circles"
              className="w-full justify-between"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Used for circle mapping and CRM auto-assignment where applicable.
            </p>
          </div>
          <div>
            <Label>Join Date</Label>
            <Input
              type="date"
              value={formData.joinDate}
              onChange={(e) => set('joinDate', e.target.value)}
            />
          </div>
          <div>
            <Label>Department</Label>
            <Select value={formData.departmentId} onValueChange={(v) => set('departmentId', v)}>
              <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Department</SelectItem>
                {departments.map((dept) => (
                  <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Manager</Label>
            <Select value={formData.managerId} onValueChange={(v) => set('managerId', v)}>
              <SelectTrigger><SelectValue placeholder="Select manager" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No manager</SelectItem>
                {[...managerOptions]
                  .sort((a, b) => a.user.name.localeCompare(b.user.name))
                  .map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.user.name} ({e.employeeCode})
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </FormSection>

      <FormSection title="Personal">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Date of Birth</Label>
            <Input
              type="date"
              value={formData.dateOfBirth}
              onChange={(e) => set('dateOfBirth', e.target.value)}
            />
          </div>
          <div>
            <Label>PAN</Label>
            <Input
              value={formData.panNumber}
              onChange={(e) => set('panNumber', e.target.value.toUpperCase())}
              maxLength={10}
              placeholder="ABCDE1234F"
            />
          </div>
          <div>
            <Label>Aadhar Number</Label>
            <Input
              value={formData.aadharNumber}
              onChange={(e) => set('aadharNumber', e.target.value.replace(/\D/g, ''))}
              maxLength={12}
              placeholder="12 digits"
            />
          </div>
          <div>
            <Label>UAN</Label>
            <Input
              value={formData.uanNumber}
              onChange={(e) => set('uanNumber', e.target.value)}
              maxLength={50}
              placeholder="Universal Account Number"
            />
          </div>
        </div>
      </FormSection>

      <FormSection title="Documents">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>PAN Document URL</Label>
            <Input
              type="url"
              value={formData.panDocUrl}
              onChange={(e) => set('panDocUrl', e.target.value)}
              placeholder="https://..."
            />
          </div>
          <div>
            <Label>Aadhar Document URL</Label>
            <Input
              type="url"
              value={formData.aadharDocUrl}
              onChange={(e) => set('aadharDocUrl', e.target.value)}
              placeholder="https://..."
            />
          </div>
        </div>
      </FormSection>

      <FormSection title="Bank Account">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Label>Account Holder Name</Label>
            <Input
              value={formData.bankAccountName}
              onChange={(e) => set('bankAccountName', e.target.value)}
              placeholder="Name as on bank account"
            />
          </div>
          <div>
            <Label>Account Number</Label>
            <Input
              value={formData.bankAccountNumber}
              onChange={(e) => set('bankAccountNumber', e.target.value)}
              placeholder="Bank account number"
            />
          </div>
          <div>
            <Label>IFSC Code</Label>
            <Input
              value={formData.ifscCode}
              onChange={(e) => set('ifscCode', e.target.value.toUpperCase())}
              maxLength={11}
              placeholder="ABCD0123456"
            />
          </div>
        </div>
      </FormSection>

      <div className="flex justify-end gap-2 pt-2 border-t">
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Updating...' : 'Update Employee'}
        </Button>
      </div>
    </form>
  )
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  )
}
