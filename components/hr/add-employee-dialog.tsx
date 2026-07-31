'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useMutation, useQuery } from '@tanstack/react-query'
import { apiGet, apiPost } from '@/lib/api-client'
import { useAuth } from '@/hooks/use-auth'
import { toast } from 'sonner'
import { Plus, Trash2, ArrowRight, ArrowLeft, Check, Users, UserPlus, X, Mail } from 'lucide-react'
import { cn } from '@/lib/utils'
import { type UserRole } from '@/generated/prisma/enums'
import { getAvailableRolesForCreator } from '@/lib/rbac'
import { getRoleLabel } from '@/lib/roles'
import { Checkbox } from '@/components/ui/checkbox'
import { getOnboardingDocLabels, type ExperienceType } from '@/lib/onboarding-docs'

type ManagerOption = {
  id: string
  employeeCode: string
  user: { name: string }
}

function managerLabel(employee: ManagerOption) {
  return `${employee.user.name} (${employee.employeeCode})`
}

const ADD_EMPLOYEE_ROLE_ORDER: UserRole[] = [
  'SALES_HEAD',
  'CATEGORY_MANAGER',
  'ASSISTANT_CATEGORY_MANAGER',
  'TEAM_LEAD',
  'BD',
  'INSURANCE_HEAD',
  'PL_HEAD',
  'OUTSTANDING_HEAD',
  'HR_HEAD',
  'FINANCE_HEAD',
  'DIGITAL_MARKETING_HEAD',
  'IT_HEAD',
  'LOAN_DEMAT_HEAD',
  'EXECUTIVE_ASSISTANT',
  'ADMIN',
  'USER',
]

interface EmployeeFormData {
  id: string
  name: string
  email: string
  personalEmail: string
  password: string
  role: UserRole
  employeeCode: string
  experienceType: ExperienceType
  bdNumber: string
  circle: string
  departmentId: string
  managerId: string
  joinDate: string
  dateOfBirth: string
}

interface CircleOption {
  id: string
  name: string
  isActive: boolean
}

/** Works on HTTP (non-secure) contexts where crypto.randomUUID is unavailable. */
function createClientId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

function createEmptyEmployee(): EmployeeFormData {
  return {
    id: createClientId(),
    name: '',
    email: '',
    personalEmail: '',
    password: '',
    role: 'BD',
    employeeCode: '',
    experienceType: 'FRESHER',
    bdNumber: '',
    circle: '',
    departmentId: '',
    managerId: '',
    joinDate: '',
    dateOfBirth: '',
  }
}

function getAvailableRoles(userRole: string): UserRole[] {
  const allowed = new Set(
    getAvailableRolesForCreator(
      userRole ? ({ id: '', email: '', name: '', role: userRole as UserRole }) : null
    )
  )
  return ADD_EMPLOYEE_ROLE_ORDER.filter((role) => allowed.has(role))
}

export interface OnboardResult {
  created: Array<{
    employeeId: string
    userId: string
    name: string
    email: string
    personalEmail?: string
    employeeCode: string
    bdNumber: number | null
    experienceType?: ExperienceType
    inviteEmailSent?: boolean
    inviteEmailError?: string
  }>
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
  const [managerSearch, setManagerSearch] = useState('')
  const [sendInviteEmail, setSendInviteEmail] = useState(true)

  const availableRoles = currentUser ? getAvailableRoles(currentUser.role) : []

  const { data: departments } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ['departments'],
    queryFn: () => apiGet<Array<{ id: string; name: string }>>('/api/departments'),
    enabled: open,
  })

  const { data: existingEmployees } = useQuery<ManagerOption[]>({
    queryKey: ['employees'],
    queryFn: () => apiGet<ManagerOption[]>('/api/employees'),
    enabled: open,
  })

  const { data: employeeMeta } = useQuery<{ circles: CircleOption[] }>({
    queryKey: ['employee-meta'],
    queryFn: () => apiGet<{ circles: CircleOption[] }>('/api/employees/meta'),
    enabled: open,
  })

  // Snapshot of form data at submission time — used to map sync config back after creation
  const [submittedEmployees, setSubmittedEmployees] = useState<EmployeeFormData[]>([])
  const circleOptions = employeeMeta?.circles ?? []

  const onboardMutation = useMutation({
    mutationFn: (data: {
      employees: Array<{
        name: string
        email: string
        personalEmail: string
        password: string
        role: string
        employeeCode: string
        experienceType: ExperienceType
        bdNumber?: number | null
        circle?: string | null
        departmentId?: string | null
        managerId?: string | null
        joinDate?: string | null
        dateOfBirth?: string | null
      }>
      sendInviteEmail: boolean
    }) => apiPost<OnboardResult>('/api/employees/onboard', data),
    onSuccess: (result) => {
      if (result.errors?.length > 0) {
        result.errors.forEach((err) => toast.error(`${err.name}: ${err.error}`))
      }

      if (result.created?.length > 0) {
        toast.success(`${result.created.length} employee${result.created.length > 1 ? 's' : ''} created`)

        const emailed = result.created.filter((c) => c.inviteEmailSent)
        const emailFailed = result.created.filter((c) => c.inviteEmailSent === false)
        if (emailed.length > 0) {
          toast.success(
            emailed.length === 1
              ? `Welcome email sent to ${emailed[0].personalEmail || emailed[0].email}`
              : `Welcome emails sent to ${emailed.length} personal addresses`
          )
        }
        emailFailed.forEach((c) => {
          toast.error(`${c.name}: invite email failed${c.inviteEmailError ? ` — ${c.inviteEmailError}` : ''}`)
        })

        // Match each created employee back to the form data by employeeCode (unique, used for attendance sync)
        // bdNumber from the response tells us if lead sync is possible
        const formByCode = new Map(submittedEmployees.map((e) => [e.employeeCode.trim().toLowerCase(), e]))
        const syncConfig = result.created.map((created) => {
          const formEmp = formByCode.get(created.employeeCode.toLowerCase())
          return {
            employeeId: created.employeeId,
            // Auto sync leads if CRM number was provided
            syncLeads: created.bdNumber !== null && !!formEmp?.bdNumber.trim(),
            // Auto sync attendance if employee code was provided (always true here since it's required)
            syncAttendance: !!formEmp?.employeeCode.trim(),
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
    setManagerSearch('')
    setSendInviteEmail(true)
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
    employees.every(
      (e) =>
        e.name.trim() &&
        e.email.trim() &&
        e.personalEmail.trim() &&
        e.password &&
        e.employeeCode.trim() &&
        e.role &&
        e.experienceType
    )

  const handleCreate = () => {
    setSubmittedEmployees([...employees])
    const payload = employees.map((e) => ({
      name: e.name.trim(),
      email: e.email.trim().toLowerCase(),
      personalEmail: e.personalEmail.trim().toLowerCase(),
      password: e.password,
      role: e.role,
      employeeCode: e.employeeCode.trim(),
      experienceType: e.experienceType,
      bdNumber: e.bdNumber.trim() ? parseInt(e.bdNumber, 10) : null,
      circle: e.circle.trim() || null,
      departmentId: e.departmentId || null,
      managerId: e.managerId || null,
      joinDate: e.joinDate || null,
      dateOfBirth: e.dateOfBirth || null,
    }))
    onboardMutation.mutate({ employees: payload, sendInviteEmail })
  }

  const emp = employees[activeIdx]

  const selectedManager = useMemo(
    () => existingEmployees?.find((e) => e.id === emp?.managerId) ?? null,
    [existingEmployees, emp?.managerId]
  )

  const filteredManagers = useMemo(() => {
    const list = existingEmployees ?? []
    const q = managerSearch.trim().toLowerCase()
    if (!q) return list
    // Show full list when the input is just the selected label (dropdown open / idle)
    if (selectedManager && q === managerLabel(selectedManager).toLowerCase()) return list
    return list.filter(
      (e) =>
        e.user.name.toLowerCase().includes(q) ||
        e.employeeCode.toLowerCase().includes(q)
    )
  }, [existingEmployees, managerSearch, selectedManager])

  // Keep the combobox input in sync when switching employee tabs or changing selection
  useEffect(() => {
    const selected = existingEmployees?.find((e) => e.id === emp?.managerId)
    setManagerSearch(selected ? managerLabel(selected) : '')
  }, [activeIdx, emp?.managerId, existingEmployees])

  // Lock body scroll while open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex min-h-0 min-w-0 flex-col overflow-x-hidden bg-background">
      {/* Top bar */}
      <div className="relative flex shrink-0 flex-col gap-3 border-b border-primary/10 bg-gradient-to-r from-sky-600/12 via-background to-violet-600/12 px-4 py-3 dark:from-sky-500/20 dark:to-violet-500/20 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-4">
        <div className="flex min-w-0 items-start gap-3 pr-8 sm:pr-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-600 text-white shadow-sm dark:bg-sky-500">
            <UserPlus className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-semibold leading-tight text-sky-950 dark:text-sky-100 sm:text-lg">
              Add Employee{employees.length > 1 ? 's' : ''}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
              {step === 1 ? 'Fill in employee details. Click "Add Another" to onboard multiple at once.' : 'Review before creating. Sync will start automatically after.'}
            </p>
          </div>
        </div>
        <button
          onClick={handleClose}
          disabled={onboardMutation.isPending}
          className="absolute right-3 top-3 rounded-md p-1.5 text-muted-foreground opacity-90 ring-offset-background hover:bg-muted hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none sm:static sm:right-auto sm:top-auto sm:p-0"
        >
          <X className="h-5 w-5" />
          <span className="sr-only">Close</span>
        </button>
      </div>

      {/* Step indicator */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-sky-200/40 bg-sky-50/40 px-4 py-2.5 dark:border-sky-900/40 dark:bg-sky-950/20 sm:gap-3 sm:px-6 sm:py-3">
        {[1, 2].map((s) => (
          <div key={s} className="flex min-w-0 items-center gap-2">
            <div className={cn(
              'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors',
              step === s ? 'bg-sky-600 text-white shadow-sm dark:bg-sky-500' : step > s ? 'bg-sky-200 text-sky-900 dark:bg-sky-800 dark:text-sky-100' : 'bg-muted text-muted-foreground'
            )}>
              {step > s ? <Check className="h-3.5 w-3.5" /> : s}
            </div>
            <span className={cn('truncate text-xs sm:text-sm', step === s ? 'font-medium text-sky-950 dark:text-sky-100' : 'text-muted-foreground')}>
              {s === 1 ? 'Details' : 'Review & Create'}
            </span>
            {s < 2 && <div className={cn('mx-1 hidden h-px w-8 shrink-0 sm:block', step > s ? 'bg-sky-400/50' : 'bg-border')} />}
          </div>
        ))}
      </div>

      {/* Scrollable body */}
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain">
        <div className="mx-auto w-full max-w-2xl min-w-0 px-4 py-6 sm:px-6 sm:py-8">

          {/* ─── Step 1: Details ─── */}
          {step === 1 && (
            <div className="space-y-6">
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
                <div className="space-y-5">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
                    <div className="space-y-1.5">
                      <Label>Name *</Label>
                      <Input value={emp.name} onChange={(e) => updateEmployee(activeIdx, { name: e.target.value })} placeholder="Full name" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Experience *</Label>
                      <Select
                        value={emp.experienceType}
                        onValueChange={(v) =>
                          updateEmployee(activeIdx, { experienceType: v as ExperienceType })
                        }
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="FRESHER">Fresher</SelectItem>
                          <SelectItem value="EXPERIENCED">Experienced</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Controls which documents they must upload during onboarding.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
                    <div className="space-y-1.5">
                      <Label>Login email (username) *</Label>
                      <Input
                        type="email"
                        value={emp.email}
                        onChange={(e) => updateEmployee(activeIdx, { email: e.target.value.toLowerCase().trim() })}
                        placeholder="login@example.com"
                        autoComplete="off"
                      />
                      <p className="text-xs text-muted-foreground">
                        Used to sign in to Mediend Workspace.
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Personal email *</Label>
                      <Input
                        type="email"
                        value={emp.personalEmail}
                        onChange={(e) =>
                          updateEmployee(activeIdx, { personalEmail: e.target.value.toLowerCase().trim() })
                        }
                        placeholder="name@gmail.com"
                        autoComplete="off"
                      />
                      <p className="text-xs text-muted-foreground">
                        Welcome email with login credentials & portal link is sent here (personal Gmail is fine).
                      </p>
                    </div>
                  </div>

                  <div className="rounded-lg border bg-muted/30 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Documents for {emp.experienceType === 'EXPERIENCED' ? 'experienced' : 'fresher'} onboarding
                    </p>
                    <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                      {getOnboardingDocLabels(emp.experienceType).map((label) => (
                        <li key={label} className="text-sm text-foreground/90 flex items-start gap-1.5">
                          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-600" />
                          {label}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
                    <div className="space-y-1.5">
                      <Label>Temporary password *</Label>
                      <Input type="password" value={emp.password} onChange={(e) => updateEmployee(activeIdx, { password: e.target.value })} placeholder="Min 6 characters" minLength={6} />
                      <p className="text-xs text-muted-foreground">Included in the welcome email — ask them to change it after login.</p>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Employee Code *</Label>
                      <Input value={emp.employeeCode} onChange={(e) => updateEmployee(activeIdx, { employeeCode: e.target.value })} placeholder="e.g. 2578" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
                    <div className="space-y-1.5">
                      <Label>Role *</Label>
                      <Select value={emp.role} onValueChange={(v) => updateEmployee(activeIdx, { role: v as UserRole })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {availableRoles.map((role) => (
                            <SelectItem key={role} value={role}>{getRoleLabel(role)}</SelectItem>
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

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
                    <div className="space-y-1.5">
                      <Label>Circle</Label>
                      <Select
                        value={emp.circle || 'none'}
                        onValueChange={(value) =>
                          updateEmployee(activeIdx, { circle: value === 'none' ? '' : value })
                        }
                      >
                        <SelectTrigger><SelectValue placeholder="Select circle" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No circle</SelectItem>
                          {circleOptions.map((circle) => (
                            <SelectItem key={circle.id} value={circle.name}>
                              {circle.name}{!circle.isActive ? ' (Inactive)' : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Used by CRM auto-assignment to match lead city for BD employees.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
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
                      <Combobox<ManagerOption>
                        items={filteredManagers}
                        value={selectedManager}
                        onValueChange={(manager) =>
                          updateEmployee(activeIdx, { managerId: manager?.id ?? '' })
                        }
                        itemToStringLabel={managerLabel}
                        isItemEqualToValue={(a, b) => a?.id === b?.id}
                        inputValue={managerSearch}
                        onInputValueChange={setManagerSearch}
                      >
                        <ComboboxInput
                          placeholder="Search manager by name or code"
                          showClear
                          className="w-full"
                        />
                        <ComboboxContent>
                          <ComboboxEmpty>No managers found.</ComboboxEmpty>
                          <ComboboxList>
                            {(manager: ManagerOption) => (
                              <ComboboxItem key={manager.id} value={manager}>
                                <div className="min-w-0">
                                  <div className="truncate font-medium">{manager.user.name}</div>
                                  <div className="truncate text-xs opacity-80">{manager.employeeCode}</div>
                                </div>
                              </ComboboxItem>
                            )}
                          </ComboboxList>
                        </ComboboxContent>
                      </Combobox>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
                    <div className="space-y-1.5">
                      <Label>Join Date</Label>
                      <Input type="date" value={emp.joinDate} onChange={(e) => updateEmployee(activeIdx, { joinDate: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
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

          {/* ─── Step 2: Review ─── */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="-mx-1 min-w-0 overflow-x-auto rounded-lg border border-violet-200/70 bg-violet-50/30 dark:border-violet-900/50 dark:bg-violet-950/20 sm:mx-0">
                <Table className="min-w-[900px] w-full">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Login</TableHead>
                      <TableHead>Personal email</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>CRM #</TableHead>
                      <TableHead>Auto-sync</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {employees.map((emp) => (
                      <TableRow key={emp.id}>
                        <TableCell className="font-medium">{emp.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{emp.email}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{emp.personalEmail}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {emp.experienceType === 'EXPERIENCED' ? 'Experienced' : 'Fresher'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">{getRoleLabel(emp.role)}</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{emp.employeeCode}</TableCell>
                        <TableCell>{emp.bdNumber || <span className="text-muted-foreground">—</span>}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {emp.bdNumber.trim() && <Badge variant="outline" className="text-xs border-blue-300 text-blue-700">Leads</Badge>}
                            <Badge variant="outline" className="text-xs border-violet-300 text-violet-700">Attendance</Badge>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <label className="flex items-start gap-3 rounded-lg border border-sky-200 bg-sky-50/60 p-3 dark:border-sky-800 dark:bg-sky-950/20 cursor-pointer">
                <Checkbox
                  checked={sendInviteEmail}
                  onCheckedChange={(v) => setSendInviteEmail(v === true)}
                  className="mt-0.5"
                />
                <span className="text-sm text-sky-900 dark:text-sky-200">
                  <span className="font-medium inline-flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5" />
                    Send welcome email to personal email
                  </span>
                  <span className="mt-1 block text-sky-800/90 dark:text-sky-300/90">
                    Sends login username, temporary password, portal link, password-change steps, and the
                    fresher/experienced document checklist from HR to each personal email.
                  </span>
                </span>
              </label>

              <div className="rounded-lg border border-violet-200 bg-violet-50/60 dark:bg-violet-950/20 dark:border-violet-800 p-3 text-sm text-violet-800 dark:text-violet-300">
                New employees start in onboarding. They must complete their profile and wait for HR approval before full access is unlocked.
              </div>

              <div className="rounded-lg border border-amber-200 bg-amber-50/60 dark:bg-amber-950/20 dark:border-amber-800 p-3 text-sm text-amber-800 dark:text-amber-300">
                Finance will be notified to set up payroll for {employees.length === 1 ? 'this employee' : 'these employees'}.
              </div>

              <div className="rounded-lg border border-blue-200 bg-blue-50/60 dark:bg-blue-950/20 dark:border-blue-800 p-3 text-sm text-blue-800 dark:text-blue-300">
                Historical sync will run automatically after creation — attendance for all employees, leads for those with a CRM number. Do not close or refresh your browser while syncing.
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Footer */}
      <div className="flex shrink-0 flex-col gap-3 border-t border-sky-200/40 bg-muted/30 px-4 py-3 dark:border-sky-900/40 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="h-4 w-4 text-sky-600 dark:text-sky-400" />
          {employees.length} employee{employees.length > 1 ? 's' : ''}
        </div>
        <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row">
          {step === 2 && (
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => setStep(1)} disabled={onboardMutation.isPending}>
              <ArrowLeft className="mr-1 h-4 w-4" /> Back
            </Button>
          )}
          {step === 1 && (
            <Button className="w-full bg-sky-600 text-white hover:bg-sky-700 sm:w-auto" onClick={() => setStep(2)} disabled={!isStep1Valid()}>
              Review <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          )}
          {step === 2 && (
            <Button className="w-full bg-violet-600 text-white hover:bg-violet-700 sm:w-auto" onClick={handleCreate} disabled={onboardMutation.isPending}>
              {onboardMutation.isPending
                ? <><span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent inline-block" />Creating...</>
                : `Create ${employees.length > 1 ? `${employees.length} Employees` : 'Employee'}`
              }
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
