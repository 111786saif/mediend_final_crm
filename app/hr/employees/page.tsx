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
import { useState } from 'react'
import { Building, Hash, Calendar, DollarSign, Search, Filter, X, Plus, Eye } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/hooks/use-auth'
import { hasPermission } from '@/lib/rbac'
import { cn } from '@/lib/utils'
import { EmployeeDetailDrawer } from '@/components/hr/employee-detail-drawer'
import { AddEmployeeDialog, type OnboardResult } from '@/components/hr/add-employee-dialog'
import { SyncProgressModal } from '@/components/hr/sync-progress-modal'

interface Department {
  id: string
  name: string
}

interface Employee {
  id: string
  employeeCode: string
  joinDate: Date | null
  salary: number | null
  designation: string | null
  status: string
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
}

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Active',
  ON_PIP: 'On PIP',
  ON_NOTICE: 'Notice',
  TERMINATED: 'Inactive',
}

const ROW_STATUS_CLASS: Record<string, string> = {
  ACTIVE: '',
  ON_PIP: 'bg-orange-50/50 dark:bg-orange-950/20',
  ON_NOTICE: 'bg-amber-50/50 dark:bg-amber-950/20',
  TERMINATED: 'bg-red-50/50 dark:bg-red-950/20',
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
  const canEdit = !!user && hasPermission(user, 'hrms:employees:write')
  const canCreate = !!user && hasPermission(user, 'users:write')

  const [departmentFilter, setDepartmentFilter] = useState<string>('all')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [joinDateFrom, setJoinDateFrom] = useState('')
  const [joinDateTo, setJoinDateTo] = useState('')

  const { data: employees, isLoading } = useQuery<Employee[]>({
    queryKey: ['employees', departmentFilter, statusFilter],
    queryFn: () => {
      const params = new URLSearchParams()
      if (departmentFilter && departmentFilter !== 'all') params.set('departmentId', departmentFilter)
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter)
      return apiGet<Employee[]>(`/api/employees?${params.toString()}`)
    },
  })

  const { data: departments } = useQuery<Department[]>({
    queryKey: ['departments'],
    queryFn: () => apiGet<Department[]>('/api/departments'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { employeeCode?: string; joinDate?: string | null; salary?: number | null; departmentId?: string | null; designation?: string | null } }) =>
      apiPatch<Employee>(`/api/employees/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      setIsDialogOpen(false)
      setSelectedEmployee(null)
      toast.success('Employee updated successfully')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update employee')
    },
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

  const handleView = (employee: Employee) => {
    setDrawerEmployeeId(employee.id)
    setDrawerOpen(true)
  }

  const handleEditFromDrawer = (emp: unknown) => {
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

  const hasActiveFilters = departmentFilter !== 'all' || roleFilter !== 'all' || statusFilter !== 'all' || searchQuery || joinDateFrom || joinDateTo

  const clearFilters = () => {
    setDepartmentFilter('all')
    setRoleFilter('all')
    setStatusFilter('all')
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
                      <Badge
                        variant="outline"
                        className={cn(
                          employee.status === 'ACTIVE' && 'border-emerald-300 text-emerald-700 bg-emerald-50/80 dark:border-emerald-800 dark:text-emerald-300 dark:bg-emerald-950/30',
                          employee.status === 'ON_PIP' && 'border-orange-300 text-orange-700 bg-orange-50/80 dark:border-orange-800 dark:text-orange-300 dark:bg-orange-950/30',
                          employee.status === 'ON_NOTICE' && 'border-amber-300 text-amber-700 bg-amber-50/80 dark:border-amber-800 dark:text-amber-300 dark:bg-amber-950/30',
                          employee.status === 'TERMINATED' && 'border-red-300 text-red-700 bg-red-50/80 dark:border-red-800 dark:text-red-300 dark:bg-red-950/30'
                        )}
                      >
                        {STATUS_LABELS[employee.status] ?? employee.status}
                      </Badge>
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

      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        setIsDialogOpen(open)
        if (!open) setSelectedEmployee(null)
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Employee Details</DialogTitle>
            <DialogDescription>Update employee information</DialogDescription>
          </DialogHeader>
          {selectedEmployee && (
            <EmployeeEditForm
              employee={selectedEmployee}
              departments={departments || []}
              onSubmit={(data) => {
                const updateData: { employeeCode?: string; joinDate?: string | null; salary?: number | null; departmentId?: string | null; designation?: string | null } = {}
                if (data.employeeCode) updateData.employeeCode = data.employeeCode
                if (data.joinDate !== undefined) updateData.joinDate = data.joinDate
                if (data.salary !== undefined) updateData.salary = data.salary
                if (data.departmentId !== undefined) updateData.departmentId = data.departmentId
                if (data.designation !== undefined) updateData.designation = data.designation
                updateMutation.mutate({ id: selectedEmployee.id, data: updateData })
              }}
              isLoading={updateMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      <EmployeeDetailDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
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

function EmployeeEditForm({
  employee,
  departments,
  onSubmit,
  isLoading,
}: {
  employee: Employee
  departments: Department[]
  onSubmit: (data: {
    employeeCode?: string
    joinDate?: string | null
    salary?: number | null
    departmentId?: string | null
    designation?: string | null
  }) => void
  isLoading: boolean
}) {
  const [formData, setFormData] = useState({
    employeeCode: employee.employeeCode,
    joinDate: employee.joinDate ? format(new Date(employee.joinDate), 'yyyy-MM-dd') : '',
    salary: employee.salary?.toString() || '',
    departmentId: employee.department?.id || 'none',
    designation: employee.designation || employee.user.role.replace('_', ' ') || '',
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({
      employeeCode: formData.employeeCode,
      joinDate: formData.joinDate ? formData.joinDate : null,
      salary: formData.salary ? parseFloat(formData.salary) : null,
      departmentId: formData.departmentId === 'none' ? null : formData.departmentId || null,
      designation: formData.designation || null,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label>Position</Label>
        <Input value={formData.designation} onChange={(e) => setFormData({ ...formData, designation: e.target.value })} placeholder="e.g. Business Development Executive" />
      </div>
      <div>
        <Label>Employee Code</Label>
        <Input value={formData.employeeCode} onChange={(e) => setFormData({ ...formData, employeeCode: e.target.value })} required />
      </div>
      <div>
        <Label>Join Date</Label>
        <Input type="date" value={formData.joinDate} onChange={(e) => setFormData({ ...formData, joinDate: e.target.value })} />
      </div>
      <div>
        <Label>Salary</Label>
        <Input type="number" value={formData.salary} onChange={(e) => setFormData({ ...formData, salary: e.target.value })} min={0} step="0.01" />
      </div>
      <div>
        <Label>Department</Label>
        <Select value={formData.departmentId} onValueChange={(value) => setFormData({ ...formData, departmentId: value })}>
          <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No Department</SelectItem>
            {departments.map((dept) => (<SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Updating...' : 'Update Employee'}
        </Button>
      </div>
    </form>
  )
}
