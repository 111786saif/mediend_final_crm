'use client'

import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { apiGet, apiPatch, apiPost } from '@/lib/api-client'
import { useAuth } from '@/hooks/use-auth'
import { useIsMobile } from '@/hooks/use-mobile'
import { getFirstNavUrl } from '@/lib/sidebar-nav'
import { GuidedTour } from '@/components/onboarding/guided-tour'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  CreditCard,
  FileUp,
  PartyPopper,
  Upload,
  UserPlus,
} from 'lucide-react'
import {
  getOnboardingDocFields,
  type ExperienceType,
  type OnboardingDocKey,
} from '@/lib/onboarding-docs'

type WizardStep = 'welcome' | 'profile' | 'tour' | 'preview'

interface ProfileResponse {
  user: {
    id: string
    name: string
    email: string
    phoneNumber: string | null
    address: string | null
    profilePicture: string | null
    gender: string | null
    emergencyContactName: string | null
    emergencyContactPhone: string | null
    currentAddress?: {
      line?: string | null
      city?: string | null
      state?: string | null
      pinCode?: string | null
      country?: string | null
    } | null
    permanentAddress?: {
      line?: string | null
      city?: string | null
      state?: string | null
      pinCode?: string | null
      country?: string | null
    } | null
  }
  employee: {
    id: string
    employeeCode: string
    dateOfBirth: string | null
    panNumber: string | null
    aadharNumber: string | null
    uanNumber: string | null
    bankAccountName: string | null
    bankAccountNumber: string | null
    ifscCode: string | null
    aadharDocUrl: string | null
    panDocUrl: string | null
    passportDocUrl: string | null
    drivingLicenseDocUrl: string | null
    resumeDocUrl: string | null
    educationalCertDocUrl: string | null
    experienceCertDocUrl: string | null
    appointmentLetterDocUrl: string | null
    salarySlipDocUrl: string | null
    bankStatementDocUrl: string | null
    experienceType: ExperienceType | null
    personalEmail: string | null
    designation: string | null
    department: { id: string; name: string } | null
    onboardingStatus?: string
  } | null
  documents?: Array<{ id: string; label: string; url: string; fileName: string }>
}

type OnboardingForm = {
  name: string
  phoneNumber: string
  gender: string
  dateOfBirth: string
  address: string
  emergencyContactName: string
  emergencyContactPhone: string
  panNumber: string
  aadharNumber: string
  uanNumber: string
  bankAccountName: string
  bankAccountNumber: string
  ifscCode: string
  profilePicture: string
  aadharDocUrl: string
  panDocUrl: string
  resumeDocUrl: string
  educationalCertDocUrl: string
  appointmentLetterDocUrl: string
  salarySlipDocUrl: string
  bankStatementDocUrl: string
}

const STEPS: WizardStep[] = ['welcome', 'profile', 'tour', 'preview']
const STEP_LABELS = ['Welcome', 'Profile', 'Tour', 'Confirm']

function StepIndicator({ current }: { current: WizardStep }) {
  const idx = STEPS.indexOf(current)
  return (
    <div className="flex items-center justify-center gap-1.5 sm:gap-3">
      {STEP_LABELS.map((label, i) => (
        <div key={label} className="flex items-center gap-1.5 sm:gap-2">
          <div
            className={cn(
              'flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold',
              i < idx
                ? 'bg-sky-200 text-sky-900 dark:bg-sky-800 dark:text-sky-100'
                : i === idx
                  ? 'bg-sky-600 text-white'
                  : 'bg-muted text-muted-foreground'
            )}
          >
            {i < idx ? <Check className="h-3.5 w-3.5" /> : i + 1}
          </div>
          <span
            className={cn(
              'text-xs sm:text-sm',
              i === idx ? 'font-medium text-foreground' : 'hidden text-muted-foreground sm:inline'
            )}
          >
            {label}
          </span>
          {i < STEP_LABELS.length - 1 && (
            <div className={cn('mx-0.5 h-px w-4 sm:mx-1 sm:w-6', i < idx ? 'bg-sky-400/50' : 'bg-border')} />
          )}
        </div>
      ))}
    </div>
  )
}

function WaitingForApproval({ name }: { name: string }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-gradient-to-b from-sky-50 via-background to-violet-50 px-4 dark:from-sky-950/40 dark:to-violet-950/30">
      <Card className="w-full max-w-lg border-sky-200/60 shadow-lg dark:border-sky-900/50">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
            <Clock className="h-8 w-8" />
          </div>
          <CardTitle className="text-2xl">Welcome, {name.split(' ')[0]}!</CardTitle>
          <CardDescription className="text-base">Your profile is with HR for review</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
            <p className="font-medium">Waiting for HR approval</p>
            <p className="mt-1 text-amber-800/90 dark:text-amber-300/90">
              HR will review the details you submitted. Once approved, you can use Mediend Workspace normally.
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            You can close this page and log in again anytime — we will bring you back here until approval.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

function PreviewRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 break-words text-sm font-medium">{value?.trim() || '—'}</p>
    </div>
  )
}

function IdentityBankFields({
  form,
  setForm,
}: {
  form: OnboardingForm
  setForm: Dispatch<SetStateAction<OnboardingForm>>
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label>Aadhaar *</Label>
        <Input
          value={form.aadharNumber}
          onChange={(e) =>
            setForm((p) => ({
              ...p,
              aadharNumber: e.target.value.replace(/\D/g, '').slice(0, 12),
            }))
          }
          maxLength={12}
          className="font-mono"
          placeholder="12 digits"
          inputMode="numeric"
        />
      </div>
      <div className="space-y-1.5">
        <Label>PAN *</Label>
        <Input
          value={form.panNumber}
          onChange={(e) =>
            setForm((p) => ({ ...p, panNumber: e.target.value.toUpperCase().slice(0, 10) }))
          }
          maxLength={10}
          className="font-mono"
          placeholder="ABCDE1234F"
          autoCapitalize="characters"
        />
      </div>
      <div className="space-y-1.5">
        <Label>UAN</Label>
        <Input
          value={form.uanNumber}
          onChange={(e) =>
            setForm((p) => ({
              ...p,
              uanNumber: e.target.value.replace(/\D/g, '').slice(0, 12),
            }))
          }
          maxLength={12}
          className="font-mono"
          inputMode="numeric"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Account holder name *</Label>
        <Input
          value={form.bankAccountName}
          onChange={(e) => setForm((p) => ({ ...p, bankAccountName: e.target.value }))}
        />
      </div>
      <div className="space-y-1.5">
        <Label>Account number *</Label>
        <Input
          value={form.bankAccountNumber}
          onChange={(e) =>
            setForm((p) => ({
              ...p,
              bankAccountNumber: e.target.value.replace(/\D/g, ''),
            }))
          }
          className="font-mono"
          inputMode="numeric"
        />
      </div>
      <div className="space-y-1.5">
        <Label>IFSC *</Label>
        <Input
          value={form.ifscCode}
          onChange={(e) =>
            setForm((p) => ({ ...p, ifscCode: e.target.value.toUpperCase().slice(0, 11) }))
          }
          maxLength={11}
          className="font-mono"
          placeholder="SBIN0001234"
          autoCapitalize="characters"
        />
      </div>
    </div>
  )
}

function DocumentsList({
  form,
  docFields,
  uploadingDoc,
  onUploadClick,
}: {
  form: OnboardingForm
  docFields: ReturnType<typeof getOnboardingDocFields>
  uploadingDoc: string | null
  onUploadClick: (key: OnboardingDocKey) => void
}) {
  return (
    <div className="space-y-2">
      {docFields.map((doc) => {
        const url = form[doc.key]
        const isUploading = uploadingDoc === doc.key
        const accept = doc.key === 'profilePicture' ? 'image/*' : undefined
        return (
          <div
            key={doc.key}
            className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2.5"
          >
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-sm font-medium">
                <FileUp className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                {doc.label}
              </p>
              {url ? (
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-0.5 block truncate text-xs text-sky-600 hover:underline"
                >
                  Uploaded — view
                </a>
              ) : (
                <p className="mt-0.5 text-xs text-muted-foreground">Not uploaded</p>
              )}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 shrink-0 gap-1.5 text-xs"
              disabled={!!isUploading}
              onClick={() => onUploadClick(doc.key)}
              data-accept={accept}
            >
              <Upload className="h-3.5 w-3.5" />
              {isUploading ? 'Uploading…' : url ? 'Replace' : 'Upload'}
            </Button>
          </div>
        )
      })}
    </div>
  )
}

export default function OnboardingPage() {
  const { user, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const queryClient = useQueryClient()
  const isMobile = useIsMobile()
  const photoRef = useRef<HTMLInputElement>(null)
  const docFileRef = useRef<HTMLInputElement>(null)
  const [pendingDocKey, setPendingDocKey] = useState<OnboardingDocKey | null>(null)
  const [step, setStep] = useState<WizardStep>('welcome')
  const [acknowledged, setAcknowledged] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null)
  const [identityDrawerOpen, setIdentityDrawerOpen] = useState(false)
  const [docsDrawerOpen, setDocsDrawerOpen] = useState(false)

  const { data: profile, isLoading: profileLoading, refetch } = useQuery<ProfileResponse>({
    queryKey: ['profile', 'onboarding'],
    queryFn: () => apiGet<ProfileResponse>('/api/profile'),
    enabled: !!user,
  })

  const [form, setForm] = useState<OnboardingForm>({
    name: '',
    phoneNumber: '',
    gender: '',
    dateOfBirth: '',
    address: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    panNumber: '',
    aadharNumber: '',
    uanNumber: '',
    bankAccountName: '',
    bankAccountNumber: '',
    ifscCode: '',
    profilePicture: '',
    aadharDocUrl: '',
    panDocUrl: '',
    resumeDocUrl: '',
    educationalCertDocUrl: '',
    appointmentLetterDocUrl: '',
    salarySlipDocUrl: '',
    bankStatementDocUrl: '',
  })

  const experienceType = profile?.employee?.experienceType ?? 'FRESHER'
  const docFields = useMemo(() => getOnboardingDocFields(experienceType), [experienceType])

  useEffect(() => {
    if (!profile) return
    const emp = profile.employee
    const dob = emp?.dateOfBirth ? new Date(emp.dateOfBirth).toISOString().slice(0, 10) : ''
    setForm({
      name: profile.user.name ?? '',
      phoneNumber: profile.user.phoneNumber ?? '',
      gender: profile.user.gender ?? '',
      dateOfBirth: dob,
      address: profile.user.address ?? profile.user.currentAddress?.line ?? '',
      emergencyContactName: profile.user.emergencyContactName ?? '',
      emergencyContactPhone: profile.user.emergencyContactPhone ?? '',
      panNumber: emp?.panNumber ?? '',
      aadharNumber: emp?.aadharNumber ?? '',
      uanNumber: emp?.uanNumber ?? '',
      bankAccountName: emp?.bankAccountName ?? '',
      bankAccountNumber: emp?.bankAccountNumber ?? '',
      ifscCode: emp?.ifscCode ?? '',
      profilePicture: profile.user.profilePicture ?? '',
      aadharDocUrl: emp?.aadharDocUrl ?? '',
      panDocUrl: emp?.panDocUrl ?? '',
      resumeDocUrl: emp?.resumeDocUrl ?? '',
      educationalCertDocUrl: emp?.educationalCertDocUrl ?? '',
      appointmentLetterDocUrl: emp?.appointmentLetterDocUrl ?? '',
      salarySlipDocUrl: emp?.salarySlipDocUrl ?? '',
      bankStatementDocUrl: emp?.bankStatementDocUrl ?? '',
    })
  }, [profile])

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.push('/login')
      return
    }
    if (!user.onboardingStatus || user.onboardingStatus === 'APPROVED') {
      router.push(getFirstNavUrl(user))
    }
  }, [user, authLoading, router])

  const saveMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => apiPatch('/api/profile', payload),
    onError: (e: Error) => toast.error(e.message || 'Failed to save profile'),
  })

  const completeMutation = useMutation({
    mutationFn: () => apiPost('/api/onboarding/complete', {}),
    onSuccess: async () => {
      toast.success('Submitted for HR approval')
      await queryClient.invalidateQueries({ queryKey: ['auth', 'me'] })
      await queryClient.invalidateQueries({ queryKey: ['profile', 'onboarding'] })
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to submit'),
  })

  const uploadFile = async (file: File, folderHint?: string) => {
    const fd = new FormData()
    fd.append('file', file)
    if (folderHint) fd.append('folder', folderHint)
    return apiPost<{ url: string }>('/api/profile/upload', fd)
  }

  const handlePhotoUpload = async (file: File) => {
    setUploadingPhoto(true)
    try {
      const res = await uploadFile(file)
      if (res?.url) {
        setForm((p) => ({ ...p, profilePicture: res.url }))
        toast.success('Photo uploaded')
      }
    } catch {
      toast.error('Photo upload failed')
    } finally {
      setUploadingPhoto(false)
    }
  }

  const handleDocUpload = async (file: File, key: OnboardingDocKey) => {
    setUploadingDoc(key)
    try {
      const res = await uploadFile(file)
      if (res?.url) {
        setForm((p) => ({ ...p, [key]: res.url }))
        toast.success(key === 'profilePicture' ? 'Passport photo uploaded' : 'Document uploaded')
      }
    } catch {
      toast.error(key === 'profilePicture' ? 'Photo upload failed' : 'Document upload failed')
    } finally {
      setUploadingDoc(null)
      setPendingDocKey(null)
    }
  }

  const triggerDocUpload = (key: OnboardingDocKey) => {
    setPendingDocKey(key)
    if (key === 'profilePicture') {
      photoRef.current?.click()
    } else {
      docFileRef.current?.click()
    }
  }

  const profileValid = useMemo(() => {
    return (
      form.name.trim() &&
      form.phoneNumber.trim() &&
      form.aadharNumber.trim().length >= 12 &&
      form.panNumber.trim().length >= 10 &&
      form.bankAccountName.trim() &&
      form.bankAccountNumber.trim() &&
      form.ifscCode.trim().length >= 11
    )
  }, [form])

  const identityComplete = useMemo(
    () =>
      form.aadharNumber.trim().length >= 12 &&
      form.panNumber.trim().length >= 10 &&
      form.bankAccountName.trim() &&
      form.bankAccountNumber.trim() &&
      form.ifscCode.trim().length >= 11,
    [form]
  )

  const docsUploadedCount = useMemo(
    () => docFields.filter((d) => !!form[d.key]).length,
    [form, docFields]
  )

  const saveProfile = async () => {
    if (!profileValid) {
      toast.error('Please fill all required profile fields')
      if (isMobile && !identityComplete) setIdentityDrawerOpen(true)
      return false
    }

    const emp = profile?.employee
    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      phoneNumber: form.phoneNumber.trim() || null,
      gender: form.gender || null,
      address: form.address.trim() || null,
      currentAddress: form.address.trim() ? { line: form.address.trim() } : null,
      emergencyContactName: form.emergencyContactName.trim() || null,
      emergencyContactPhone: form.emergencyContactPhone.trim() || null,
      profilePicture: form.profilePicture || null,
      dateOfBirth: form.dateOfBirth || null,
      aadharDocUrl: form.aadharDocUrl || null,
      panDocUrl: form.panDocUrl || null,
      resumeDocUrl: form.resumeDocUrl || null,
      educationalCertDocUrl: form.educationalCertDocUrl || null,
      appointmentLetterDocUrl: form.appointmentLetterDocUrl || null,
      salarySlipDocUrl: form.salarySlipDocUrl || null,
      bankStatementDocUrl: form.bankStatementDocUrl || null,
    }

    // Only send identity/bank fields when still empty (first-time). Avoids 403 on re-save.
    if (!emp?.panNumber) payload.panNumber = form.panNumber.trim().toUpperCase() || null
    if (!emp?.aadharNumber) payload.aadharNumber = form.aadharNumber.replace(/\D/g, '').slice(0, 12) || null
    if (!emp?.uanNumber) payload.uanNumber = form.uanNumber.replace(/\D/g, '').slice(0, 12) || null
    if (!emp?.bankAccountName) payload.bankAccountName = form.bankAccountName.trim() || null
    if (!emp?.bankAccountNumber) payload.bankAccountNumber = form.bankAccountNumber.replace(/\D/g, '') || null
    if (!emp?.ifscCode) payload.ifscCode = form.ifscCode.trim().toUpperCase() || null

    await saveMutation.mutateAsync(payload)
    await refetch()
    return true
  }

  const goNextFromProfile = async () => {
    const ok = await saveProfile()
    if (ok) setStep('tour')
  }

  const handleSubmit = async () => {
    if (!acknowledged) {
      toast.error('Please acknowledge that your details are correct')
      return
    }
    await completeMutation.mutateAsync()
  }

  if (authLoading || profileLoading || !user) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent" />
          <p className="mt-4 text-sm text-muted-foreground">Loading onboarding...</p>
        </div>
      </div>
    )
  }

  if (user.onboardingStatus === 'PENDING_APPROVAL') {
    return <WaitingForApproval name={user.name || form.name || 'there'} />
  }

  const initials = (form.name || user.name || 'U')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const stickyFooter =
    step === 'profile' || step === 'preview' || step === 'tour' || step === 'welcome'

  return (
    <div className="flex min-h-dvh flex-col bg-gradient-to-b from-sky-50/80 via-background to-violet-50/50 dark:from-sky-950/30 dark:to-violet-950/20">
      <div className="sticky top-0 z-20 border-b border-sky-200/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 dark:border-sky-900/40">
        <div className="bg-gradient-to-r from-sky-600/10 via-transparent to-violet-600/10 px-4 py-3 sm:px-6 sm:py-4">
          <div className="mx-auto flex max-w-3xl items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-600 text-white shadow-sm">
              <UserPlus className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-base font-semibold sm:text-xl">Employee onboarding</h1>
              <p className="truncate text-xs text-muted-foreground sm:text-sm">
                Complete your profile so HR can activate your account
              </p>
            </div>
          </div>
        </div>
        <div className="px-4 py-2.5 sm:px-6">
          <div className="mx-auto max-w-3xl">
            <StepIndicator current={step} />
          </div>
        </div>
      </div>

      <div
        className={cn(
          'mx-auto w-full max-w-3xl flex-1 space-y-4 px-4 py-4 sm:space-y-6 sm:px-6 sm:py-8',
          stickyFooter && 'pb-[calc(5.5rem+env(safe-area-inset-bottom))]'
        )}
      >
        <input
          ref={photoRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handlePhotoUpload(e.target.files[0])}
        />
        <input
          ref={docFileRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file && pendingDocKey) handleDocUpload(file, pendingDocKey)
            e.target.value = ''
          }}
        />

        {step === 'welcome' && (
          <Card>
            <CardHeader className="space-y-3 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-sky-600/15 text-sky-700 dark:text-sky-300">
                <PartyPopper className="h-7 w-7" />
              </div>
              <CardTitle className="text-xl sm:text-2xl">
                Welcome to Mediend, {user.name.split(' ')[0]}!
              </CardTitle>
              <CardDescription className="text-sm sm:text-base">
                A few steps and you will be ready. Fill your profile, take a quick tour, then confirm
                your details for HR review.
              </CardDescription>
            </CardHeader>
            <CardContent className="hidden justify-center sm:flex">
              <Button className="bg-sky-600 hover:bg-sky-700" onClick={() => setStep('profile')}>
                Get started <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        )}

        {step === 'profile' && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg sm:text-xl">Your profile</CardTitle>
              <CardDescription className="text-sm">
                Fields marked * are required. PAN, Aadhaar and bank details can only be changed by HR
                once saved.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center gap-4">
                <Avatar className="size-16 ring-2 ring-sky-500/30 sm:size-20">
                  <AvatarImage src={form.profilePicture || undefined} alt={form.name} />
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
                <div className="space-y-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    disabled={uploadingPhoto}
                    onClick={() => {
                      setPendingDocKey('profilePicture')
                      photoRef.current?.click()
                    }}
                  >
                    <Camera className="h-4 w-4" />
                    {uploadingPhoto
                      ? 'Uploading…'
                      : form.profilePicture
                        ? 'Change passport photo'
                        : 'Upload passport photo'}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Required — passport-size photo for your profile.
                    {experienceType === 'EXPERIENCED' ? ' Experienced hire document list applies.' : ' Fresher document list applies.'}
                  </p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Full name *</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input value={profile?.user.email ?? user.email} disabled />
                </div>
                <div className="space-y-1.5">
                  <Label>Phone *</Label>
                  <Input
                    value={form.phoneNumber}
                    onChange={(e) => setForm((p) => ({ ...p, phoneNumber: e.target.value }))}
                    placeholder="+91 98765 43210"
                    inputMode="tel"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Date of birth</Label>
                  <Input
                    type="date"
                    value={form.dateOfBirth}
                    onChange={(e) => setForm((p) => ({ ...p, dateOfBirth: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Address</Label>
                  <Input
                    value={form.address}
                    onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
                    placeholder="Current address"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Emergency contact name</Label>
                  <Input
                    value={form.emergencyContactName}
                    onChange={(e) => setForm((p) => ({ ...p, emergencyContactName: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Emergency contact phone</Label>
                  <Input
                    value={form.emergencyContactPhone}
                    onChange={(e) => setForm((p) => ({ ...p, emergencyContactPhone: e.target.value }))}
                    inputMode="tel"
                  />
                </div>
              </div>

              {/* Mobile: open dense sections in drawers */}
              {isMobile ? (
                <div className="space-y-2 border-t pt-4">
                  <button
                    type="button"
                    onClick={() => setIdentityDrawerOpen(true)}
                    className="flex w-full items-center gap-3 rounded-xl border bg-muted/30 px-3 py-3 text-left active:bg-muted/50"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-600/15 text-sky-700 dark:text-sky-300">
                      <CreditCard className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">Identity & bank *</p>
                      <p className="text-xs text-muted-foreground">
                        {identityComplete ? 'Complete' : 'Aadhaar, PAN, bank details required'}
                      </p>
                    </div>
                    {identityComplete ? (
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                    ) : (
                      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setDocsDrawerOpen(true)}
                    className="flex w-full items-center gap-3 rounded-xl border bg-muted/30 px-3 py-3 text-left active:bg-muted/50"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-600/15 text-violet-700 dark:text-violet-300">
                      <FileUp className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">Documents</p>
                      <p className="text-xs text-muted-foreground">
                        {docsUploadedCount}/{docFields.length} uploaded
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                  </button>
                </div>
              ) : (
                <>
                  <p className="border-t pt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Identity & bank
                  </p>
                  <IdentityBankFields form={form} setForm={setForm} />

                  <p className="border-t pt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Documents
                  </p>
                  <DocumentsList
                    form={form}
                    docFields={docFields}
                    uploadingDoc={uploadingDoc}
                    onUploadClick={triggerDocUpload}
                  />
                </>
              )}

              <div className="hidden pt-2 sm:flex sm:flex-row sm:justify-between sm:gap-2">
                <Button variant="outline" onClick={() => setStep('welcome')}>
                  <ArrowLeft className="mr-1 h-4 w-4" /> Back
                </Button>
                <Button
                  className="bg-sky-600 hover:bg-sky-700"
                  disabled={!profileValid || saveMutation.isPending}
                  onClick={goNextFromProfile}
                >
                  {saveMutation.isPending ? 'Saving…' : 'Save & continue'}
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 'tour' && (
          <Card>
            <CardContent className="pt-6">
              <GuidedTour role={user.role} onComplete={() => setStep('preview')} />
              <div className="mt-6 hidden justify-start sm:flex">
                <Button variant="outline" onClick={() => setStep('profile')}>
                  <ArrowLeft className="mr-1 h-4 w-4" /> Back
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 'preview' && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg sm:text-xl">Review & confirm</CardTitle>
              <CardDescription className="text-sm">
                Double-check everything below. Submitting sends this to HR for approval.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4 rounded-xl border bg-muted/20 p-3 sm:p-4">
                <Avatar className="size-16 ring-2 ring-violet-500/30 sm:size-20">
                  <AvatarImage src={form.profilePicture || undefined} alt={form.name} />
                  <AvatarFallback className="text-lg">{initials}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-lg font-semibold">{form.name}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {profile?.user.email ?? user.email}
                  </p>
                </div>
              </div>

              <div className="grid gap-3 rounded-xl border bg-muted/20 p-3 sm:grid-cols-2 sm:p-4">
                <PreviewRow label="Phone" value={form.phoneNumber} />
                <PreviewRow label="Employee code" value={profile?.employee?.employeeCode} />
                <PreviewRow label="Department" value={profile?.employee?.department?.name} />
                <PreviewRow label="Date of birth" value={form.dateOfBirth || undefined} />
                <PreviewRow
                  label="Aadhaar"
                  value={form.aadharNumber ? `••••${form.aadharNumber.slice(-4)}` : undefined}
                />
                <PreviewRow label="PAN" value={form.panNumber || undefined} />
                <PreviewRow label="Bank holder" value={form.bankAccountName} />
                <PreviewRow
                  label="Account"
                  value={
                    form.bankAccountNumber
                      ? `••••${form.bankAccountNumber.slice(-4)}`
                      : undefined
                  }
                />
                <PreviewRow label="IFSC" value={form.ifscCode} />
                <PreviewRow label="UAN" value={form.uanNumber || undefined} />
                <PreviewRow
                  label="Emergency contact"
                  value={
                    [form.emergencyContactName, form.emergencyContactPhone]
                      .filter(Boolean)
                      .join(' · ') || undefined
                  }
                />
                <PreviewRow label="Address" value={form.address || undefined} />
              </div>

              <div className="space-y-2 rounded-xl border p-3 sm:p-4">
                <p className="text-sm font-medium">Documents</p>
                <div className="flex flex-wrap gap-2">
                  {docFields.map((doc) => (
                    <span
                      key={doc.key}
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs',
                        form[doc.key]
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                          : 'border-border text-muted-foreground'
                      )}
                    >
                      {form[doc.key] ? <CheckCircle2 className="h-3 w-3" /> : null}
                      {doc.label}
                    </span>
                  ))}
                </div>
              </div>

              <label className="flex cursor-pointer items-start gap-3 rounded-xl border p-3 sm:p-4">
                <Checkbox
                  checked={acknowledged}
                  onCheckedChange={(v) => setAcknowledged(v === true)}
                  className="mt-0.5"
                />
                <span className="text-sm leading-relaxed">
                  I confirm that the profile details and documents above are accurate. I understand HR
                  will review and approve my account before I can use the workspace.
                </span>
              </label>

              <div className="hidden pt-2 sm:flex sm:flex-row sm:justify-between sm:gap-2">
                <Button variant="outline" onClick={() => setStep('tour')}>
                  <ArrowLeft className="mr-1 h-4 w-4" /> Back
                </Button>
                <Button
                  className="bg-violet-600 hover:bg-violet-700"
                  disabled={
                    !acknowledged || completeMutation.isPending || saveMutation.isPending
                  }
                  onClick={handleSubmit}
                >
                  {completeMutation.isPending ? 'Submitting…' : 'Submit for HR approval'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Mobile sticky footer actions */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/90 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:hidden">
        {step === 'welcome' && (
          <Button className="w-full bg-sky-600 hover:bg-sky-700" onClick={() => setStep('profile')}>
            Get started <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        )}
        {step === 'profile' && (
          <div className="flex gap-2">
            <Button variant="outline" className="shrink-0" onClick={() => setStep('welcome')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Button
              className="min-w-0 flex-1 bg-sky-600 hover:bg-sky-700"
              disabled={!profileValid || saveMutation.isPending}
              onClick={goNextFromProfile}
            >
              {saveMutation.isPending ? 'Saving…' : 'Save & continue'}
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        )}
        {step === 'tour' && (
          <Button variant="outline" className="w-full" onClick={() => setStep('profile')}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Back to profile
          </Button>
        )}
        {step === 'preview' && (
          <div className="flex gap-2">
            <Button variant="outline" className="shrink-0" onClick={() => setStep('tour')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Button
              className="min-w-0 flex-1 bg-violet-600 hover:bg-violet-700"
              disabled={!acknowledged || completeMutation.isPending || saveMutation.isPending}
              onClick={handleSubmit}
            >
              {completeMutation.isPending ? 'Submitting…' : 'Submit for approval'}
            </Button>
          </div>
        )}
      </div>

      <Drawer open={identityDrawerOpen} onOpenChange={setIdentityDrawerOpen}>
        <DrawerContent className="max-h-[90dvh]">
          <DrawerHeader className="text-left">
            <DrawerTitle>Identity & bank</DrawerTitle>
            <DrawerDescription>
              Required for payroll. These can only be changed by HR after you save.
            </DrawerDescription>
          </DrawerHeader>
          <div className="overflow-y-auto overscroll-contain px-4 pb-2">
            <IdentityBankFields form={form} setForm={setForm} />
          </div>
          <DrawerFooter className="pb-[max(1rem,env(safe-area-inset-bottom))]">
            <Button
              className="w-full bg-sky-600 hover:bg-sky-700"
              onClick={() => {
                if (!identityComplete) {
                  toast.error('Please fill Aadhaar, PAN, and bank details')
                  return
                }
                setIdentityDrawerOpen(false)
              }}
            >
              Done
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <Drawer open={docsDrawerOpen} onOpenChange={setDocsDrawerOpen}>
        <DrawerContent className="max-h-[90dvh]">
          <DrawerHeader className="text-left">
            <DrawerTitle>Documents</DrawerTitle>
            <DrawerDescription>
              Upload PDF or clear photos. You can replace a file anytime before submitting.
            </DrawerDescription>
          </DrawerHeader>
          <div className="overflow-y-auto overscroll-contain px-4 pb-2">
            <DocumentsList
              form={form}
              docFields={docFields}
              uploadingDoc={uploadingDoc}
              onUploadClick={triggerDocUpload}
            />
          </div>
          <DrawerFooter className="pb-[max(1rem,env(safe-area-inset-bottom))]">
            <Button className="w-full" variant="outline" onClick={() => setDocsDrawerOpen(false)}>
              Done ({docsUploadedCount}/{docFields.length} uploaded)
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  )
}
