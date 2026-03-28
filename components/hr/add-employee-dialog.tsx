'use client'

import { useState, useCallback } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useMutation, useQuery } from '@tanstack/react-query'
import { apiGet, apiPost } from '@/lib/api-client'
import { useAuth } from '@/hooks/use-auth'
import { toast } from 'sonner'
import { Plus, Trash2, ArrowRight, ArrowLeft, Check, Users, RefreshCw, UserPlus } from 'lucide-react'
import { cn } from '@/lib/utils'

type UserRole = 'SALES_HEAD' | 'CATEGORY_MANAGER' | 'ASSISTANT_CATEGORY_MANAGER' | 'TEAM_LEAD' | 'BD' | 'INSURANCE_HEAD' | 'PL_HEAD' | 'OUTSTANDING_HEAD' | 'HR_HEAD' | 'FINANCE_HEAD' | 'DIGITAL_MARKETING_HEAD' | 'IT_HEAD' | 'LOAN_DEMAT_HEAD' | 'EXECUTIVE_ASSISTANT' | 'ADMIN' | 'USER'

const ROLE_LABELS: Record<string, string> = {
  SALES_HEAD: 'Sales Head',
  CATEGORY_MANAGER: 'Category Manager',
  ASSISTANT_CATEGORY_MANAGER: 'Asst. Category Manager',
  TEAM_LEAD: 'Team Lead',
  BD: 'BD',
  INSURANCE_HEAD: 'Insurance Head',
  PL_HEAD: 'P/L Head',
  OUTSTANDING_HEAD: 'Outstanding Head',
  HR_HEAD: 'HR Head',
  FINANCE_HEAD: 'Finance Head',
  DIGITAL_MARKETING_HEAD: 'Digital Marketing Head',
  IT_HEAD: 'IT Head',
  LOAN_DEMAT_HEAD: 'Loan & Demat Head',
  EXECUTIVE_ASSISTANT: 'Executive Assistant',
  ADMIN: 'Admin',
  USER: 'User (HRMS Only)',
}

interface EmployeeFormData {
  id: string
  name: string
  email: string
  password: string
  role: UserRole
  employeeCode: string
  bdNumber: string
  departmentId: string
  managerId: string
  joinDate: string
  dateOfBirth: string
  syncLeads: boolean
  syncAttendance: boolean
}

function createEmptyEmployee(): EmployeeFormData {
  return {
    id: crypto.randomUUID(),
    name: '',
    email: '',
    password: '',
    role: 'BD',
    employeeCode: '',
    bdNumber: '',
    departmentId: '',
    managerId: '',
    joinDate: '',
    dateOfBirth: '',
    syncLeads: false,
    syncAttendance: false,
  }
}

function getAvailableRoles(userRole: string): UserRole[] {
  if (userRole === 'MD' || userRole === 'ADMIN') {
    return ['SALES_HEAD', 'CATEGORY_MANAGER', 'ASSISTANT_CATEGORY_MANAGER', 'TEAM_LEAD', 'BD', 'INSURANCE_HEAD', 'PL_HEAD', 'OUTSTANDING_HEAD', 'HR_HEAD', 'FINANCE_HEAD', 'DIGITAL_MARKETING_HEAD', 'IT_HEAD', 'LOAN_DEMAT_HEAD', 'EXECUTIVE_ASSISTANT', 'ADMIN', 'USER']
  }
  const deptHeadRoles = ['INSURANCE_HEAD', 'PL_HEAD', 'SALES_HEAD', 'HR_HEAD', 'FINANCE_HEAD', 'OUTSTANDING_HEAD', 'DIGITAL_MARKETING_HEAD', 'IT_HEAD', 'LOAN_DEMAT_HEAD']
  if (deptHeadRoles.includes(userRole)) {
    return ['TEAM_LEAD', 'BD', 'USER']
  }
  return []
}

interface AddEmployeeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (result: { created: Array<{ employeeId: string; userId: string; name: string; bdNumber: number | null }> }, syncConfig: Array<{ employeeId: string; syncLeads: boolean; syncAttendance: boolean }>) => void
}

export function AddEmployeeDialog({ open, onOpenChange, onSuccess }: AddEmployeeDialogProps) {
  const { user: currentUser } = useAuth()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [employees, setEmployees] = useState<EmployeeFormData[]>([createEmptyEmployee()])
  const [activeIdx, setActiveIdx] = useState(0)

  const availableRoles = currentUser ? getAvailableRoles(currentUser.role) : []

  const { data: departments } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ['departments'],
    queryFn: () => apiGet<Array<{ id: string; name: string }>>('/api/departments'),
    enabled: open,
  })

  const { data: existingEmployees } = useQuery<Array<{ id: string; employeeCode: string; user: { name: string } }>>({
    queryKey: ['employees'],
    queryFn: () => apiGet<Array<{ id: string; employeeCode: string; user: { name: string } }>>('/api/employees'),
    enabled: open,
  })

  const onboardMutation = useMutation({
    mutationFn: (data: { employees: Array<{ name: string; email: string; password: string; role: string; employeeCode: string; bdNumber?: number | null; departmentId?: string | null; managerId?: string | null; joinDate?: string | null; dateOfBirth?: string | null }> }) =>
      apiPost<{ created: Array<{ employeeId: string; userId: string; name: string; bdNumber: number | null }>; errors: Array<{ index: number; name: string; error: string }>; summary: { total: number; success: number; failed: number } }>('/api/employees/onboard', data),
    onSuccess: (result) => {
      if (result.errors?.length > 0) {
        result.errors.forEach((err) => toast.error(`${err.name}: ${err.error}`))
      }
      if (result.created?.length > 0) {
        toast.success(`${result.created.length} employee(s) created successfully`)
        const syncConfig = result.created.map((created) => {
          const formEmp = employees.find((e) => e.email.toLowerCase().trim() === created.name.toLowerCase() || e.name.trim() === created.name)
          return {
            employeeId: created.employeeId,
            syncLeads: formEmp?.syncLeads ?? false,
            syncAttendance: formEmp?.syncAttendance ?? false,
          }
        })
        onSuccess(result, syncConfig)
        resetAndClose()
      } else if (!result.errors?.length) {
        toast.error('No employees were created')
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create employees')
    },
  })

  const resetAndClose = useCallback(() => {
    setStep(1)
    setEmployees([createEmptyEmployee()])
    setActiveIdx(0)
    onOpenChange(false)
  }, [onOpenChange])

  const updateEmployee = (idx: number, updates: Partial<EmployeeFormData>) => {
    setEmployees((prev) => prev.map((e, i) => (i === idx ? { ...e, ...updates } : e)))
  }

  const addEmployee = () => {
    setEmployees((prev) => [...prev, createEmptyEmployee()])
    setActiveIdx(employees.length)
  }

  const removeEmployee = (idx: number) => {
    if (employees.length <= 1) return
    setEmployees((prev) => prev.filter((_, i) => i !== idx))
    if (activeIdx >= idx && activeIdx > 0) setActiveIdx(activeIdx - 1)
  }

  const isStep1Valid = () => {
    return employees.every((e) => e.name && e.email && e.password && e.employeeCode && e.role)
  }

  const hasSyncableEmployees = employees.some((e) => e.bdNumber.trim())

  const handleSubmit = () => {
    const payload = employees.map((e) => ({
      name: e.name.trim(),
      email: e.email.trim().toLowerCase(),
      password: e.password,
      role: e.role,
      employeeCode: e.employeeCode.trim(),
      bdNumber: e.bdNumber.trim() ? parseInt(e.bdNumber, 10) : null,
      departmentId: e.departmentId || null,
      managerId: e.managerId || null,
      joinDate: e.joinDate || null,
      dateOfBirth: e.dateOfBirth || null,
    }))
    onboardMutation.mutate({ employees: payload })
  }

  const emp = employees[activeIdx]

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetAndClose(); else onOpenChange(o) }}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Add Employee{employees.length > 1 ? 's' : ''}
          </DialogTitle>
          <DialogDescription>
            {step === 1 && 'Enter employee details. You can add multiple employees.'}
            {step === 2 && 'Configure data sync for employees with CRM numbers.'}
            {step === 3 && 'Review and confirm employee creation.'}
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2 px-1 pb-2">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className={cn(
                'h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium shrink-0 transition-colors',
                step === s ? 'bg-primary text-primary-foreground' : step > s ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
              )}>
                {step > s ? <Check className="h-4 w-4" /> : s}
              </div>
              <span className={cn('text-sm hidden sm:block', step === s ? 'font-medium' : 'text-muted-foreground')}>
                {s === 1 ? 'Details' : s === 2 ? 'Sync' : 'Review'}
              </span>
              {s < 3 && <div className={cn('flex-1 h-px', step > s ? 'bg-primary/30' : 'bg-border')} />}
            </div>
          ))}
        </div>

        <ScrollArea className="flex-1 min-h-0 pr-3">
          {/* Step 1: Employee Details */}
          {step === 1 && (
            <div className="space-y-4">
              {employees.length > 1 && (
                <div className="flex flex-wrap gap-1.5">
                  {employees.map((e, idx) => (
                    <Badge
                      key={e.id}
                      variant={idx === activeIdx ? 'default' : 'outline'}
                      className="cursor-pointer gap-1"
                      onClick={() => setActiveIdx(idx)}
                    >
                      {e.name || `Employee ${idx + 1}`}
                      {employees.length > 1 && (
                        <button
                          onClick={(ev) => { ev.stopPropagation(); removeEmployee(idx) }}
                          className="ml-0.5 hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </Badge>
                  ))}
                </div>
              )}

              {emp && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Name *</Label>
                      <Input value={emp.name} onChange={(e) => updateEmployee(activeIdx, { name: e.target.value })} placeholder="Full name" required />
                    </div>
                    <div>
                      <Label>Email *</Label>
                      <Input type="email" value={emp.email} onChange={(e) => updateEmployee(activeIdx, { email: e.target.value.toLowerCase().trim() })} placeholder="email@company.com" required />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Password *</Label>
                      <Input type="password" value={emp.password} onChange={(e) => updateEmployee(activeIdx, { password: e.target.value })} placeholder="Min 6 characters" minLength={6} required />
                    </div>
                    <div>
                      <Label>Employee Code *</Label>
                      <Input value={emp.employeeCode} onChange={(e) => updateEmployee(activeIdx, { employeeCode: e.target.value })} placeholder="e.g. EMP001" required />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Role *</Label>
                      <Select value={emp.role} onValueChange={(v) => updateEmployee(activeIdx, { role: v as UserRole })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {availableRoles.map((role) => (
                            <SelectItem key={role} value={role}>{ROLE_LABELS[role] || role}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>CRM Number</Label>
                      <Input type="number" min={1} step={1} value={emp.bdNumber} onChange={(e) => updateEmployee(activeIdx, { bdNumber: e.target.value })} placeholder="For lead sync (BDM number)" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Department</Label>
                      <Select value={emp.departmentId || 'none'} onValueChange={(v) => updateEmployee(activeIdx, { departmentId: v === 'none' ? '' : v })}>
                        <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No Department</SelectItem>
                          {departments?.map((dept) => (
                            <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Manager</Label>
                      <Select value={emp.managerId || 'none'} onValueChange={(v) => updateEmployee(activeIdx, { managerId: v === 'none' ? '' : v })}>
                        <SelectTrigger><SelectValue placeholder="No manager" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No manager</SelectItem>
                          {existingEmployees?.map((e) => (
                            <SelectItem key={e.id} value={e.id}>{e.user.name} ({e.employeeCode})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Join Date</Label>
                      <Input type="date" value={emp.joinDate} onChange={(e) => updateEmployee(activeIdx, { joinDate: e.target.value })} />
                    </div>
                    <div>
                      <Label>Birthday</Label>
                      <Input type="date" value={emp.dateOfBirth} onChange={(e) => updateEmployee(activeIdx, { dateOfBirth: e.target.value })} />
                    </div>
                  </div>
                </div>
              )}

              <Button type="button" variant="outline" size="sm" onClick={addEmployee} className="gap-1.5">
                <Plus className="h-4 w-4" /> Add Another Employee
              </Button>
            </div>
          )}

          {/* Step 2: Sync Configuration */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/30 p-3">
                <div className="flex items-center gap-2 text-sm">
                  <RefreshCw className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    Sync historical data for employees. Leads sync from <strong>Jan 2025</strong>, attendance from <strong>Jan 2026</strong>.
                  </span>
                </div>
              </div>

              {employees.map((emp, idx) => {
                const hasBd = emp.bdNumber.trim() !== ''
                return (
                  <div key={emp.id} className="rounded-lg border p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{emp.name || `Employee ${idx + 1}`}</p>
                        <p className="text-xs text-muted-foreground">{emp.employeeCode} {hasBd ? `| CRM #${emp.bdNumber}` : '| No CRM number'}</p>
                      </div>
                      <Badge variant="outline">{ROLE_LABELS[emp.role] || emp.role}</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center justify-between rounded-md border p-3">
                        <div>
                          <p className="text-sm font-medium">Sync Leads</p>
                          <p className="text-xs text-muted-foreground">{hasBd ? 'From Jan 2025' : 'Requires CRM number'}</p>
                        </div>
                        <Switch
                          checked={emp.syncLeads}
                          onCheckedChange={(v) => updateEmployee(idx, { syncLeads: v })}
                          disabled={!hasBd}
                        />
                      </div>
                      <div className="flex items-center justify-between rounded-md border p-3">
                        <div>
                          <p className="text-sm font-medium">Sync Attendance</p>
                          <p className="text-xs text-muted-foreground">From Jan 2026</p>
                        </div>
                        <Switch
                          checked={emp.syncAttendance}
                          onCheckedChange={(v) => updateEmployee(idx, { syncAttendance: v })}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Step 3: Review & Confirm */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>CRM #</TableHead>
                      <TableHead>Sync</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {employees.map((emp, idx) => (
                      <TableRow key={emp.id}>
                        <TableCell className="font-medium">{emp.name}</TableCell>
                        <TableCell className="text-sm">{emp.email}</TableCell>
                        <TableCell><Badge variant="secondary">{ROLE_LABELS[emp.role] || emp.role}</Badge></TableCell>
                        <TableCell className="font-mono text-sm">{emp.employeeCode}</TableCell>
                        <TableCell>{emp.bdNumber || '-'}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {emp.syncLeads && <Badge variant="outline" className="text-xs">Leads</Badge>}
                            {emp.syncAttendance && <Badge variant="outline" className="text-xs">Attendance</Badge>}
                            {!emp.syncLeads && !emp.syncAttendance && <span className="text-muted-foreground text-xs">None</span>}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="rounded-lg border bg-amber-50/50 dark:bg-amber-950/20 p-3">
                <p className="text-sm text-amber-800 dark:text-amber-300">
                  <strong>Note:</strong> Finance team will be notified to set up payroll structures for new employees.
                </p>
              </div>
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="flex items-center justify-between border-t pt-4 mt-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            {employees.length} employee{employees.length > 1 ? 's' : ''}
          </div>
          <div className="flex gap-2">
            {step > 1 && (
              <Button variant="outline" onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Back
              </Button>
            )}
            {step === 1 && (
              <Button onClick={() => setStep(2)} disabled={!isStep1Valid()}>
                Next <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            )}
            {step === 2 && (
              <Button onClick={() => setStep(3)}>
                Review <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            )}
            {step === 3 && (
              <Button onClick={handleSubmit} disabled={onboardMutation.isPending}>
                {onboardMutation.isPending ? 'Creating...' : `Create ${employees.length > 1 ? `${employees.length} Employees` : 'Employee'}`}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
