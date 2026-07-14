'use client'

import { Button } from '@/components/ui/button'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import { useState } from 'react'
import {
  User,
  Mail,
  Hash,
  Calendar,
  Building,
  Cake,
  Edit,
  Key,
  Phone,
  MapPin,
  CreditCard,
  FileText,
  Info,
  Briefcase,
  Upload,
  Eye,
  CheckCircle2,
  Clock,
  File,
} from 'lucide-react'
import { format } from 'date-fns'
import { BirthdayCard } from '@/components/birthday-card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { ChangePasswordDialog } from './change-password-dialog'
import { EditProfileDialog, type ProfileData } from './edit-profile-dialog'
import { Badge } from '@/components/ui/badge'

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

// ── Field row ─────────────────────────────────────────────────────────────────
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
    <div className="flex items-center gap-3 py-3 min-h-[44px]">
      <div className="w-9 h-9 rounded-lg bg-muted/80 flex items-center justify-center shrink-0">
        <Icon className="size-4 text-muted-foreground" />
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

// ── Document card ─────────────────────────────────────────────────────────────
type DocStatus = 'verified' | 'pending' | 'not_uploaded'

function DocumentCard({
  label,
  docUrl,
  status,
}: {
  label: string
  docUrl: string | null
  status: DocStatus
}) {
  return (
    <div className="rounded-xl border bg-muted/30 p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
            <File className="size-4 text-muted-foreground" />
          </div>
          <span className="text-sm font-medium truncate">{label}</span>
        </div>
        {status === 'verified' && (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 rounded-full px-2 py-0.5 shrink-0">
            <CheckCircle2 className="size-3" /> Verified
          </span>
        )}
        {status === 'pending' && (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 bg-amber-50 dark:bg-amber-950/40 rounded-full px-2 py-0.5 shrink-0">
            <Clock className="size-3" /> Pending
          </span>
        )}
      </div>
      {docUrl ? (
        <a
          href={docUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
        >
          <Eye className="size-3" /> View document
        </a>
      ) : (
        <p className="text-xs text-muted-foreground">No document uploaded yet</p>
      )}
    </div>
  )
}

// ── Section block ─────────────────────────────────────────────────────────────
function Section({
  title,
  children,
  className,
}: {
  title: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn('rounded-2xl border bg-card p-4 sm:p-5', className)}>
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 px-1">
        {title}
      </h2>
      {children}
    </section>
  )
}

// ── Dummy data (remove when API is ready) ─────────────────────────────────────
const DUMMY_PAST_EMPLOYERS = [
  {
    id: '1',
    companyName: 'Acme Corp Pvt Ltd',
    designation: 'Sales Executive',
    fromDate: '2021-06-01',
    toDate: '2023-03-31',
    reasonForLeaving: 'Better opportunity',
    referenceContact: '+91 98765 00001',
  },
  {
    id: '2',
    companyName: 'Zenith Solutions',
    designation: 'Business Associate',
    fromDate: '2019-09-01',
    toDate: '2021-05-31',
    reasonForLeaving: 'Career growth',
    referenceContact: null,
  },
]

const DUMMY_OTHER_DOCS = [
  { id: '1', label: 'Offer Letter', docUrl: null, status: 'not_uploaded' as DocStatus },
  { id: '2', label: 'Relieving Letter', docUrl: null, status: 'not_uploaded' as DocStatus },
  { id: '3', label: 'Experience Certificate', docUrl: null, status: 'not_uploaded' as DocStatus },
  { id: '4', label: 'Educational Certificate', docUrl: null, status: 'pending' as DocStatus },
]

export default function ProfilePage() {
  const queryClient = useQueryClient()
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isPasswordOpen, setIsPasswordOpen] = useState(false)

  const { data: profile, isLoading } = useQuery<ProfileData>({
    queryKey: ['profile'],
    queryFn: () => apiGet<ProfileData>('/api/profile'),
    retry: false,
  })

  const user = profile?.user
  const employee = profile?.employee

  // Dummy doc statuses — replace with real fields when API has them
  const aadharDocUrl = employee?.aadharDocUrl ?? null
  const panDocUrl = employee?.panDocUrl ?? null
  const aadharDocStatus: DocStatus = aadharDocUrl ? 'verified' : 'not_uploaded'
  const panDocStatus: DocStatus = panDocUrl ? 'verified' : 'not_uploaded'
  const uanDocStatus: DocStatus = employee?.uanNumber ? 'pending' : 'not_uploaded'

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="animate-pulse text-sm text-muted-foreground">Loading…</div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-sm text-muted-foreground">
        User not found
      </div>
    )
  }

  const initials = user.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <div className="pb-8">
      {employee && <BirthdayCard />}

      {/* Profile card */}
      <div className="px-4 sm:px-6 max-w-2xl mx-auto">
        <div className="rounded-2xl border bg-card p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 items-center sm:items-start">
            <Avatar className="size-20 sm:size-24 border-2 border-border shrink-0">
              <AvatarImage src={user.profilePicture ?? undefined} alt={user.name} />
              <AvatarFallback className="text-xl bg-primary/10 text-primary font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0 w-full text-center sm:text-left">
              <h1 className="text-xl font-semibold truncate">{user.name}</h1>
              <span className="mt-1 inline-flex rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">
                {user.role.replace(/_/g, ' ')}
              </span>
              {employee?.employeeCode && (
                <p className="mt-0.5 text-xs text-muted-foreground">#{employee.employeeCode}</p>
              )}
              <div className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground justify-center sm:justify-start">
                <Mail className="size-3.5 shrink-0" />
                <span className="truncate">{user.email}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 justify-center sm:justify-start text-[11px] text-muted-foreground">
                {employee?.joinDate && (
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="size-3" />
                    Joined {format(new Date(employee.joinDate), 'MMM yyyy')}
                  </span>
                )}
                {employee?.dateOfBirth && (
                  <span className="inline-flex items-center gap-1">
                    <Cake className="size-3" />
                    Birthday {format(new Date(employee.dateOfBirth), 'MMM d')}
                  </span>
                )}
                {employee?.department?.name && (
                  <span className="inline-flex items-center gap-1">
                    <Building className="size-3" />
                    {employee.department.name}
                  </span>
                )}
              </div>
              <div className="mt-4 flex flex-wrap gap-2 justify-center sm:justify-start">
                <Button
                  size="sm"
                  onClick={() => setIsEditOpen(true)}
                  className="h-9 px-4 gap-2 rounded-lg"
                >
                  <Edit className="size-4" />
                  Edit profile
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsPasswordOpen(true)}
                  className="h-9 px-4 gap-2 rounded-lg"
                >
                  <Key className="size-4" />
                  Password
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content sections */}
      <div className="space-y-4 px-4 sm:px-6 max-w-2xl mx-auto mt-4">

        {/* Personal */}
        <Section title="Personal">
          <div className="divide-y divide-border/60 -mx-4 sm:-mx-5">
            <div className="px-4 sm:px-5">
              <FieldRow icon={User} label="Name" value={user.name} />
            </div>
            <div className="px-4 sm:px-5">
              <FieldRow icon={Mail} label="Email" value={user.email} />
            </div>
            <div className="px-4 sm:px-5">
              <FieldRow icon={Phone} label="Phone" value={user.phoneNumber} />
            </div>
            <div className="px-4 sm:px-5">
              <FieldRow icon={MapPin} label="Address" value={user.address} />
            </div>
          </div>
        </Section>

        {/* Employment */}
        {employee ? (
          <Section title="Employment">
            <div className="divide-y divide-border/60 -mx-4 sm:-mx-5">
              <div className="px-4 sm:px-5">
                <FieldRow icon={Hash} label="Employee code" value={employee.employeeCode} mono />
              </div>
              <div className="px-4 sm:px-5">
                <FieldRow
                  icon={FileText}
                  label="Position"
                  value={employee.designation ?? user.role ?? null}
                />
              </div>
              <div className="px-4 sm:px-5">
                <FieldRow
                  icon={Building}
                  label="Department"
                  value={employee.department?.name ?? null}
                />
              </div>
              {employee.joinDate && (
                <div className="px-4 sm:px-5">
                  <FieldRow
                    icon={Calendar}
                    label="Join date"
                    value={format(new Date(employee.joinDate), 'PPP')}
                  />
                </div>
              )}
              {employee.dateOfBirth && (
                <div className="px-4 sm:px-5">
                  <FieldRow
                    icon={Cake}
                    label="Date of birth"
                    value={format(new Date(employee.dateOfBirth), 'PPP')}
                  />
                </div>
              )}
              <div className="px-4 sm:px-5">
                <FieldRow
                  icon={FileText}
                  label="PAN"
                  value={employee.panNumber ? maskPan(employee.panNumber) : null}
                  mono
                />
              </div>
              <div className="px-4 sm:px-5">
                <FieldRow
                  icon={FileText}
                  label="Aadhar"
                  value={employee.aadharNumber ? maskAadhar(employee.aadharNumber) : null}
                  mono
                />
              </div>
              <div className="px-4 sm:px-5">
                <FieldRow
                  icon={CreditCard}
                  label="UAN"
                  value={employee.uanNumber ? maskUan(employee.uanNumber) : null}
                  mono
                />
              </div>
            </div>
          </Section>
        ) : (
          <Section title="Employment">
            <div className="py-8 text-center text-sm text-muted-foreground">
              <p>Employee record not found</p>
              <p className="text-xs mt-1">Contact HR to set up your profile</p>
            </div>
          </Section>
        )}

        {/* Bank */}
        {employee && (
          <Section title="Bank account">
            <div className="space-y-4">
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Account holder</p>
                <p className="text-sm font-medium">
                  {employee.bankAccountName || (
                    <span className="text-muted-foreground italic">Not set</span>
                  )}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Account number</p>
                <p className="text-sm font-mono">
                  {employee.bankAccountNumber
                    ? maskBankAccount(employee.bankAccountNumber)
                    : <span className="text-muted-foreground italic font-sans">Not set</span>}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">IFSC</p>
                <p className="text-sm font-mono">
                  {employee.ifscCode || (
                    <span className="text-muted-foreground italic font-sans">Not set</span>
                  )}
                </p>
              </div>
            </div>
            <p className="mt-3 pt-3 border-t border-border/60 text-xs text-muted-foreground flex items-center gap-1.5">
              <Info className="size-3.5 shrink-0" />
              Bank details can only be changed by HR once saved
            </p>
          </Section>
        )}

        {/* Identity Documents */}
        {employee && (
          <Section title="Identity documents">
            <p className="text-xs text-muted-foreground px-1 mb-3">
              Upload clear copies of your identity documents. Documents are reviewed by HR.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <DocumentCard
                label="PAN Card"
                docUrl={panDocUrl}
                status={panDocStatus}
              />
              <DocumentCard
                label="Aadhar Card"
                docUrl={aadharDocUrl}
                status={aadharDocStatus}
              />
              <DocumentCard
                label="UAN / PF"
                docUrl={null}
                status={uanDocStatus}
              />
            </div>
            <p className="mt-3 pt-3 border-t border-border/60 text-xs text-muted-foreground flex items-center gap-1.5">
              <Info className="size-3.5 shrink-0" />
              Contact HR to update or replace uploaded documents
            </p>
          </Section>
        )}

        {/* Past Employment */}
        <Section title="Past employment">
          {DUMMY_PAST_EMPLOYERS.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No past employment records added
            </div>
          ) : (
            <div className="space-y-3 mt-2">
              {DUMMY_PAST_EMPLOYERS.map((emp, idx) => (
                <div
                  key={emp.id}
                  className="rounded-xl border bg-muted/30 p-3 sm:p-4 space-y-2"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5">
                      <Briefcase className="size-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{emp.companyName}</p>
                      <p className="text-xs text-muted-foreground">{emp.designation}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {format(new Date(emp.fromDate), 'MMM yyyy')} —{' '}
                        {emp.toDate ? format(new Date(emp.toDate), 'MMM yyyy') : 'Present'}
                      </p>
                    </div>
                  </div>
                  {(emp.reasonForLeaving || emp.referenceContact) && (
                    <div className="pl-12 space-y-1">
                      {emp.reasonForLeaving && (
                        <p className="text-xs text-muted-foreground">
                          <span className="font-medium text-foreground/70">Reason: </span>
                          {emp.reasonForLeaving}
                        </p>
                      )}
                      {emp.referenceContact && (
                        <p className="text-xs text-muted-foreground">
                          <span className="font-medium text-foreground/70">Reference: </span>
                          {emp.referenceContact}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          <p className="mt-3 pt-3 border-t border-border/60 text-xs text-muted-foreground flex items-center gap-1.5">
            <Info className="size-3.5 shrink-0" />
            Past employment details can be added or updated via Edit profile
          </p>
        </Section>

        {/* Other Documents */}
        <Section title="Other documents">
          <p className="text-xs text-muted-foreground px-1 mb-3">
            Supporting documents such as offer letters, relieving letters, and certificates.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {DUMMY_OTHER_DOCS.map((doc) => (
              <DocumentCard
                key={doc.id}
                label={doc.label}
                docUrl={doc.docUrl}
                status={doc.status}
              />
            ))}
          </div>
          <p className="mt-3 pt-3 border-t border-border/60 text-xs text-muted-foreground flex items-center gap-1.5">
            <Info className="size-3.5 shrink-0" />
            Contact HR to upload or update supporting documents
          </p>
        </Section>

      </div>

      <ChangePasswordDialog
        userId={user.id}
        isOpen={isPasswordOpen}
        onOpenChange={setIsPasswordOpen}
      />
      <EditProfileDialog
        profile={profile!}
        isOpen={isEditOpen}
        onOpenChange={setIsEditOpen}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['profile'] })}
      />
    </div>
  )
}