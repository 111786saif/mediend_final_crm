'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api-client'
import { useState } from 'react'
import { Plus, Users, UserPlus, Edit, Hash, DollarSign, Building, CreditCard, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { useAuth } from '@/hooks/use-auth'
import { type UserRole } from '@/generated/prisma/enums'
import { getAvailableRolesForCreator } from '@/lib/rbac'
import { getRoleLabel } from '@/lib/roles'

const USER_MANAGEMENT_ROLE_ORDER: UserRole[] = [
  'SALES_HEAD',
  'TEAM_LEAD',
  'BD',
  'INSURANCE_HEAD',
  'PL_HEAD',
  'HR_HEAD',
  'FINANCE_HEAD',
  'ADMIN',
  'USER',
]

function getUserManagementRoles(
  currentUser: { id: string; email: string; name: string; role: UserRole } | null | undefined
): UserRole[] {
  const allowed = new Set(getAvailableRolesForCreator(currentUser ?? null))
  return USER_MANAGEMENT_ROLE_ORDER.filter((role) => allowed.has(role))
}

interface Employee {
  id: string
  employeeCode: string
  bdNumber: number | null
  circle: string | null
  joinDate: Date | null
  salary: number | null
  departmentId: string | null
  dateOfBirth: Date | null
  aadharNumber: string | null
  panNumber: string | null
  aadharDocUrl: string | null
  panDocUrl: string | null
  department?: {
    id: string
    name: string
    headId: string | null
  } | null
}

interface User {
  id: string
  name: string
  email: string
  role: UserRole
  employee?: Employee | null
}

interface CreateUserData {
  name: string
  email: string
  password: string
  role: UserRole
  departmentId: string | null
  employeeCode: string
  managerId: string | null
  bdNumber: number | null
}

export default function HRUsersPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const queryClient = useQueryClient()

  const { data: users, isLoading } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: () => apiGet<User[]>('/api/users?includeInactive=true'),
  })

  const { data: departments } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ['departments'],
    queryFn: () => apiGet<Array<{ id: string; name: string }>>('/api/departments'),
  })

  const { data: employees } = useQuery<Array<{ id: string; employeeCode: string; user: { name: string } }>>({
    queryKey: ['employees'],
    queryFn: () => apiGet<Array<{ id: string; employeeCode: string; user: { name: string } }>>('/api/employees'),
  })

  const createUserMutation = useMutation({
    mutationFn: (data: CreateUserData) => apiPost<User>('/api/users', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setIsDialogOpen(false)
      toast.success('User created successfully')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create user')
    },
  })

  return (
    <div className="space-y-6">
      <div className="mx-auto max-w-full">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">User Management</h1>
              <p className="text-muted-foreground mt-1">Manage users, roles, and team assignments</p>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create User
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Create New User</DialogTitle>
                  <DialogDescription>Add a new user to the system</DialogDescription>
                </DialogHeader>
                <CreateUserForm
                  departments={departments || []}
                  employees={employees || []}
                  onSubmit={(data) => createUserMutation.mutate(data)}
                  isLoading={createUserMutation.isPending}
                />
              </DialogContent>
            </Dialog>
          </div>

          {/* Stats Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{users?.length || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">BDs</CardTitle>
                <UserPlus className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {users?.filter((u) => u.role === 'BD').length || 0}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Team Leads</CardTitle>
                <UserPlus className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {users?.filter((u) => u.role === 'TEAM_LEAD').length || 0}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Users Table */}
          <Card>
            <CardHeader>
              <CardTitle>All Users</CardTitle>
              <CardDescription>Manage user accounts and permissions</CardDescription>
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
                        <TableHead>Employee Code</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Salary</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users?.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.name}</TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{getRoleLabel(user.role)}</Badge>
                        </TableCell>
                        <TableCell>
                          {user.employee ? (
                            <div className="flex items-center gap-2">
                              <Hash className="h-4 w-4 text-muted-foreground" />
                              {user.employee.employeeCode}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">Not set</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {user.employee?.department ? (
                            <div className="flex items-center gap-2">
                              <Building className="h-4 w-4 text-muted-foreground" />
                              <span>{user.employee.department.name}</span>
                              {/* Check if user is department head */}
                              {user.employee.department.headId === user.id && (
                                <Badge variant="default" className="text-xs">Head</Badge>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">Not set</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {user.employee?.salary ? (
                            <div className="flex items-center gap-2">
                              <DollarSign className="h-4 w-4 text-muted-foreground" />
                              {new Intl.NumberFormat('en-IN', {
                                style: 'currency',
                                currency: 'INR',
                                minimumFractionDigits: 0,
                              }).format(user.employee.salary)}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">Not set</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="default">Active</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <EditUserDialog
                              user={user}
                              onSuccess={() => {
                                queryClient.invalidateQueries({ queryKey: ['users'] })
                              }}
                            />
                            <EditEmployeeDialog
                              user={user}
                              departments={departments || []}
                              onSuccess={() => {
                                queryClient.invalidateQueries({ queryKey: ['users'] })
                              }}
                            />
                            <DeleteUserDialog
                              user={user}
                              onSuccess={() => {
                                queryClient.invalidateQueries({ queryKey: ['users'] })
                              }}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!users || users.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                          No users found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
    </div>
  )
}

function CreateUserForm({
  departments,
  employees,
  onSubmit,
  isLoading,
}: {
  departments: Array<{ id: string; name: string }>
  employees: Array<{ id: string; employeeCode: string; user: { name: string } }>
  onSubmit: (data: CreateUserData) => void
  isLoading: boolean
}) {
  const { user: currentUser } = useAuth()
  const availableRoles = getUserManagementRoles(currentUser)
  const defaultRole = availableRoles[0] || 'USER'

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: defaultRole as UserRole,
    departmentId: '',
    employeeCode: '',
    managerId: '',
    bdNumber: '',
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.employeeCode.trim()) {
      return
    }
    const bdNum = formData.bdNumber.trim() ? parseInt(formData.bdNumber, 10) : null
    if (formData.bdNumber.trim() && (isNaN(bdNum!) || bdNum! < 1)) {
      toast.error('CRM Number must be a positive integer')
      return
    }
    onSubmit({
      name: formData.name,
      email: formData.email,
      password: formData.password,
      role: formData.role,
      departmentId: formData.departmentId || null,
      employeeCode: formData.employeeCode.trim(),
      managerId: formData.managerId || null,
      bdNumber: bdNum,
    })
    // Reset form
    setFormData({
      name: '',
      email: '',
      password: '',
      role: defaultRole as UserRole,
      departmentId: '',
      employeeCode: '',
      managerId: '',
      bdNumber: '',
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Name</Label>
          <Input
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
        </div>
        <div>
          <Label>Email</Label>
          <Input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value.toLowerCase().trim() })}
            required
          />
        </div>
      </div>

      <div>
        <Label>Password</Label>
        <Input
          type="password"
          value={formData.password}
          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          required
          minLength={6}
        />
      </div>

      <div>
        <Label>Employee Code *</Label>
        <Input
          value={formData.employeeCode}
          onChange={(e) => setFormData({ ...formData, employeeCode: e.target.value })}
          required
          placeholder="e.g. EMP001"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Role</Label>
          <Select
            value={formData.role}
            onValueChange={(value) => {
              const newRole = value as UserRole
              setFormData({ 
                ...formData, 
                role: newRole,
                // Clear department if role changes to non-USER
                departmentId: newRole === 'USER' ? formData.departmentId : ''
              })
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableRoles.length === 0 ? (
                <SelectItem value="" disabled>No roles available</SelectItem>
              ) : (
                availableRoles.map((role) => (
                  <SelectItem key={role} value={role}>
                    {getRoleLabel(role)}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          {availableRoles.length === 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              You do not have permission to create users
            </p>
          )}
        </div>

        <div>
          <Label>Department {formData.role === 'USER' && '*'}</Label>
          <Select
            value={formData.departmentId || 'none'}
            onValueChange={(value) => setFormData({ ...formData, departmentId: value === 'none' ? '' : value })}
            required={formData.role === 'USER'}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select department" />
            </SelectTrigger>
            <SelectContent>
              {formData.role !== 'USER' && (
                <SelectItem value="none">No Department</SelectItem>
              )}
              {departments.map((dept) => (
                <SelectItem key={dept.id} value={dept.id}>
                  {dept.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {formData.role === 'USER' && (
            <p className="text-xs text-muted-foreground mt-1">
              Department is required for USER role (HRMS only)
            </p>
          )}
        </div>
      </div>

      <div>
        <Label>Manager (optional)</Label>
        <Select
          value={formData.managerId || 'none'}
          onValueChange={(value) => setFormData({ ...formData, managerId: value === 'none' ? '' : value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="No manager" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No manager</SelectItem>
            {employees.map((emp) => (
              <SelectItem key={emp.id} value={emp.id}>
                {emp.user.name} ({emp.employeeCode})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {formData.role === 'BD' && (
          <div>
            <Label>CRM Number (optional)</Label>
            <Input
              type="number"
              min={1}
              step={1}
              value={formData.bdNumber}
              onChange={(e) => setFormData({ ...formData, bdNumber: e.target.value })}
              placeholder="For lead sync"
            />
            <p className="text-xs text-muted-foreground mt-1">
              If set, leads with this CRM number will be assigned to this employee when synced.
            </p>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Creating...' : 'Create User'}
        </Button>
      </div>
    </form>
  )
}

function EditUserDialog({
  user,
  onSuccess,
}: {
  user: User
  onSuccess: () => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const { user: currentUser } = useAuth()
  const availableRoles = getUserManagementRoles(currentUser)
  
  // Initialize form data based on user prop
  const getInitialFormData = () => ({
    name: user.name,
    email: user.email,
    role: user.role,
  })
  const [formData, setFormData] = useState(getInitialFormData)

  // Reset form when dialog opens
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
    if (open) {
      setFormData(getInitialFormData())
    }
  }

  const updateUserMutation = useMutation({
    mutationFn: (data: { name: string; email: string; role: UserRole }) =>
      apiPatch<User>(`/api/users/${user.id}`, data),
    onSuccess: () => {
      toast.success('User updated successfully')
      setIsOpen(false)
      onSuccess()
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update user')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    updateUserMutation.mutate(formData)
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Edit className="h-4 w-4 mr-1" />
          Edit User
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
          <DialogDescription>
            Update user information for {user.name}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Name</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              placeholder="User name"
            />
          </div>
          <div>
            <Label>Email</Label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value.toLowerCase().trim() })}
              required
              placeholder="user@example.com"
            />
          </div>
          <div>
            <Label>Role</Label>
            <Select
              value={formData.role}
              onValueChange={(value) => setFormData({ ...formData, role: value as UserRole })}
              disabled={availableRoles.length === 0}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableRoles.length === 0 ? (
                  <SelectItem value={user.role} disabled>
                    {getRoleLabel(user.role)}
                  </SelectItem>
                ) : (
                  availableRoles.map((role) => (
                    <SelectItem key={role} value={role}>
                      {getRoleLabel(role)}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {availableRoles.length === 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                You do not have permission to change user roles
              </p>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={updateUserMutation.isPending}
            >
              {updateUserMutation.isPending ? 'Updating...' : 'Update User'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function EditEmployeeDialog({
  user,
  departments,
  onSuccess,
}: {
  user: User
  departments: Array<{ id: string; name: string }>
  onSuccess: () => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [formData, setFormData] = useState({
    employeeCode: user.employee?.employeeCode || '',
    bdNumber: user.employee?.bdNumber != null ? String(user.employee.bdNumber) : '',
    joinDate: user.employee?.joinDate ? format(new Date(user.employee.joinDate), 'yyyy-MM-dd') : '',
    salary: user.employee?.salary?.toString() || '',
    departmentId: user.employee?.departmentId || 'none',
    dateOfBirth: user.employee?.dateOfBirth ? format(new Date(user.employee.dateOfBirth), 'yyyy-MM-dd') : '',
    aadharNumber: user.employee?.aadharNumber || '',
    panNumber: user.employee?.panNumber || '',
    aadharDocUrl: user.employee?.aadharDocUrl || '',
    panDocUrl: user.employee?.panDocUrl || '',
  })

  const createEmployeeMutation = useMutation({
    mutationFn: (data: {
      userId: string
      employeeCode: string
      bdNumber?: number | null
      joinDate?: string | null
      salary?: number | null
      departmentId?: string | null
      dateOfBirth?: string | null
      aadharNumber?: string | null
      panNumber?: string | null
      aadharDocUrl?: string | null
      panDocUrl?: string | null
    }) => apiPost('/api/employees', data),
    onSuccess: () => {
      toast.success('Employee record created successfully')
      setIsOpen(false)
      onSuccess()
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create employee record')
    },
  })

  const updateEmployeeMutation = useMutation({
    mutationFn: async (data: {
      employeeCode?: string
      bdNumber?: number | null
      joinDate?: string | null
      salary?: number | null
      departmentId?: string | null
      dateOfBirth?: string | null
      aadharNumber?: string | null
      panNumber?: string | null
      aadharDocUrl?: string | null
      panDocUrl?: string | null
    }) => {
      if (user.employee) {
        return apiPatch(`/api/employees/${user.employee.id}`, data)
      } else {
        throw new Error('Employee record not found')
      }
    },
    onSuccess: () => {
      toast.success('Employee details updated successfully')
      setIsOpen(false)
      onSuccess()
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update employee details')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    const bdNum = formData.bdNumber.trim() ? parseInt(formData.bdNumber, 10) : null
    if (formData.bdNumber.trim() && (isNaN(bdNum!) || bdNum! < 1)) {
      toast.error('CRM Number must be a positive integer')
      return
    }

    if (user.employee) {
      // Update existing employee
      updateEmployeeMutation.mutate({
        employeeCode: formData.employeeCode || undefined,
        bdNumber: bdNum,
        joinDate: formData.joinDate || null,
        salary: formData.salary ? parseFloat(formData.salary) : null,
        departmentId: formData.departmentId === 'none' ? null : formData.departmentId || null,
        dateOfBirth: formData.dateOfBirth || null,
        aadharNumber: formData.aadharNumber || null,
        panNumber: formData.panNumber || null,
        aadharDocUrl: formData.aadharDocUrl || null,
        panDocUrl: formData.panDocUrl || null,
      })
    } else {
      // Create new employee
      if (!formData.employeeCode) {
        toast.error('Employee code is required')
        return
      }
      createEmployeeMutation.mutate({
        userId: user.id,
        employeeCode: formData.employeeCode,
        bdNumber: bdNum,
        joinDate: formData.joinDate || null,
        salary: formData.salary ? parseFloat(formData.salary) : null,
        departmentId: formData.departmentId === 'none' ? null : formData.departmentId || null,
        dateOfBirth: formData.dateOfBirth || null,
        aadharNumber: formData.aadharNumber || null,
        panNumber: formData.panNumber || null,
        aadharDocUrl: formData.aadharDocUrl || null,
        panDocUrl: formData.panDocUrl || null,
      })
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Edit className="h-4 w-4 mr-1" />
          {user.employee ? 'Edit Employee' : 'Add Employee'}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Employee Details</DialogTitle>
          <DialogDescription>
            Manage employee information for {user.name}
          </DialogDescription>
        </DialogHeader>
        {!user.employee && (
          <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-4">
            <p className="text-sm text-blue-800">
              No employee record found. Fill in the details below to create one.
            </p>
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
          {user.employee && (formData.employeeCode !== (user.employee.employeeCode || '') || formData.bdNumber !== (user.employee.bdNumber != null ? String(user.employee.bdNumber) : '')) && (
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
              <p className="text-sm text-amber-800 dark:text-amber-300 font-medium">
                {formData.employeeCode !== (user.employee.employeeCode || '') && formData.bdNumber !== (user.employee.bdNumber != null ? String(user.employee.bdNumber) : '')
                  ? 'Changing Employee Code and CRM Number will delete existing attendance records and leads, then re-sync from source systems.'
                  : formData.employeeCode !== (user.employee.employeeCode || '')
                    ? 'Changing Employee Code will delete existing attendance records and re-sync from the biometric system.'
                    : 'Changing CRM Number will delete existing leads and re-sync from MySQL.'}
              </p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Employee Code *</Label>
              <Input
                value={formData.employeeCode}
                onChange={(e) => setFormData({ ...formData, employeeCode: e.target.value })}
                required
                placeholder="e.g., EMP001"
              />
            </div>
            {user.role === 'BD' && (
              <div>
                <Label>CRM Number (optional)</Label>
                <Input
                  type="number"
                  min={1}
                  step={1}
                  value={formData.bdNumber}
                  onChange={(e) => setFormData({ ...formData, bdNumber: e.target.value })}
                  placeholder="For lead sync"
                />
              </div>
            )}
            <div>
              <Label>Date of Birth</Label>
              <Input
                type="date"
                value={formData.dateOfBirth}
                onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Join Date</Label>
              <Input
                type="date"
                value={formData.joinDate}
                onChange={(e) => setFormData({ ...formData, joinDate: e.target.value })}
              />
            </div>
            <div>
              <Label>Salary</Label>
              <Input
                type="number"
                value={formData.salary}
                onChange={(e) => setFormData({ ...formData, salary: e.target.value })}
                min={0}
                step="0.01"
                placeholder="Monthly salary"
              />
            </div>
          </div>

          <div>
            <Label>Department</Label>
            <Select
              value={formData.departmentId}
              onValueChange={(value) => setFormData({ ...formData, departmentId: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Department</SelectItem>
                {departments.map((dept) => (
                  <SelectItem key={dept.id} value={dept.id}>
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="border-t pt-4 mt-4">
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Identity Documents
            </h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Aadhar Number</Label>
                <Input
                  value={formData.aadharNumber}
                  onChange={(e) => setFormData({ ...formData, aadharNumber: e.target.value })}
                  placeholder="12-digit Aadhar number"
                  maxLength={12}
                  pattern="[0-9]{12}"
                />
              </div>
              <div>
                <Label>PAN Number</Label>
                <Input
                  value={formData.panNumber}
                  onChange={(e) => setFormData({ ...formData, panNumber: e.target.value.toUpperCase() })}
                  placeholder="e.g., ABCDE1234F"
                  maxLength={10}
                  pattern="[A-Z]{5}[0-9]{4}[A-Z]{1}"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <Label>Aadhar Document URL</Label>
                <Input
                  value={formData.aadharDocUrl}
                  onChange={(e) => setFormData({ ...formData, aadharDocUrl: e.target.value })}
                  placeholder="URL to uploaded Aadhar document"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Upload document separately and paste URL
                </p>
              </div>
              <div>
                <Label>PAN Document URL</Label>
                <Input
                  value={formData.panDocUrl}
                  onChange={(e) => setFormData({ ...formData, panDocUrl: e.target.value })}
                  placeholder="URL to uploaded PAN document"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Upload document separately and paste URL
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={updateEmployeeMutation.isPending || createEmployeeMutation.isPending}
            >
              {updateEmployeeMutation.isPending || createEmployeeMutation.isPending
                ? (user.employee ? 'Updating...' : 'Creating...')
                : (user.employee ? 'Update Employee' : 'Create Employee')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function DeleteUserDialog({
  user,
  onSuccess,
}: {
  user: User
  onSuccess: () => void
}) {
  const [isOpen, setIsOpen] = useState(false)

  const deleteUserMutation = useMutation({
    mutationFn: () => apiDelete(`/api/users/${user.id}`),
    onSuccess: () => {
      toast.success('User deleted successfully')
      setIsOpen(false)
      onSuccess()
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete user')
    },
  })

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="sm">
          <Trash2 className="h-4 w-4 mr-1" />
          Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete User</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete <strong>{user.name}</strong>? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => deleteUserMutation.mutate()}
            disabled={deleteUserMutation.isPending}
            className="bg-red-600 hover:bg-red-700"
          >
            {deleteUserMutation.isPending ? 'Deleting...' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
