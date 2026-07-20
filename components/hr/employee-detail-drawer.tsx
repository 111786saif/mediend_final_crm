'use client'

import { useQuery } from '@tanstack/react-query'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { apiGet } from '@/lib/api-client'
import { format } from 'date-fns'
import {
  User,
  Mail,
  Phone,
  MapPin,
  Building,
  Hash,
  Calendar,
  Cake,
  FileText,
  CreditCard,
  Briefcase,
  AlertTriangle,
  Clock,
  LogOut,
  Edit,
  Database,
  Wallet,
  StickyNote,
  CheckCircle2,
} from 'lucide-react'
import { differenceInCalendarDays } from 'date-fns'
import { cn } from '@/lib/utils'
import { getAvatarColor } from '@/lib/avatar-colors'
import { EmployeeActionDialog, type EmployeeActionType } from './employee-action-dialog'
import { useState, type RefObject } from 'react'

function maskPan(pan: string) {
  if (pan.length < 5) return pan
  return pan.slice(0, 5) + '••••' + pan.slice(-1)
}

function maskAadhar(aadhar: string) {
  const cleaned = aadhar.replace(/\s/g, '')
  if (cleaned.length < 4) return aadhar
  return '•••• •••• ' + cleaned.slice(-4)
}

function maskBankAccount(acc: string) {
  if (acc.length < 4) return acc
  return '••••' + acc.slice(-4)
}

function maskUan(uan: string) {
  const cleaned = uan.replace(/\s/g, '')
  if (cleaned.length < 4) return uan
  return '••••••••' + cleaned.slice(-4)
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  ACTIVE: { label: 'Active', className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' },
  ON_PIP: { label: 'On PIP', className: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300' },
  ON_NOTICE: { label: 'Notice', className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' },
  TERMINATED: { label: 'Inactive', className: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300' },
  ABSCONDED: { label: 'Absconded', className: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300' },
}

interface EmployeeData {
  id: string
  employeeCode: string
  managerId: string | null
  manager: { id: string; user: { id: string; name: string } } | null
  bdNumber: number | null
  joinDate: string | null
  dateOfBirth: string | null
  designation: string | null
  panNumber: string | null
  aadharNumber: string | null
  uanNumber: string | null
  aadharDocUrl: string | null
  panDocUrl: string | null
  bankAccountName: string | null
  bankAccountNumber: string | null
  ifscCode: string | null
  status: string
  pipStartDate: string | null
  pipEndDate: string | null
  noticePeriodStartDate: string | null
  noticePeriodEndDate: string | null
  finalWorkingDay: string | null
  terminationReason: string | null
  statusNote: string | null
  fnfDeadline: string | null
  fnfCompleted: boolean
  fnfCompletedAt: string | null
  user: { id: string; name: string; email: string; role: string; phoneNumber: string | null; address: string | null; profilePicture?: string | null }
  department: { id: string; name: string } | null
  leaveBalances?: { leaveTypeName: string; allocated: number; used: number; remaining: number }[]
  documents?: { id: string; documentType: string; title: string | null; generatedAt: string }[]
}

function computeProfileCompletion(emp: EmployeeData): number {
  const fields = [
    emp.user.name,
    emp.user.email,
    emp.user.phoneNumber,
    emp.dateOfBirth,
    emp.joinDate,
    emp.department,
    emp.panNumber,
    emp.aadharNumber,
    emp.bankAccountName,
    emp.bankAccountNumber,
    emp.ifscCode,
    emp.uanNumber,
    emp.designation,
  ]
  const filled = fields.filter(Boolean).length
  return Math.round((filled / fields.length) * 100)
}

function FieldRow({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: React.ElementType
  label: string
  value: string | null
  mono?: boolean
}) {
  const display = value || 'Not set'
  const empty = !value
  return (
    <div className="flex items-center gap-3 py-2.5 min-h-[40px]">
      <div className="w-8 h-8 rounded-lg bg-muted/80 flex items-center justify-center shrink-0">
        <Icon className="size-3.5 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p
          className={cn(
            'text-sm font-medium truncate',
            empty && 'text-muted-foreground italic',
            mono && 'font-mono text-[13px]'
          )}
        >
          {display}
        </p>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-4">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 px-0.5">
        {title}
      </h2>
      {children}
    </section>
  )
}

function fnfUrgency(daysRemaining: number) {
  if (daysRemaining < 0) {
    return {
      cardClass: 'border-red-300 bg-red-50 dark:border-red-900/50 dark:bg-red-950/30',
      textClass: 'text-red-700 dark:text-red-300',
      label: `${Math.abs(daysRemaining)} days overdue`,
    }
  }
  if (daysRemaining <= 5) {
    return {
      cardClass: 'border-red-200 bg-red-50/50 dark:border-red-900/40 dark:bg-red-950/20',
      textClass: 'text-amber-700 dark:text-amber-300',
      label: `${daysRemaining} days remaining`,
    }
  }
  if (daysRemaining <= 15) {
    return {
      cardClass: 'border-amber-200 bg-amber-50/50 dark:border-amber-900/40 dark:bg-amber-950/20',
      textClass: 'text-amber-700 dark:text-amber-300',
      label: `${daysRemaining} days remaining`,
    }
  }
  return {
    cardClass: 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/40 dark:bg-emerald-950/20',
    textClass: 'text-muted-foreground',
    label: `${daysRemaining} days remaining`,
  }
}

function StatusDetailsSection({ employee }: { employee: EmployeeData }) {
  const note = employee.statusNote ?? employee.terminationReason ?? null
  const status = employee.status

  const heading: Record<string, { label: string; tone: string; icon: React.ElementType }> = {
    ON_PIP: { label: 'On PIP', tone: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300', icon: AlertTriangle },
    ON_NOTICE: { label: 'On Notice', tone: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300', icon: Clock },
    TERMINATED: { label: 'Terminated', tone: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300', icon: LogOut },
    ABSCONDED: { label: 'Absconded', tone: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300', icon: AlertTriangle },
  }

  const head = heading[status]
  if (!head) return null
  const HeadIcon = head.icon

  const fwd = employee.finalWorkingDay ? new Date(employee.finalWorkingDay) : null
  const fnfDeadline = employee.fnfDeadline
    ? new Date(employee.fnfDeadline)
    : status === 'TERMINATED' && fwd
      ? new Date(fwd.getTime() + 45 * 24 * 60 * 60 * 1000)
      : null

  const daysRemaining = fnfDeadline
    ? differenceInCalendarDays(fnfDeadline, new Date())
    : null
  const urgency = daysRemaining !== null ? fnfUrgency(daysRemaining) : null

  return (
    <Section title="Status Details">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Badge className={cn('font-normal', head.tone)}>
            <HeadIcon className="h-3 w-3 mr-1" />
            {head.label}
          </Badge>
          {status === 'TERMINATED' && employee.fnfCompleted && (
            <Badge variant="outline" className="text-xs font-normal border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-300">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              FnF completed
            </Badge>
          )}
        </div>

        <div className="divide-y divide-border/60 -mx-4">
          {status === 'ON_PIP' && (
            <>
              <div className="px-4">
                <FieldRow icon={Calendar} label="PIP start" value={employee.pipStartDate ? format(new Date(employee.pipStartDate), 'PPP') : null} />
              </div>
              <div className="px-4">
                <FieldRow icon={Calendar} label="PIP end" value={employee.pipEndDate ? format(new Date(employee.pipEndDate), 'PPP') : null} />
              </div>
            </>
          )}
          {status === 'ON_NOTICE' && (
            <>
              <div className="px-4">
                <FieldRow icon={Calendar} label="Notice start" value={employee.noticePeriodStartDate ? format(new Date(employee.noticePeriodStartDate), 'PPP') : null} />
              </div>
              <div className="px-4">
                <FieldRow icon={Calendar} label="Notice end" value={employee.noticePeriodEndDate ? format(new Date(employee.noticePeriodEndDate), 'PPP') : null} />
              </div>
              {fwd && (
                <div className="px-4">
                  <FieldRow icon={LogOut} label="Final working day" value={format(fwd, 'PPP')} />
                </div>
              )}
            </>
          )}
          {status === 'TERMINATED' && fwd && (
            <div className="px-4">
              <FieldRow icon={LogOut} label="Final working day" value={format(fwd, 'PPP')} />
            </div>
          )}
        </div>

        {status === 'TERMINATED' && fnfDeadline && urgency && (
          <div className={cn('rounded-lg border p-3', urgency.cardClass)}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs text-muted-foreground">FnF deadline</p>
                <p className="text-sm font-medium">{format(fnfDeadline, 'PPP')}</p>
              </div>
              <p className={cn('text-xs font-medium', urgency.textClass)}>
                {employee.fnfCompleted ? 'Completed' : urgency.label}
              </p>
            </div>
          </div>
        )}

        {note && (
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="flex items-center gap-2 mb-1">
              <StickyNote className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-xs font-medium text-muted-foreground">Note</p>
            </div>
            <p className="text-sm whitespace-pre-wrap">{note}</p>
          </div>
        )}

        {!note && (
          <p className="text-xs text-muted-foreground italic">No note recorded for this status.</p>
        )}
      </div>
    </Section>
  )
}

export interface EmployeeDetailDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  skipBackOnCloseRef?: RefObject<boolean>
  employeeId: string | null
  canEdit: boolean
  onEditRequest?: (employee: unknown) => void
  onSuccess?: () => void
}

export function EmployeeDetailDrawer({
  open,
  onOpenChange,
  skipBackOnCloseRef,
  employeeId,
  canEdit,
  onEditRequest,
  onSuccess,
}: EmployeeDetailDrawerProps) {
  const [actionDialog, setActionDialog] = useState<{ action: EmployeeActionType } | null>(null)

  const { data: employee, isLoading } = useQuery({
    queryKey: ['employee', employeeId],
    queryFn: () => apiGet<EmployeeData>(`/api/employees/${employeeId}`),
    enabled: !!employeeId && open,
  })

  const user = employee?.user
  const initials = user?.name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() ?? '?'

  const statusConfig = employee?.status ? STATUS_CONFIG[employee.status] ?? { label: employee.status, className: 'bg-muted text-muted-foreground' } : null
  const profileCompletion = employee ? computeProfileCompletion(employee) : 0

  const handleActionSuccess = () => {
    onSuccess?.()
    setActionDialog(null)
  }

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange} skipBackOnCloseRef={skipBackOnCloseRef} direction="right">
        <DrawerContent className="h-full max-h-dvh w-[60vw] max-w-4xl ml-auto rounded-l-2xl rounded-r-none flex flex-col overflow-hidden">
          <DrawerHeader className="shrink-0 border-b">
            <DrawerTitle className="flex items-center gap-4">
              {employee && (
                <>
                  <Avatar className="size-14 border-2 border-border">
                    <AvatarFallback
                      className={cn(
                        'text-lg font-semibold',
                        getAvatarColor(user?.name ?? '').bg,
                        getAvatarColor(user?.name ?? '').text
                      )}
                    >
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-lg truncate">{user?.name}</p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                      <Badge variant="secondary" className="text-xs font-normal">
                        {user?.role?.replace(/_/g, ' ')}
                      </Badge>
                      {statusConfig && (
                        <Badge variant="outline" className={cn('text-xs font-normal', statusConfig.className)}>
                          {statusConfig.label}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-2">
                      <Progress value={profileCompletion} className="h-1.5 flex-1 max-w-48" />
                      <span className={cn(
                        'text-xs font-medium',
                        profileCompletion === 100 ? 'text-emerald-600' : profileCompletion >= 70 ? 'text-amber-600' : 'text-muted-foreground'
                      )}>
                        {profileCompletion}% complete
                      </span>
                    </div>
                  </div>
                </>
              )}
            </DrawerTitle>
          </DrawerHeader>

          <ScrollArea className="flex-1 min-h-0">
            <div className="p-5 space-y-4 pb-8">
              {isLoading ? (
                <p className="text-sm text-muted-foreground py-8">Loading...</p>
              ) : !employee ? (
                <p className="text-sm text-muted-foreground py-8">Employee not found</p>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="space-y-4">
                    <Section title="Employment">
                      <div className="divide-y divide-border/60 -mx-4">
                        <div className="px-4">
                          <FieldRow icon={Hash} label="Employee code" value={employee.employeeCode} mono />
                        </div>
                        {employee.bdNumber != null && (
                          <div className="px-4">
                            <FieldRow icon={Database} label="CRM Number" value={String(employee.bdNumber)} mono />
                          </div>
                        )}
                        <div className="px-4">
                          <FieldRow icon={Briefcase} label="Position" value={employee.designation ?? user?.role ?? null} />
                        </div>
                        <div className="px-4">
                          <FieldRow icon={Building} label="Department" value={employee.department?.name ?? null} />
                        </div>
                        <div className="px-4">
                          <FieldRow icon={User} label="Manager" value={employee.manager?.user?.name ?? null} />
                        </div>
                        <div className="px-4">
                          <FieldRow icon={Calendar} label="Join date" value={employee.joinDate ? format(new Date(employee.joinDate), 'PPP') : null} />
                        </div>
                        {employee.finalWorkingDay && (
                          <div className="px-4">
                            <FieldRow icon={LogOut} label="Final working day" value={format(new Date(employee.finalWorkingDay), 'PPP')} />
                          </div>
                        )}
                      </div>
                    </Section>

                    <Section title="Personal">
                      <div className="divide-y divide-border/60 -mx-4">
                        <div className="px-4">
                          <FieldRow icon={Mail} label="Email" value={user?.email ?? null} />
                        </div>
                        <div className="px-4">
                          <FieldRow icon={Phone} label="Phone" value={user?.phoneNumber ?? null} />
                        </div>
                        <div className="px-4">
                          <FieldRow icon={MapPin} label="Address" value={user?.address ?? null} />
                        </div>
                        <div className="px-4">
                          <FieldRow icon={Cake} label="Date of birth" value={employee.dateOfBirth ? format(new Date(employee.dateOfBirth), 'PPP') : null} />
                        </div>
                        <div className="px-4">
                          <FieldRow icon={FileText} label="PAN" value={employee.panNumber ? maskPan(employee.panNumber) : null} mono />
                        </div>
                        <div className="px-4">
                          <FieldRow icon={FileText} label="Aadhar" value={employee.aadharNumber ? maskAadhar(employee.aadharNumber) : null} mono />
                        </div>
                        <div className="px-4">
                          <FieldRow icon={CreditCard} label="UAN" value={employee.uanNumber ? maskUan(employee.uanNumber) : null} mono />
                        </div>
                      </div>
                    </Section>
                  </div>

                  <div className="space-y-4">
                    {employee.status !== 'ACTIVE' && (
                      <StatusDetailsSection employee={employee} />
                    )}
                    <Section title="Bank account">
                      <div className="space-y-2">
                        <div>
                          <p className="text-xs text-muted-foreground">Account holder</p>
                          <p className="text-sm font-medium">{employee.bankAccountName || 'Not set'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Account number</p>
                          <p className="text-sm font-mono">
                            {employee.bankAccountNumber ? maskBankAccount(employee.bankAccountNumber) : 'Not set'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">IFSC</p>
                          <p className="text-sm font-mono">{employee.ifscCode || 'Not set'}</p>
                        </div>
                      </div>
                    </Section>

                    {employee.leaveBalances && employee.leaveBalances.length > 0 && (
                      <Section title="Leave balances">
                        <div className="space-y-2">
                          {employee.leaveBalances.map((b) => (
                            <div key={b.leaveTypeName} className="flex justify-between items-center py-1.5 border-b border-border/60 last:border-0">
                              <span className="text-sm font-medium">{b.leaveTypeName}</span>
                              <span className="text-sm text-muted-foreground">
                                {b.remaining} / {b.allocated} (used: {b.used})
                              </span>
                            </div>
                          ))}
                        </div>
                      </Section>
                    )}

                    {employee.documents && employee.documents.length > 0 && (
                      <Section title="Documents">
                        <ul className="space-y-1.5">
                          {employee.documents.map((doc) => (
                            <li key={doc.id} className="text-sm py-1.5 border-b border-border/60 last:border-0">
                              <span className="font-medium">{doc.title || doc.documentType.replace(/_/g, ' ')}</span>
                              <span className="text-muted-foreground ml-1.5">
                                — {format(new Date(doc.generatedAt), 'MMM d, yyyy')}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </Section>
                    )}

                    {canEdit && (
                      <div className="space-y-2 pt-4 border-t">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                          HR Actions
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {employee.status !== 'ON_PIP' && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1.5 border-orange-300 text-orange-700 hover:bg-orange-50 dark:border-orange-800 dark:text-orange-300 dark:hover:bg-orange-900/30"
                              onClick={() => setActionDialog({ action: 'START_PIP' })}
                            >
                              <AlertTriangle className="h-3.5 w-3.5" />
                              PIP
                            </Button>
                          )}
                          {employee.status !== 'ON_NOTICE' && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1.5 border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-300 dark:hover:bg-amber-900/30"
                              onClick={() => setActionDialog({ action: 'START_NOTICE' })}
                            >
                              <Clock className="h-3.5 w-3.5" />
                              Notice
                            </Button>
                          )}
                          {employee.status !== 'TERMINATED' && employee.status !== 'ABSCONDED' && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1.5 border-red-300 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-900/30"
                              onClick={() => setActionDialog({ action: 'TERMINATE' })}
                            >
                              <LogOut className="h-3.5 w-3.5" />
                              Terminate
                            </Button>
                          )}
                          {employee.status !== 'ABSCONDED' && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1.5 border-purple-300 text-purple-700 hover:bg-purple-50 dark:border-purple-800 dark:text-purple-300 dark:hover:bg-purple-900/30"
                              onClick={() => setActionDialog({ action: 'FNF_PROCESS' })}
                            >
                              <Wallet className="h-3.5 w-3.5" />
                              FnF Process
                            </Button>
                          )}
                          {employee.status !== 'ABSCONDED' && employee.status !== 'TERMINATED' && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1.5 border-rose-300 text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-300 dark:hover:bg-rose-900/30"
                              onClick={() => setActionDialog({ action: 'ABSCOND' })}
                            >
                              <AlertTriangle className="h-3.5 w-3.5" />
                              Abscond
                            </Button>
                          )}
                          {(employee.status === 'ON_PIP' || employee.status === 'ON_NOTICE' || employee.status === 'TERMINATED' || employee.status === 'ABSCONDED') && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1.5 border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-900/30"
                              onClick={() => setActionDialog({ action: 'REACTIVATE' })}
                            >
                              Reactivate
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5"
                            onClick={() => onEditRequest?.(employee)}
                          >
                            <Edit className="h-3.5 w-3.5" />
                            Edit
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </DrawerContent>
      </Drawer>

      {actionDialog && employeeId && employee && (
        <EmployeeActionDialog
          open={!!actionDialog}
          onOpenChange={(o) => !o && setActionDialog(null)}
          employeeId={employeeId}
          employeeName={employee.user?.name ?? 'Employee'}
          action={actionDialog.action}
          onSuccess={handleActionSuccess}
        />
      )}
    </>
  )
}
