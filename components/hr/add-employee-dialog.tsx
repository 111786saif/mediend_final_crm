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
import { Separator } from '@/components/ui/separator'
import { useMutation, useQuery } from '@tanstack/react-query'
import { apiGet, apiPost } from '@/lib/api-client'
import { useAuth } from '@/hooks/use-auth'
import { toast } from 'sonner'
import { Plus, Trash2, ArrowRight, ArrowLeft, Check, Users, UserPlus } from 'lucide-react'
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

export interface OnboardResult {
  created: Array<{ employeeId: string; userId: string; name: string; email: string; employeeCode: string; bdNumber: number | null }>
  errors: Array<{ index: number; name: string; error: string }>
}

interface AddEmployeeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Called after successful creation with the created employees and their sync settings */
  onSuccess: (result: OnboardResult, syncConfig: Array<{ employeeId: string; syncLeads: boolean; syncAttendance: boolean }>) => void
}

export function AddEmployeeDialog({ open, onOpenChange, onSuccess }: AddEmployeeDialogProps) {
  const { user: currentUser } = useAuth()
  const [step, setStep] = useState<1 | 2>(1)
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

  // Snapshot of form data at submission time — used to map sync config back after creation
  const [submittedEmployees, setSubmittedEmployees] = useState<EmployeeFormData[]>([])

  const onboardMutation = useMutation({
    mutationFn: (data: { employees: Array<{ name: string; email: string; password: string; role: string; employeeCode: string; bdNumber?: number | null; departmentId?: string | null; managerId?: string | null; joinDate?: string | null; dateOfBirth?: string | null }> }) =>
      apiPost<OnboardResult>('/api/employees/onboard', data),
    onSuccess: (result) => {
      if (result.errors?.length > 0) {
        result.errors.forEach((err) => toast.error(`${err.name}: ${err.error}`))
      }

      if (result.created?.length > 0) {
        toast.success(`${result.created.length} employee${result.created.length > 1 ? 's' : ''} created`)

        // Match each created employee back to the form data by employeeCode (unique, used for attendance sync)
        // bdNumber from the response tells us if lead sync is possible
        const formByCode = new Map(submittedEmployees.map((e) => [e.employeeCode.trim().toLowerCase(), e]))
        const syncConfig = result.created.map((created) => {
          const formEmp = formByCode.get(created.employeeCode.toLowerCase())
          return {
            employeeId: created.employeeId,
            // Lead sync: form flag + bd number must actually exist on the created employee
            syncLeads: (formEmp?.syncLeads ?? false) && created.bdNumber !== null,
            // Attendance sync: form flag, driven by employeeCode
            syncAttendance: formEmp?.syncAttendance ?? false,
          }
        })

        onSuccess(result, syncConfig)
        resetForm()
        onOpenChange(false)
      } else if (!result.errors?.length) {
        toast.error('No employees were created')
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create employees')
    },
  })

  const resetForm = useCallback(() => {
    setStep(1)
    setEmployees([createEmptyEmployee()])
    setActiveIdx(0)
    setSubmittedEmployees([])
  }, [])

  const handleClose = useCallback(() => {
    if (!onboardMutation.isPending) {
      resetForm()
      onOpenChange(false)
    }
  }, [onboardMutation.isPending, resetForm, onOpenChange])

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
    setActiveIdx((prev) => (prev >= idx && prev > 0 ? prev - 1 : prev))
  }

  const isStep1Valid = () =>
    employees.every((e) => e.name.trim() && e.email.trim() && e.password && e.employeeCode.trim() && e.role)

  const handleCreate = () => {
    setSubmittedEmployees([...employees])
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
  const hasBd = emp?.bdNumber.trim() !== ''

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Add Employee{employees.length > 1 ? 's' : ''}
          </DialogTitle>
          <DialogDescription>
            {step === 1 ? 'Fill in employee details. Click "Add Another" to onboard multiple at once.' : 'Review before creating. Sync will start automatically after.'}
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-3 px-1 pb-1">
          {[1, 2].map((s) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className={cn(
                'h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 transition-colors',
                step === s ? 'bg-primary text-primary-foreground' : step > s ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
              )}>
                {step > s ? <Check className="h-3.5 w-3.5" /> : s}
              </div>
              <span className={cn('text-sm', step === s ? 'font-medium' : 'text-muted-foreground')}>
                {s === 1 ? 'Details' : 'Review & Create'}
              </span>
              {s < 2 && <div className={cn('flex-1 h-px', step > s ? 'bg-primary/30' : 'bg-border')} />}
            </div>
          ))}
        </div>

        <ScrollArea className="flex-1 min-h-0 pr-1">
          {/* ─── Step 1: Details ─── */}
          {step === 1 && (
            <div className="space-y-5 py-1">
              {/* Employee tabs when multiple */}
              {employees.length > 1 && (
                <div className="flex flex-wrap gap-1.5">
                  {employees.map((e, idx) => (
                    <Badge
                      key={e.id}
                      variant={idx === activeIdx ? 'default' : 'outline'}
                      className="cursor-pointer gap-1.5 pr-1"
                      onClick={() => setActiveIdx(idx)}
                    >
                      {e.name || `Employee ${idx + 1}`}
                      <button
                        onClick={(ev) => { ev.stopPropagation(); removeEmployee(idx) }}
                        className="hover:text-destructive rounded-sm"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}

              {emp && (
                <div className="space-y-4">
                  {/* Core identity */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Name *</Label>
                      <Input value={emp.name} onChange={(e) => updateEmployee(activeIdx, { name: e.target.value })} placeholder="Full name" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Email *</Label>
                      <Input type="email" value={emp.email} onChange={(e) => updateEmployee(activeIdx, { email: e.target.value.toLowerCase().trim() })} placeholder="email@company.com" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Password *</Label>
                      <Input type="password" value={emp.password} onChange={(e) => updateEmployee(activeIdx, { password: e.target.value })} placeholder="Min 6 characters" minLength={6} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Employee Code *</Label>
                      <Input value={emp.employeeCode} onChange={(e) => updateEmployee(activeIdx, { employeeCode: e.target.value })} placeholder="e.g. EMP001" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
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
                    <div className="space-y-1.5">
                      <Label>CRM Number</Label>
                      <Input
                        type="number"
                        min={1}
                        step={1}
                        value={emp.bdNumber}
                        onChange={(e) => updateEmployee(activeIdx, { bdNumber: e.target.value })}
                        placeholder="For lead sync"
                      />
                      <p className="text-xs text-muted-foreground">Required to sync historical leads</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
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
                    <div className="space-y-1.5">
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
                    <div className="space-y-1.5">
                      <Label>Join Date</Label>
                      <Input type="date" value={emp.joinDate} onChange={(e) => updateEmployee(activeIdx, { joinDate: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Birthday</Label>
                      <Input type="date" value={emp.dateOfBirth} onChange={(e) => updateEmployee(activeIdx, { dateOfBirth: e.target.value })} />
                    </div>
                  </div>

                  {/* Sync toggles — part of the employee form, not a separate step */}
                  <Separator />
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Historical sync (runs after creation)</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className={cn(
                        'flex items-center justify-between rounded-lg border p-3 transition-colors',
                        hasBd ? 'bg-card' : 'bg-muted/40 opacity-60'
                      )}>
                        <div>
                          <p className="text-sm font-medium">Sync Leads</p>
                          <p className="text-xs text-muted-foreground">{hasBd ? 'From Jan 2025' : 'Needs CRM number'}</p>
                        </div>
                        <Switch
                          checked={emp.syncLeads}
                          onCheckedChange={(v) => updateEmployee(activeIdx, { syncLeads: v })}
                          disabled={!hasBd}
                        />
                      </div>
                      <div className="flex items-center justify-between rounded-lg border bg-card p-3">
                        <div>
                          <p className="text-sm font-medium">Sync Attendance</p>
                          <p className="text-xs text-muted-foreground">From Jan 2026</p>
                        </div>
                        <Switch
                          checked={emp.syncAttendance}
                          onCheckedChange={(v) => updateEmployee(activeIdx, { syncAttendance: v })}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <Button type="button" variant="outline" size="sm" onClick={addEmployee} className="gap-1.5 mt-2">
                <Plus className="h-4 w-4" /> Add Another Employee
              </Button>
            </div>
          )}

          {/* ─── Step 2: Review ─── */}
          {step === 2 && (
            <div className="space-y-4 py-1">
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>CRM #</TableHead>
                      <TableHead>Sync after create</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {employees.map((emp) => (
                      <TableRow key={emp.id}>
                        <TableCell className="font-medium">{emp.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{emp.email}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">{ROLE_LABELS[emp.role] || emp.role}</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{emp.employeeCode}</TableCell>
                        <TableCell>{emp.bdNumber || <span className="text-muted-foreground">—</span>}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {emp.syncLeads && <Badge variant="outline" className="text-xs border-blue-300 text-blue-700">Leads</Badge>}
                            {emp.syncAttendance && <Badge variant="outline" className="text-xs border-violet-300 text-violet-700">Attendance</Badge>}
                            {!emp.syncLeads && !emp.syncAttendance && <span className="text-xs text-muted-foreground">None</span>}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="rounded-lg border border-amber-200 bg-amber-50/60 dark:bg-amber-950/20 dark:border-amber-800 p-3 text-sm text-amber-800 dark:text-amber-300">
                Finance will be notified to set up payroll for {employees.length === 1 ? 'this employee' : 'these employees'}.
              </div>

              {employees.some((e) => e.syncLeads || e.syncAttendance) && (
                <div className="rounded-lg border border-blue-200 bg-blue-50/60 dark:bg-blue-950/20 dark:border-blue-800 p-3 text-sm text-blue-800 dark:text-blue-300">
                  A sync progress window will open automatically after creation. Do not close or refresh your browser while syncing.
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="flex items-center justify-between border-t pt-4 mt-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            {employees.length} employee{employees.length > 1 ? 's' : ''}
          </div>
          <div className="flex gap-2">
            {step === 2 && (
              <Button variant="outline" onClick={() => setStep(1)} disabled={onboardMutation.isPending}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Back
              </Button>
            )}
            {step === 1 && (
              <Button onClick={() => setStep(2)} disabled={!isStep1Valid()}>
                Review <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            )}
            {step === 2 && (
              <Button onClick={handleCreate} disabled={onboardMutation.isPending}>
                {onboardMutation.isPending
                  ? <><span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent inline-block" />Creating...</>
                  : `Create ${employees.length > 1 ? `${employees.length} Employees` : 'Employee'}`
                }
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
