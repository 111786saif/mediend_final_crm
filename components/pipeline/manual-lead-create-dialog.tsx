'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Loader2, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { apiGet, apiPost } from '@/lib/api-client'
import {
  formatDateTimeLocalValue,
  getLeadDateInputMaxValue,
  isLeadDateAfterToday,
  LEAD_DATE_FUTURE_ERROR,
} from '@/lib/lead-date-validation'
import {
  formatLeadAssigneeName,
  formatLeadAssigneeRoleLabel,
} from '@/lib/lead-assignee-display'
import {
  CRM_LEAD_STATUS_OPTIONS,
  CRM_MODE_OF_PAYMENT_OPTIONS,
} from '@/lib/lead-status-options'

type ManualLeadAssignableUser = {
  id: string
  name: string
  email: string
  role: string
}

type ManualLeadMasterItem = {
  id: string
  name: string
  isActive?: boolean
}

type ManualLeadSourceMaster = ManualLeadMasterItem & {
  sourceId: string
  cpl?: number | null
  source: {
    id: string
    name: string
    isActive?: boolean
  }
}

type ManualLeadTreatmentMaster = ManualLeadMasterItem & {
  category: string
}

type ManualLeadCreateOptionsResponse = {
  assignableUsers: ManualLeadAssignableUser[]
  masters: {
    sources: ManualLeadMasterItem[]
    leadSources: ManualLeadSourceMaster[]
    circles: ManualLeadMasterItem[]
    treatmentCategories: ManualLeadMasterItem[]
    treatments: ManualLeadTreatmentMaster[]
    hospitals: ManualLeadMasterItem[]
    insurance: ManualLeadMasterItem[]
  }
}

type ManualLeadCreatePayload = {
  assignToUserId: string
  leadDate: string
  patientName: string
  phoneNumber: string
  alternateNumber?: string
  patientEmail?: string
  age?: number
  sex?: string
  profession?: string
  circle?: string
  category?: string
  treatmentMasterId?: string
  hospitalName?: string
  insuranceName?: string
  source?: string
  leadSource?: string
  status?: string
  modeOfPayment?: string
  remarks?: string
}

type ManualLeadCreateResult = {
  id: string
  leadRef: string
}

function normalizeOptionalText(value: string) {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function createInitialFormValues() {
  return {
    assignToUserId: '',
    leadDate: formatDateTimeLocalValue(new Date()),
    patientName: '',
    phoneNumber: '',
    alternateNumber: '',
    patientEmail: '',
    age: '',
    sex: 'Not Specified',
    profession: '',
    circle: '',
    category: '',
    treatmentMasterId: '',
    hospitalName: '',
    insuranceName: '',
    source: '',
    leadSource: '',
    status: 'New Lead',
    modeOfPayment: '',
    remarks: '',
  }
}

export function ManualLeadCreateDialog({
  currentUserId,
  open,
  onOpenChange,
  onCreated,
}: {
  currentUserId?: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (lead: ManualLeadCreateResult) => Promise<void> | void
}) {
  const [formValues, setFormValues] = useState(createInitialFormValues)

  const { data, isLoading, isFetching, error } = useQuery<ManualLeadCreateOptionsResponse, Error>({
    queryKey: ['pipeline-manual-lead-create-options'],
    queryFn: () => apiGet<ManualLeadCreateOptionsResponse>('/api/leads/manual-create/options'),
    enabled: open,
    staleTime: 5 * 60_000,
    retry: false,
  })

  const assignableUsers = useMemo(() => data?.assignableUsers ?? [], [data?.assignableUsers])
  const sourceOptions = useMemo(
    () => (data?.masters.sources ?? []).filter((item) => item.isActive !== false),
    [data?.masters.sources]
  )
  const leadSourceOptions = useMemo(() => {
    const base = (data?.masters.leadSources ?? []).filter((item) => item.isActive !== false)
    if (!formValues.source) return base
    return base.filter((item) => item.source.name === formValues.source)
  }, [data?.masters.leadSources, formValues.source])
  const circleOptions = useMemo(
    () => (data?.masters.circles ?? []).filter((item) => item.isActive !== false),
    [data?.masters.circles]
  )
  const categoryOptions = useMemo(
    () => (data?.masters.treatmentCategories ?? []).filter((item) => item.isActive !== false),
    [data?.masters.treatmentCategories]
  )
  const treatmentOptions = useMemo(() => {
    const base = (data?.masters.treatments ?? []).filter((item) => item.isActive !== false)
    if (!formValues.category) return base
    return base.filter((item) => item.category === formValues.category)
  }, [data?.masters.treatments, formValues.category])
  const hospitalOptions = useMemo(() => data?.masters.hospitals ?? [], [data?.masters.hospitals])
  const insuranceOptions = useMemo(() => data?.masters.insurance ?? [], [data?.masters.insurance])

  const effectiveAssignToUserId = useMemo(() => {
    if (formValues.assignToUserId) return formValues.assignToUserId
    const selfAssignee = currentUserId
      ? assignableUsers.find((user) => user.id === currentUserId)
      : null
    return selfAssignee?.id ?? assignableUsers[0]?.id ?? ''
  }, [assignableUsers, currentUserId, formValues.assignToUserId])

  const effectiveTreatmentMasterId = useMemo(() => {
    if (!formValues.treatmentMasterId) return ''
    return treatmentOptions.some((item) => item.id === formValues.treatmentMasterId)
      ? formValues.treatmentMasterId
      : ''
  }, [formValues.treatmentMasterId, treatmentOptions])

  const effectiveLeadSource = useMemo(() => {
    if (!formValues.leadSource) return ''
    return leadSourceOptions.some((item) => item.name === formValues.leadSource)
      ? formValues.leadSource
      : ''
  }, [formValues.leadSource, leadSourceOptions])

  const mutation = useMutation({
    mutationFn: (payload: ManualLeadCreatePayload) =>
      apiPost<ManualLeadCreateResult>('/api/leads/manual-create', payload),
    onSuccess: async (lead) => {
      toast.success(`Lead ${lead.leadRef} created successfully`)
      setFormValues(createInitialFormValues())
      onOpenChange(false)
      await onCreated(lead)
    },
    onError: (mutationError: Error) => {
      toast.error(mutationError.message || 'Failed to create lead')
    },
  })

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setFormValues(createInitialFormValues())
    }
    onOpenChange(nextOpen)
  }

  async function handleSubmit() {
    const parsedLeadDate = new Date(formValues.leadDate)
    if (Number.isNaN(parsedLeadDate.getTime())) {
      toast.error('Lead date is invalid')
      return
    }

    if (isLeadDateAfterToday(parsedLeadDate)) {
      toast.error(LEAD_DATE_FUTURE_ERROR)
      return
    }

    const payload: ManualLeadCreatePayload = {
      assignToUserId: effectiveAssignToUserId,
      leadDate: formValues.leadDate,
      patientName: formValues.patientName.trim(),
      phoneNumber: formValues.phoneNumber.trim(),
      ...(normalizeOptionalText(formValues.alternateNumber)
        ? { alternateNumber: formValues.alternateNumber.trim() }
        : {}),
      ...(normalizeOptionalText(formValues.patientEmail)
        ? { patientEmail: formValues.patientEmail.trim() }
        : {}),
      ...(normalizeOptionalText(formValues.age) ? { age: Number(formValues.age) } : {}),
      ...(normalizeOptionalText(formValues.sex) ? { sex: formValues.sex.trim() } : {}),
      ...(normalizeOptionalText(formValues.profession)
        ? { profession: formValues.profession.trim() }
        : {}),
      ...(normalizeOptionalText(formValues.circle) ? { circle: formValues.circle } : {}),
      ...(normalizeOptionalText(formValues.category) ? { category: formValues.category } : {}),
      ...(normalizeOptionalText(effectiveTreatmentMasterId)
        ? { treatmentMasterId: effectiveTreatmentMasterId }
        : {}),
      ...(normalizeOptionalText(formValues.hospitalName)
        ? { hospitalName: formValues.hospitalName }
        : {}),
      ...(normalizeOptionalText(formValues.insuranceName)
        ? { insuranceName: formValues.insuranceName }
        : {}),
      ...(normalizeOptionalText(formValues.source) ? { source: formValues.source } : {}),
      ...(normalizeOptionalText(effectiveLeadSource) ? { leadSource: effectiveLeadSource } : {}),
      ...(normalizeOptionalText(formValues.status) ? { status: formValues.status } : {}),
      ...(normalizeOptionalText(formValues.modeOfPayment)
        ? { modeOfPayment: formValues.modeOfPayment }
        : {}),
      ...(normalizeOptionalText(formValues.remarks) ? { remarks: formValues.remarks.trim() } : {}),
    }

    await mutation.mutateAsync(payload)
  }

  const isSubmitDisabled =
    mutation.isPending ||
    isLoading ||
    isFetching ||
    effectiveAssignToUserId.trim().length === 0 ||
    formValues.leadDate.trim().length === 0 ||
    formValues.patientName.trim().length === 0 ||
    formValues.phoneNumber.trim().length === 0

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[88vh] min-h-0 flex-col overflow-hidden p-0 sm:max-w-5xl">
        <DialogHeader className="border-b px-6 py-5">
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Create Manual Lead
          </DialogTitle>
          <DialogDescription>
            This creates a lead directly in CRM and assigns it immediately. It does not create an
            incoming lead record and does not run campaign assignment rules.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {error ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error.message || 'Failed to load manual lead creation options'}
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="manual-lead-date">Lead date</Label>
              <Input
                id="manual-lead-date"
                type="datetime-local"
                value={formValues.leadDate}
                onChange={(event) =>
                  setFormValues((current) => ({ ...current, leadDate: event.target.value }))
                }
                max={getLeadDateInputMaxValue()}
                disabled={mutation.isPending}
              />
              <p className="text-xs text-muted-foreground">
                Only today or older dates are allowed. This updates lead date only.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="manual-lead-assign-to">Assign to</Label>
              <Select
                value={effectiveAssignToUserId}
                onValueChange={(value) =>
                  setFormValues((current) => ({ ...current, assignToUserId: value }))
                }
                disabled={mutation.isPending || isLoading || assignableUsers.length === 0}
              >
                <SelectTrigger id="manual-lead-assign-to">
                  <SelectValue placeholder="Select assignee" />
                </SelectTrigger>
                <SelectContent>
                  {assignableUsers.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {formatLeadAssigneeName(user.name, user.email)}
                      {formatLeadAssigneeRoleLabel(user.role)
                        ? ` (${formatLeadAssigneeRoleLabel(user.role)})`
                        : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="manual-lead-patient-name">Patient name</Label>
              <Input
                id="manual-lead-patient-name"
                value={formValues.patientName}
                onChange={(event) =>
                  setFormValues((current) => ({ ...current, patientName: event.target.value }))
                }
                placeholder="Enter patient name"
                disabled={mutation.isPending}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="manual-lead-phone">Phone number</Label>
              <Input
                id="manual-lead-phone"
                value={formValues.phoneNumber}
                onChange={(event) =>
                  setFormValues((current) => ({ ...current, phoneNumber: event.target.value }))
                }
                placeholder="10-digit mobile number"
                disabled={mutation.isPending}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="manual-lead-alt-phone">Alternate number</Label>
              <Input
                id="manual-lead-alt-phone"
                value={formValues.alternateNumber}
                onChange={(event) =>
                  setFormValues((current) => ({ ...current, alternateNumber: event.target.value }))
                }
                placeholder="Optional alternate number"
                disabled={mutation.isPending}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="manual-lead-email">Patient email</Label>
              <Input
                id="manual-lead-email"
                type="email"
                value={formValues.patientEmail}
                onChange={(event) =>
                  setFormValues((current) => ({ ...current, patientEmail: event.target.value }))
                }
                placeholder="Optional patient email"
                disabled={mutation.isPending}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="manual-lead-age">Age</Label>
              <Input
                id="manual-lead-age"
                type="number"
                min="0"
                max="120"
                value={formValues.age}
                onChange={(event) =>
                  setFormValues((current) => ({ ...current, age: event.target.value }))
                }
                placeholder="0 to 120"
                disabled={mutation.isPending}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="manual-lead-sex">Sex</Label>
              <Select
                value={formValues.sex}
                onValueChange={(value) =>
                  setFormValues((current) => ({ ...current, sex: value }))
                }
                disabled={mutation.isPending}
              >
                <SelectTrigger id="manual-lead-sex">
                  <SelectValue placeholder="Select sex" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                  <SelectItem value="Not Specified">Not Specified</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="manual-lead-circle">Circle</Label>
              <Select
                value={formValues.circle || '__none__'}
                onValueChange={(value) =>
                  setFormValues((current) => ({
                    ...current,
                    circle: value === '__none__' ? '' : value,
                  }))
                }
                disabled={mutation.isPending || isLoading}
              >
                <SelectTrigger id="manual-lead-circle">
                  <SelectValue placeholder="Select circle" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {circleOptions.map((item) => (
                    <SelectItem key={item.id} value={item.name}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="manual-lead-profession">Profession</Label>
              <Input
                id="manual-lead-profession"
                value={formValues.profession}
                onChange={(event) =>
                  setFormValues((current) => ({ ...current, profession: event.target.value }))
                }
                placeholder="Optional profession"
                disabled={mutation.isPending}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="manual-lead-category">Category</Label>
              <Select
                value={formValues.category || '__none__'}
                onValueChange={(value) =>
                  setFormValues((current) => ({
                    ...current,
                    category: value === '__none__' ? '' : value,
                    treatmentMasterId: '',
                  }))
                }
                disabled={mutation.isPending || isLoading}
              >
                <SelectTrigger id="manual-lead-category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {categoryOptions.map((item) => (
                    <SelectItem key={item.id} value={item.name}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="manual-lead-treatment">Treatment</Label>
              <Select
                value={effectiveTreatmentMasterId || '__none__'}
                onValueChange={(value) =>
                  setFormValues((current) => ({
                    ...current,
                    treatmentMasterId: value === '__none__' ? '' : value,
                  }))
                }
                disabled={mutation.isPending || isLoading}
              >
                <SelectTrigger id="manual-lead-treatment">
                  <SelectValue placeholder="Select treatment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {treatmentOptions.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="manual-lead-source">Source</Label>
              <Select
                value={formValues.source || '__none__'}
                onValueChange={(value) =>
                  setFormValues((current) => ({
                    ...current,
                    source: value === '__none__' ? '' : value,
                    leadSource: '',
                  }))
                }
                disabled={mutation.isPending || isLoading}
              >
                <SelectTrigger id="manual-lead-source">
                  <SelectValue placeholder="Select source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {sourceOptions.map((item) => (
                    <SelectItem key={item.id} value={item.name}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="manual-lead-lead-source">Lead source</Label>
              <Select
                value={effectiveLeadSource || '__none__'}
                onValueChange={(value) =>
                  setFormValues((current) => ({
                    ...current,
                    leadSource: value === '__none__' ? '' : value,
                  }))
                }
                disabled={mutation.isPending || isLoading}
              >
                <SelectTrigger id="manual-lead-lead-source">
                  <SelectValue placeholder="Select lead source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {leadSourceOptions.map((item) => (
                    <SelectItem key={item.id} value={item.name}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="manual-lead-status">Lead status</Label>
              <Select
                value={formValues.status}
                onValueChange={(value) =>
                  setFormValues((current) => ({ ...current, status: value }))
                }
                disabled={mutation.isPending}
              >
                <SelectTrigger id="manual-lead-status">
                  <SelectValue placeholder="Select lead status" />
                </SelectTrigger>
                <SelectContent>
                  {CRM_LEAD_STATUS_OPTIONS.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="manual-lead-mop">Mode of payment</Label>
              <Select
                value={formValues.modeOfPayment || '__none__'}
                onValueChange={(value) =>
                  setFormValues((current) => ({
                    ...current,
                    modeOfPayment: value === '__none__' ? '' : value,
                  }))
                }
                disabled={mutation.isPending}
              >
                <SelectTrigger id="manual-lead-mop">
                  <SelectValue placeholder="Select mode of payment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {CRM_MODE_OF_PAYMENT_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="manual-lead-hospital">Hospital</Label>
              <Select
                value={formValues.hospitalName || '__none__'}
                onValueChange={(value) =>
                  setFormValues((current) => ({
                    ...current,
                    hospitalName: value === '__none__' ? '' : value,
                  }))
                }
                disabled={mutation.isPending || isLoading}
              >
                <SelectTrigger id="manual-lead-hospital">
                  <SelectValue placeholder="Select hospital" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {hospitalOptions.map((item) => (
                    <SelectItem key={item.id} value={item.name}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="manual-lead-insurance">Insurance</Label>
              <Select
                value={formValues.insuranceName || '__none__'}
                onValueChange={(value) =>
                  setFormValues((current) => ({
                    ...current,
                    insuranceName: value === '__none__' ? '' : value,
                  }))
                }
                disabled={mutation.isPending || isLoading}
              >
                <SelectTrigger id="manual-lead-insurance">
                  <SelectValue placeholder="Select insurance" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {insuranceOptions.map((item) => (
                    <SelectItem key={item.id} value={item.name}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="manual-lead-remarks">Remarks</Label>
              <Textarea
                id="manual-lead-remarks"
                value={formValues.remarks}
                onChange={(event) =>
                  setFormValues((current) => ({ ...current, remarks: event.target.value }))
                }
                placeholder="Add initial remark if needed"
                rows={3}
                disabled={mutation.isPending}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="shrink-0 border-t bg-background px-6 py-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={isSubmitDisabled}>
            {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Create lead
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
