'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useMutation } from '@tanstack/react-query'
import { apiPatch, apiPost } from '@/lib/api-client'
import { useState, useRef } from 'react'
import { Camera, Plus, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ProfileUser {
  id: string
  name: string
  email: string
  role: string
  teamId: string | null
  phoneNumber: string | null
  address: string | null
  profilePicture: string | null
}

export interface ProfileEmployee {
  id: string
  employeeCode: string
  joinDate: Date | null
  dateOfBirth: Date | null
  designation: string | null
  panNumber: string | null
  aadharNumber: string | null
  uanNumber: string | null
  bankAccountName: string | null
  bankAccountNumber: string | null
  ifscCode: string | null
  aadharDocUrl?: string | null
  panDocUrl?: string | null
  department: {
    id: string
    name: string
    description: string | null
  } | null
}

export interface ProfileData {
  user: ProfileUser
  employee: ProfileEmployee | null
}

interface PastEmployer {
  id: string
  companyName: string
  designation: string
  fromDate: string
  toDate: string
  reasonForLeaving: string
  referenceContact: string
}

interface EditProfileDialogProps {
  profile: ProfileData
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

// ── Dummy past employers (remove when API ready) ───────────────────────────
const INITIAL_PAST_EMPLOYERS: PastEmployer[] = [
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
    referenceContact: '',
  },
]

const OTHER_DOC_TYPES = [
  'Offer Letter',
  'Relieving Letter',
  'Experience Certificate',
  'Educational Certificate',
  'Passport',
  'Driving Licence',
  'Other',
]

// ── Section heading inside dialog ─────────────────────────────────────────────
function DialogSection({ title }: { title: string }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground pt-4 pb-1 border-t">
      {title}
    </p>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export function EditProfileDialog({
  profile,
  isOpen,
  onOpenChange,
  onSuccess,
}: EditProfileDialogProps) {
  const { user, employee } = profile
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  // core form
  const [formData, setFormData] = useState(() => ({
    name: user.name,
    email: user.email,
    phoneNumber: user.phoneNumber ?? '',
    address: user.address ?? '',
    profilePicture: user.profilePicture ?? '',
    panNumber: employee?.panNumber ?? '',
    aadharNumber: employee?.aadharNumber ?? '',
    uanNumber: employee?.uanNumber ?? '',
    bankAccountName: employee?.bankAccountName ?? '',
    bankAccountNumber: employee?.bankAccountNumber ?? '',
    ifscCode: employee?.ifscCode ?? '',
  }))

  // past employers
  const [pastEmployers, setPastEmployers] = useState<PastEmployer[]>(INITIAL_PAST_EMPLOYERS)

  // other doc upload state (label → file name, dummy)
  const [otherDocUploads, setOtherDocUploads] = useState<Record<string, string>>({})
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null)
  const otherDocFileRef = useRef<HTMLInputElement>(null)
  const [pendingDocType, setPendingDocType] = useState<string | null>(null)

  const panLocked = !!(employee?.panNumber)
  const aadharLocked = !!(employee?.aadharNumber)
  const uanLocked = !!(employee?.uanNumber)
  const bankLocked =
    !!(employee?.bankAccountName) ||
    !!(employee?.bankAccountNumber) ||
    !!(employee?.ifscCode)

  // ── Photo upload ─────────────────────────────────────────────────────────
  const uploadPhoto = async (file: File) => {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await apiPost<{ url: string }>('/api/profile/upload', fd)
      if (res?.url) {
        setFormData((p) => ({ ...p, profilePicture: res.url }))
        toast.success('Photo uploaded')
      }
    } catch {
      toast.error('Upload failed')
    } finally {
      setUploading(false)
    }
  }

  // ── Other doc upload (dummy — replace with real endpoint) ────────────────
  const handleOtherDocUpload = (docType: string) => {
    setPendingDocType(docType)
    otherDocFileRef.current?.click()
  }

  const onOtherDocFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !pendingDocType) return
    setUploadingDoc(pendingDocType)
    try {
      // TODO: replace with real upload API call
      await new Promise((r) => setTimeout(r, 800))
      setOtherDocUploads((p) => ({ ...p, [pendingDocType]: file.name }))
      toast.success(`${pendingDocType} uploaded`)
    } catch {
      toast.error('Upload failed')
    } finally {
      setUploadingDoc(null)
      setPendingDocType(null)
      e.target.value = ''
    }
  }

  // ── Past employer helpers ─────────────────────────────────────────────────
  const addPastEmployer = () => {
    setPastEmployers((p) => [
      ...p,
      {
        id: Date.now().toString(),
        companyName: '',
        designation: '',
        fromDate: '',
        toDate: '',
        reasonForLeaving: '',
        referenceContact: '',
      },
    ])
  }

  const removePastEmployer = (id: string) => {
    setPastEmployers((p) => p.filter((e) => e.id !== id))
  }

  const updatePastEmployer = (id: string, field: keyof PastEmployer, value: string) => {
    setPastEmployers((p) => p.map((e) => (e.id === id ? { ...e, [field]: value } : e)))
  }

  // ── Main mutation ─────────────────────────────────────────────────────────
  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => apiPatch('/api/profile', data),
    onSuccess: () => {
      toast.success('Profile updated')
      onOpenChange(false)
      onSuccess()
    },
    onError: (e: Error) => toast.error(e.message || 'Update failed'),
  })

  const handleOpenChange = (open: boolean) => {
    onOpenChange(open)
    if (open) {
      setFormData({
        name: user.name,
        email: user.email,
        phoneNumber: user.phoneNumber ?? '',
        address: user.address ?? '',
        profilePicture: user.profilePicture ?? '',
        panNumber: employee?.panNumber ?? '',
        aadharNumber: employee?.aadharNumber ?? '',
        uanNumber: employee?.uanNumber ?? '',
        bankAccountName: employee?.bankAccountName ?? '',
        bankAccountNumber: employee?.bankAccountNumber ?? '',
        ifscCode: employee?.ifscCode ?? '',
      })
      setPastEmployers(INITIAL_PAST_EMPLOYERS)
      setOtherDocUploads({})
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const payload: Record<string, unknown> = {
      name: formData.name,
      email: formData.email,
      phoneNumber: formData.phoneNumber || null,
      address: formData.address || null,
      profilePicture: formData.profilePicture || null,
      pastEmployers: pastEmployers.filter((e) => e.companyName.trim()),
    }
    if (employee) {
      if (!panLocked) payload.panNumber = formData.panNumber || null
      if (!aadharLocked) payload.aadharNumber = formData.aadharNumber || null
      if (!uanLocked) payload.uanNumber = formData.uanNumber || null
      if (!bankLocked) {
        payload.bankAccountName = formData.bankAccountName || null
        payload.bankAccountNumber = formData.bankAccountNumber || null
        payload.ifscCode = formData.ifscCode || null
      }
    }
    mutation.mutate(payload)
  }

  const initials = formData.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit profile</DialogTitle>
          <DialogDescription>
            PAN, Aadhar, UAN and bank details can only be changed by HR once saved.
          </DialogDescription>
        </DialogHeader>

        {/* hidden file inputs */}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && uploadPhoto(e.target.files[0])}
        />
        <input
          ref={otherDocFileRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          className="hidden"
          onChange={onOtherDocFileChange}
        />

        <div className="space-y-4">
          {/* ── Photo ── */}
          <div className="flex items-center gap-4">
            <Avatar className="size-16">
              <AvatarImage src={formData.profilePicture || undefined} alt={formData.name} />
              <AvatarFallback className="text-lg">{initials}</AvatarFallback>
            </Avatar>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="gap-2"
            >
              <Camera className="size-4" />
              {uploading ? 'Uploading…' : 'Change photo'}
            </Button>
          </div>

          {/* ── Basic info ── */}
          <div className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                required
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, email: e.target.value.toLowerCase().trim() }))
                }
                required
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>Phone</Label>
              <Input
                value={formData.phoneNumber}
                onChange={(e) => setFormData((p) => ({ ...p, phoneNumber: e.target.value }))}
                placeholder="+91 98765 43210"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>Address</Label>
              <Input
                value={formData.address}
                onChange={(e) => setFormData((p) => ({ ...p, address: e.target.value }))}
                placeholder="Your address"
                className="mt-1.5"
              />
            </div>
          </div>

          {/* ── Identity & bank ── */}
          {employee && (
            <>
              <DialogSection title="Identity & bank (first-time only)" />
              <div className="space-y-3">
                <div>
                  <Label>PAN</Label>
                  <Input
                    value={formData.panNumber}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, panNumber: e.target.value.toUpperCase() }))
                    }
                    placeholder="ABCDE1234F"
                    maxLength={10}
                    disabled={panLocked}
                    className="mt-1.5 font-mono"
                  />
                  {panLocked && (
                    <p className="text-xs text-muted-foreground mt-1">Contact HR to update</p>
                  )}
                </div>
                <div>
                  <Label>Aadhar</Label>
                  <Input
                    value={formData.aadharNumber}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        aadharNumber: e.target.value.replace(/\D/g, '').slice(0, 12),
                      }))
                    }
                    placeholder="12 digits"
                    maxLength={12}
                    disabled={aadharLocked}
                    className="mt-1.5 font-mono"
                  />
                  {aadharLocked && (
                    <p className="text-xs text-muted-foreground mt-1">Contact HR to update</p>
                  )}
                </div>
                <div>
                  <Label>UAN</Label>
                  <Input
                    value={formData.uanNumber}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        uanNumber: e.target.value.replace(/\D/g, '').slice(0, 12),
                      }))
                    }
                    placeholder="12 digits"
                    maxLength={12}
                    disabled={uanLocked}
                    className="mt-1.5 font-mono"
                  />
                  {uanLocked && (
                    <p className="text-xs text-muted-foreground mt-1">Contact HR to update</p>
                  )}
                </div>
                <div>
                  <Label>Bank account holder</Label>
                  <Input
                    value={formData.bankAccountName}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, bankAccountName: e.target.value }))
                    }
                    disabled={bankLocked}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label>Account number</Label>
                  <Input
                    value={formData.bankAccountNumber}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        bankAccountNumber: e.target.value.replace(/\D/g, ''),
                      }))
                    }
                    disabled={bankLocked}
                    className="mt-1.5 font-mono"
                  />
                </div>
                <div>
                  <Label>IFSC</Label>
                  <Input
                    value={formData.ifscCode}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, ifscCode: e.target.value.toUpperCase() }))
                    }
                    placeholder="SBIN0001234"
                    maxLength={11}
                    disabled={bankLocked}
                    className="mt-1.5 font-mono"
                  />
                  {bankLocked && (
                    <p className="text-xs text-muted-foreground mt-1">Contact HR to update</p>
                  )}
                </div>
              </div>
            </>
          )}

          {/* ── Past employment ── */}
          <DialogSection title="Past employment" />
          <div className="space-y-3">
            {pastEmployers.map((emp, idx) => (
              <div key={emp.id} className="rounded-xl border bg-muted/30 p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground">
                    Employer {idx + 1}
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7 text-destructive hover:text-destructive"
                    onClick={() => removePastEmployer(emp.id)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Company name</Label>
                    <Input
                      value={emp.companyName}
                      onChange={(e) => updatePastEmployer(emp.id, 'companyName', e.target.value)}
                      placeholder="Company Pvt Ltd"
                      className="mt-1 h-8 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Designation</Label>
                    <Input
                      value={emp.designation}
                      onChange={(e) => updatePastEmployer(emp.id, 'designation', e.target.value)}
                      placeholder="Sales Executive"
                      className="mt-1 h-8 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">From</Label>
                    <Input
                      type="date"
                      value={emp.fromDate}
                      onChange={(e) => updatePastEmployer(emp.id, 'fromDate', e.target.value)}
                      className="mt-1 h-8 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">To</Label>
                    <Input
                      type="date"
                      value={emp.toDate}
                      onChange={(e) => updatePastEmployer(emp.id, 'toDate', e.target.value)}
                      className="mt-1 h-8 text-sm"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label className="text-xs">Reason for leaving</Label>
                    <Input
                      value={emp.reasonForLeaving}
                      onChange={(e) =>
                        updatePastEmployer(emp.id, 'reasonForLeaving', e.target.value)
                      }
                      placeholder="Career growth"
                      className="mt-1 h-8 text-sm"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label className="text-xs">Reference contact</Label>
                    <Input
                      value={emp.referenceContact}
                      onChange={(e) =>
                        updatePastEmployer(emp.id, 'referenceContact', e.target.value)
                      }
                      placeholder="+91 98765 43210"
                      className="mt-1 h-8 text-sm"
                    />
                  </div>
                </div>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addPastEmployer}
              className="w-full gap-2 border-dashed"
            >
              <Plus className="size-4" />
              Add past employer
            </Button>
          </div>

          {/* ── Other documents ── */}
          <DialogSection title="Other documents" />
          <div className="space-y-2">
            {OTHER_DOC_TYPES.map((docType) => {
              const uploaded = otherDocUploads[docType]
              const isUploading = uploadingDoc === docType
              return (
                <div
                  key={docType}
                  className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{docType}</p>
                    {uploaded && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{uploaded}</p>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 px-3 gap-1.5 shrink-0 text-xs"
                    disabled={isUploading}
                    onClick={() => handleOtherDocUpload(docType)}
                  >
                    <Upload className="size-3.5" />
                    {isUploading ? 'Uploading…' : uploaded ? 'Replace' : 'Upload'}
                  </Button>
                </div>
              )
            })}
          </div>

          {/* ── Actions ── */}
          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={mutation.isPending}
              className="flex-1"
            >
              {mutation.isPending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}