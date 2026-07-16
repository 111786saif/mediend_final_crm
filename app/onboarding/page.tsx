'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { apiGet, apiPatch, apiPost } from '@/lib/api-client'
import { useAuth } from '@/hooks/use-auth'
import { getFirstNavUrl } from '@/lib/sidebar-nav'
import { GuidedTour } from '@/components/onboarding/guided-tour'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  CheckCircle2,
  Clock,
  FileUp,
  PartyPopper,
  Upload,
  UserPlus,
} from 'lucide-react'

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
    designation: string | null
    department: { id: string; name: string } | null
    onboardingStatus?: string
  } | null
  documents?: Array<{ id: string; label: string; url: string; fileName: string }>
}

const DOC_FIELDS: Array<{
  key: keyof Pick<
    NonNullable<ProfileResponse['employee']>,
    | 'aadharDocUrl'
    | 'panDocUrl'
    | 'passportDocUrl'
    | 'resumeDocUrl'
    | 'educationalCertDocUrl'
    | 'experienceCertDocUrl'
  >
  label: string
}> = [
  { key: 'aadharDocUrl', label: 'Aadhaar Card' },
  { key: 'panDocUrl', label: 'PAN Card' },
  { key: 'resumeDocUrl', label: 'Resume' },
  { key: 'educationalCertDocUrl', label: 'Educational Certificate' },
  { key: 'experienceCertDocUrl', label: 'Experience Certificate' },
  { key: 'passportDocUrl', label: 'Passport (optional)' },
]

const STEPS: WizardStep[] = ['welcome', 'profile', 'tour', 'preview']

function StepIndicator({ current }: { current: WizardStep }) {
  const labels = ['Welcome', 'Profile', 'Tour', 'Confirm']
  const idx = STEPS.indexOf(current)
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
      {labels.map((label, i) => (
        <div key={label} className="flex items-center gap-2">
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
              i === idx ? 'font-medium text-foreground' : 'text-muted-foreground'
            )}
          >
            {label}
          </span>
          {i < labels.length - 1 && (
            <div className={cn('mx-1 hidden h-px w-6 sm:block', i < idx ? 'bg-sky-400/50' : 'bg-border')} />
          )}
        </div>
      ))}
    </div>
  )
}

function WaitingForApproval({ name }: { name: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-sky-50 via-background to-violet-50 px-4 dark:from-sky-950/40 dark:to-violet-950/30">
      <Card className="w-full max-w-lg border-sky-200/60 shadow-lg dark:border-sky-900/50">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
            <Clock className="h-8 w-8" />
          </div>
          <CardTitle className="text-2xl">Welcome, {name.split(' ')[0]}!</CardTitle>
          <CardDescription className="text-base">
            Your profile is with HR for review
          </CardDescription>
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

export default function OnboardingPage() {
  const { user, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const queryClient = useQueryClient()
  const photoRef = useRef<HTMLInputElement>(null)
  const docFileRef = useRef<HTMLInputElement>(null)
  const [pendingDocKey, setPendingDocKey] = useState<string | null>(null)
  const [step, setStep] = useState<WizardStep>('welcome')
  const [acknowledged, setAcknowledged] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null)

  const { data: profile, isLoading: profileLoading, refetch } = useQuery<ProfileResponse>({
    queryKey: ['profile', 'onboarding'],
    queryFn: () => apiGet<ProfileResponse>('/api/profile'),
    enabled: !!user,
  })

  const [form, setForm] = useState({
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
    passportDocUrl: '',
    resumeDocUrl: '',
    educationalCertDocUrl: '',
    experienceCertDocUrl: '',
  })

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
      passportDocUrl: emp?.passportDocUrl ?? '',
      resumeDocUrl: emp?.resumeDocUrl ?? '',
      educationalCertDocUrl: emp?.educationalCertDocUrl ?? '',
      experienceCertDocUrl: emp?.experienceCertDocUrl ?? '',
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

  const handleDocUpload = async (file: File, key: string) => {
    setUploadingDoc(key)
    try {
      const res = await uploadFile(file)
      if (res?.url) {
        setForm((p) => ({ ...p, [key]: res.url }))
        toast.success('Document uploaded')
      }
    } catch {
      toast.error('Document upload failed')
    } finally {
      setUploadingDoc(null)
      setPendingDocKey(null)
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

  const saveProfile = async () => {
    if (!profileValid) {
      toast.error('Please fill all required profile fields')
      return false
    }
    await saveMutation.mutateAsync({
      name: form.name.trim(),
      phoneNumber: form.phoneNumber.trim() || null,
      gender: form.gender || null,
      address: form.address.trim() || null,
      currentAddress: form.address.trim()
        ? { line: form.address.trim() }
        : null,
      emergencyContactName: form.emergencyContactName.trim() || null,
      emergencyContactPhone: form.emergencyContactPhone.trim() || null,
      profilePicture: form.profilePicture || null,
      dateOfBirth: form.dateOfBirth || null,
      panNumber: form.panNumber.trim().toUpperCase() || null,
      aadharNumber: form.aadharNumber.replace(/\D/g, '').slice(0, 12) || null,
      uanNumber: form.uanNumber.replace(/\D/g, '').slice(0, 12) || null,
      bankAccountName: form.bankAccountName.trim() || null,
      bankAccountNumber: form.bankAccountNumber.replace(/\D/g, '') || null,
      ifscCode: form.ifscCode.trim().toUpperCase() || null,
      aadharDocUrl: form.aadharDocUrl || null,
      panDocUrl: form.panDocUrl || null,
      passportDocUrl: form.passportDocUrl || null,
      resumeDocUrl: form.resumeDocUrl || null,
      educationalCertDocUrl: form.educationalCertDocUrl || null,
      experienceCertDocUrl: form.experienceCertDocUrl || null,
    })
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
    const ok = await saveProfile()
    if (!ok) return
    await completeMutation.mutateAsync()
  }

  if (authLoading || profileLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50/80 via-background to-violet-50/50 dark:from-sky-950/30 dark:to-violet-950/20">
      <div className="border-b border-sky-200/40 bg-gradient-to-r from-sky-600/10 via-background to-violet-600/10 px-4 py-4 dark:border-sky-900/40 sm:px-6">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-600 text-white shadow-sm">
            <UserPlus className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold sm:text-xl">Employee onboarding</h1>
            <p className="text-xs text-muted-foreground sm:text-sm">
              Complete your profile so HR can activate your account
            </p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        <StepIndicator current={step} />

        {step === 'welcome' && (
          <Card>
            <CardHeader className="text-center space-y-3">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-sky-600/15 text-sky-700 dark:text-sky-300">
                <PartyPopper className="h-7 w-7" />
              </div>
              <CardTitle className="text-2xl">Welcome to Mediend, {user.name.split(' ')[0]}!</CardTitle>
              <CardDescription className="text-base">
                A few steps and you will be ready. Fill your profile, take a quick tour, then confirm your details for HR review.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
              <Button className="bg-sky-600 hover:bg-sky-700" onClick={() => setStep('profile')}>
                Get started <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        )}

        {step === 'profile' && (
          <Card>
            <CardHeader>
              <CardTitle>Your profile</CardTitle>
              <CardDescription>
                Fields marked * are required. PAN, Aadhaar and bank details can only be changed by HR once saved.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
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

              <div className="flex items-center gap-4">
                <Avatar className="size-16">
                  <AvatarImage src={form.profilePicture || undefined} alt={form.name} />
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  disabled={uploadingPhoto}
                  onClick={() => photoRef.current?.click()}
                >
                  <Camera className="h-4 w-4" />
                  {uploadingPhoto ? 'Uploading…' : 'Upload photo'}
                </Button>
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
                  />
                </div>
              </div>

              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-t pt-4">
                Identity & bank
              </p>
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
                  />
                </div>
              </div>

              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-t pt-4">
                Documents
              </p>
              <div className="space-y-2">
                {DOC_FIELDS.map((doc) => {
                  const url = form[doc.key]
                  const isUploading = uploadingDoc === doc.key
                  return (
                    <div
                      key={doc.key}
                      className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium flex items-center gap-1.5">
                          <FileUp className="h-3.5 w-3.5 text-muted-foreground" />
                          {doc.label}
                        </p>
                        {url ? (
                          <a
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-sky-600 hover:underline truncate block mt-0.5"
                          >
                            Uploaded — view
                          </a>
                        ) : (
                          <p className="text-xs text-muted-foreground mt-0.5">Not uploaded</p>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1.5 shrink-0 text-xs"
                        disabled={!!isUploading}
                        onClick={() => {
                          setPendingDocKey(doc.key)
                          docFileRef.current?.click()
                        }}
                      >
                        <Upload className="h-3.5 w-3.5" />
                        {isUploading ? 'Uploading…' : url ? 'Replace' : 'Upload'}
                      </Button>
                    </div>
                  )
                })}
              </div>

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between pt-2">
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
              <div className="mt-6 flex justify-start">
                <Button variant="outline" onClick={() => setStep('profile')}>
                  <ArrowLeft className="mr-1 h-4 w-4" /> Back
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 'preview' && (
          <Card>
            <CardHeader>
              <CardTitle>Review & confirm</CardTitle>
              <CardDescription>
                Double-check everything below. Submitting sends this to HR for approval.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 rounded-xl border p-4 bg-muted/20">
                <PreviewRow label="Name" value={form.name} />
                <PreviewRow label="Email" value={profile?.user.email ?? user.email} />
                <PreviewRow label="Phone" value={form.phoneNumber} />
                <PreviewRow label="Employee code" value={profile?.employee?.employeeCode} />
                <PreviewRow label="Department" value={profile?.employee?.department?.name} />
                <PreviewRow label="Date of birth" value={form.dateOfBirth || undefined} />
                <PreviewRow label="Aadhaar" value={form.aadharNumber ? `••••${form.aadharNumber.slice(-4)}` : undefined} />
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
                <PreviewRow label="Emergency contact" value={[form.emergencyContactName, form.emergencyContactPhone].filter(Boolean).join(' · ') || undefined} />
                <PreviewRow label="Address" value={form.address || undefined} />
              </div>

              <div className="rounded-xl border p-4 space-y-2">
                <p className="text-sm font-medium">Documents</p>
                <div className="flex flex-wrap gap-2">
                  {DOC_FIELDS.map((doc) => (
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
                      {doc.label.replace(' (optional)', '')}
                    </span>
                  ))}
                </div>
              </div>

              <label className="flex items-start gap-3 rounded-xl border p-4 cursor-pointer">
                <Checkbox
                  checked={acknowledged}
                  onCheckedChange={(v) => setAcknowledged(v === true)}
                  className="mt-0.5"
                />
                <span className="text-sm leading-relaxed">
                  I confirm that the profile details and documents above are accurate. I understand HR will review and approve my account before I can use the workspace.
                </span>
              </label>

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between pt-2">
                <Button variant="outline" onClick={() => setStep('tour')}>
                  <ArrowLeft className="mr-1 h-4 w-4" /> Back
                </Button>
                <Button
                  className="bg-violet-600 hover:bg-violet-700"
                  disabled={!acknowledged || completeMutation.isPending || saveMutation.isPending}
                  onClick={handleSubmit}
                >
                  {completeMutation.isPending ? 'Submitting…' : 'Submit for HR approval'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

function PreviewRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium mt-0.5 break-words">{value?.trim() || '—'}</p>
    </div>
  )
}
