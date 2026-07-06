'use client'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
  Droplets,
  HeartPulse,
  Users,
  Landmark,
  UserCircle,
} from 'lucide-react'
import { format } from 'date-fns'
import { BirthdayCard } from '@/components/birthday-card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { ChangePasswordDialog } from './change-password-dialog'
import { EditProfileDialog } from './edit-profile-dialog'
import type { ProfileData } from '@/lib/profile-types'
import {
  formatEmergencyContact,
  formatEmploymentStatus,
} from '@/lib/employee-profile'
import {
  ProfileAddressBlock,
  ProfileFieldRow,
  ProfileSection,
} from '@/components/profile/profile-section'
import { ProfileDocumentsSection } from '@/components/profile/profile-documents-section'

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

function formatDate(value: string | Date | null | undefined) {
  if (!value) return null
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return format(d, 'PPP')
}

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  ON_PIP: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
  ON_NOTICE: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  TERMINATED: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  ABSCONDED: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300',
}

function FieldGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="divide-y divide-border/60 -mx-4 sm:-mx-5">{children}</div>
  )
}

function FieldCell({ children }: { children: React.ReactNode }) {
  return <div className="px-4 sm:px-5">{children}</div>
}

export default function ProfilePage() {
  const queryClient = useQueryClient()
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isPasswordOpen, setIsPasswordOpen] = useState(false)

  const { data: profile, isLoading, isError, error, refetch } = useQuery<ProfileData>({
    queryKey: ['profile'],
    queryFn: () => apiGet<ProfileData>('/api/profile'),
    retry: false,
  })

  const user = profile?.user
  const employee = profile?.employee

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="animate-pulse text-sm text-muted-foreground">Loading…</div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="text-sm font-medium">Could not load profile</p>
        <p className="text-xs text-muted-foreground">
          {error instanceof Error ? error.message : 'Something went wrong'}
        </p>
        <Button size="sm" variant="outline" onClick={() => refetch()}>
          Retry
        </Button>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
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

  const manager = employee?.manager?.user
  const deptHead = employee?.department?.head
  const emergencyContact = formatEmergencyContact(
    user.emergencyContactName,
    user.emergencyContactPhone
  )

  return (
    <div className="pb-10">
      {employee && <BirthdayCard />}

      <div className="mx-auto max-w-5xl space-y-4 px-4 sm:px-6">
        {/* Profile header card */}
        <div className="rounded-2xl border bg-card p-4 sm:p-6">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            <Avatar className="size-20 shrink-0 border-2 border-border sm:size-24">
              <AvatarImage src={user.profilePicture ?? undefined} alt={user.name} />
              <AvatarFallback className="bg-primary/10 text-xl font-semibold text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>

            <div className="min-w-0 flex-1 text-center sm:text-left">
              <div className="flex flex-col items-center gap-2 sm:flex-row sm:flex-wrap">
                <h1 className="truncate text-xl font-semibold sm:text-2xl">{user.name}</h1>
                {employee?.status && (
                  <Badge
                    variant="secondary"
                    className={cn('text-xs', STATUS_BADGE[employee.status])}
                  >
                    {formatEmploymentStatus(employee.status)}
                  </Badge>
                )}
              </div>

              <p className="mt-1 text-sm text-muted-foreground">
                {employee?.designation ?? user.role.replace(/_/g, ' ')}
              </p>

              <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground sm:justify-start">
                {employee?.employeeCode && (
                  <span className="inline-flex items-center gap-1">
                    <Hash className="size-3" />
                    {employee.employeeCode}
                  </span>
                )}
                {manager && (
                  <span className="inline-flex items-center gap-1">
                    <Users className="size-3" />
                    Reports to {manager.name}
                  </span>
                )}
                {employee?.department?.name && (
                  <span className="inline-flex items-center gap-1">
                    <Building className="size-3" />
                    {employee.department.name}
                  </span>
                )}
              </div>

              <div className="mt-2 flex items-center justify-center gap-1.5 text-sm text-muted-foreground sm:justify-start">
                <Mail className="size-3.5 shrink-0" />
                <span className="truncate">{user.email}</span>
              </div>

              <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
                <Button size="sm" onClick={() => setIsEditOpen(true)} className="h-9 gap-2 rounded-lg px-4">
                  <Edit className="size-4" />
                  Edit profile
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsPasswordOpen(true)}
                  className="h-9 gap-2 rounded-lg px-4"
                >
                  <Key className="size-4" />
                  Password
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Personal + Employment */}
        <div className="grid gap-4 lg:grid-cols-2">
          <ProfileSection title="Personal Information">
            <FieldGrid>
              <FieldCell>
                <ProfileFieldRow icon={User} label="Full name" value={user.name} />
              </FieldCell>
              <FieldCell>
                <ProfileFieldRow icon={Hash} label="Employee ID" value={employee?.employeeCode} />
              </FieldCell>
              <FieldCell>
                <ProfileFieldRow icon={Mail} label="Email" value={user.email} />
              </FieldCell>
              <FieldCell>
                <ProfileFieldRow icon={Phone} label="Mobile number" value={user.phoneNumber} />
              </FieldCell>
              <FieldCell>
                <ProfileFieldRow
                  icon={Cake}
                  label="Date of birth"
                  value={formatDate(employee?.dateOfBirth)}
                />
              </FieldCell>
              <FieldCell>
                <ProfileFieldRow icon={UserCircle} label="Gender" value={user.gender} />
              </FieldCell>
              <FieldCell>
                <ProfileFieldRow icon={Droplets} label="Blood group" value={employee?.bloodGroup} />
              </FieldCell>
              <FieldCell>
                <ProfileFieldRow icon={HeartPulse} label="Emergency contact" value={emergencyContact} />
              </FieldCell>
            </FieldGrid>
          </ProfileSection>

          <ProfileSection title="Employment Information">
            {employee ? (
              <FieldGrid>
                <FieldCell>
                  <ProfileFieldRow icon={Hash} label="Employee code" value={employee.employeeCode} mono />
                </FieldCell>
                <FieldCell>
                  <ProfileFieldRow icon={Briefcase} label="Designation" value={employee.designation} />
                </FieldCell>
                <FieldCell>
                  <ProfileFieldRow icon={Building} label="Department" value={employee.department?.name} />
                </FieldCell>
                <FieldCell>
                  <ProfileFieldRow icon={FileText} label="Employment type" value={employee.employmentType} />
                </FieldCell>
                <FieldCell>
                  <ProfileFieldRow
                    icon={Calendar}
                    label="Date of joining"
                    value={formatDate(employee.joinDate)}
                  />
                </FieldCell>
                <FieldCell>
                  <ProfileFieldRow icon={MapPin} label="Work location" value={employee.workLocation} />
                </FieldCell>
                <FieldCell>
                  <ProfileFieldRow icon={Users} label="Reporting to" value={manager?.name} />
                </FieldCell>
                <FieldCell>
                  <ProfileFieldRow
                    icon={Info}
                    label="Employment status"
                    value={formatEmploymentStatus(employee.status)}
                  />
                </FieldCell>
              </FieldGrid>
            ) : (
              <p className="py-8 text-center text-sm italic text-muted-foreground">
                Employee record not found. Contact HR to set up your profile.
              </p>
            )}
          </ProfileSection>
        </div>

        {/* Addresses */}
        <div className="grid gap-4 lg:grid-cols-2">
          <ProfileAddressBlock address={user.currentAddress} title="Current Address" />
          <ProfileAddressBlock address={user.permanentAddress} title="Permanent Address" />
        </div>

        {/* Reporting */}
        {employee && (
          <ProfileSection title="Reporting Information">
            <FieldGrid>
              <FieldCell>
                <ProfileFieldRow icon={Users} label="Reporting manager" value={manager?.name} />
              </FieldCell>
              <FieldCell>
                <ProfileFieldRow icon={Mail} label="Manager email" value={manager?.email} />
              </FieldCell>
              <FieldCell>
                <ProfileFieldRow icon={Phone} label="Manager contact" value={manager?.phoneNumber} />
              </FieldCell>
              <FieldCell>
                <ProfileFieldRow icon={UserCircle} label="Department head" value={deptHead?.name} />
              </FieldCell>
              {deptHead?.email && (
                <FieldCell>
                  <ProfileFieldRow icon={Mail} label="Department head email" value={deptHead.email} />
                </FieldCell>
              )}
            </FieldGrid>
          </ProfileSection>
        )}

        {/* Documents */}
        {employee && (
          <ProfileSection title="Documents">
            <ProfileDocumentsSection documents={profile.documents ?? []} />
          </ProfileSection>
        )}

        {/* Identity numbers (masked) */}
        {employee && (
          <ProfileSection title="Identity">
            <FieldGrid>
              <FieldCell>
                <ProfileFieldRow
                  icon={FileText}
                  label="PAN"
                  value={employee.panNumber ? maskPan(employee.panNumber) : null}
                  mono
                />
              </FieldCell>
              <FieldCell>
                <ProfileFieldRow
                  icon={FileText}
                  label="Aadhaar"
                  value={employee.aadharNumber ? maskAadhar(employee.aadharNumber) : null}
                  mono
                />
              </FieldCell>
              <FieldCell>
                <ProfileFieldRow
                  icon={CreditCard}
                  label="UAN"
                  value={employee.uanNumber ? maskUan(employee.uanNumber) : null}
                  mono
                />
              </FieldCell>
            </FieldGrid>
          </ProfileSection>
        )}

        {/* Bank details - read only */}
        {employee && (
          <ProfileSection title="Bank Details">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground">Account holder name</p>
                <p className="mt-0.5 text-sm font-medium">
                  {employee.bankAccountName || (
                    <span className="italic text-muted-foreground">Not set</span>
                  )}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Account number</p>
                <p className="mt-0.5 font-mono text-sm">
                  {employee.bankAccountNumber ? (
                    maskBankAccount(employee.bankAccountNumber)
                  ) : (
                    <span className="font-sans italic text-muted-foreground">Not set</span>
                  )}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Bank name</p>
                <p className="mt-0.5 text-sm font-medium">
                  {employee.bankName || (
                    <span className="italic text-muted-foreground">Not set</span>
                  )}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Branch</p>
                <p className="mt-0.5 text-sm font-medium">
                  {employee.bankBranch || (
                    <span className="italic text-muted-foreground">Not set</span>
                  )}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">IFSC code</p>
                <p className="mt-0.5 font-mono text-sm">
                  {employee.ifscCode || (
                    <span className="font-sans italic text-muted-foreground">Not set</span>
                  )}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">UPI ID</p>
                <p className="mt-0.5 text-sm font-medium">
                  {employee.upiId || (
                    <span className="italic text-muted-foreground">Not set</span>
                  )}
                </p>
              </div>
            </div>
            <p className="mt-4 flex items-center gap-1.5 border-t border-border/60 pt-3 text-xs text-muted-foreground">
              <Landmark className="size-3.5 shrink-0" />
              Bank details are read-only. Contact HR/Admin to update after verification.
            </p>
          </ProfileSection>
        )}
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
