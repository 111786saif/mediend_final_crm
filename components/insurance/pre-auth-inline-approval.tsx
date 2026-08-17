'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { PreAuthStatus } from '@/generated/prisma/enums'
import { apiPost, apiGet } from '@/lib/api-client'
import { useQueryClient, useQuery } from '@tanstack/react-query'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { CheckCircle2, XCircle, Clock, Loader2, Hospital, FileText, PauseCircle, PlayCircle } from 'lucide-react'
import { HospitalSuggestionForm } from '@/components/kyp/hospital-suggestion-form'
import { InsuranceInitiateForm } from '@/components/insurance/insurance-initiate-form'
import { InitiateFormCard } from '@/components/insurance/initiate-form-card'
import { useFileUpload } from '@/hooks/use-file-upload'
import { File } from 'lucide-react'

interface PreAuthInlineApprovalProps {
  leadId: string
  kypSubmissionId: string
  lead?: {
    caseStage?: string
    insuranceName?: string | null
    ipdDrName?: string | null
  }
  preAuthData?: {
    id: string
    approvalStatus?: PreAuthStatus
    rejectionReason?: string | null
    rejectionLetterUrl?: string | null
    approvalNotes?: string | null
    approvedAmount?: number | null
    holdReason?: string | null
    heldAt?: string | null
    heldBy?: { id: string; name: string } | null
    isNewHospitalRequest?: boolean
    newHospitalPreAuthRaised?: boolean
    sumInsured?: string | null
    balanceInsured?: string | null
    copay?: string | null
    capping?: string | number | null
    insurance?: string | null
    tpa?: string | null
    hospitalNameSuggestion?: string | null
    hospitalSuggestions?: string[] | null
    requestedHospitalName?: string | null
    requestedRoomType?: string | null
    suggestedHospitals?: Array<{
      hospitalName: string
      tentativeBill?: number | null
      roomRentGeneral?: number | null
      roomRentSingle?: number | null
      roomRentDeluxe?: number | null
      roomRentSemiPrivate?: number | null
      notes?: string | null
    }>
  } | null
  onSuccess?: () => void
}

type ApprovalAction = 'approve' | 'temp_approve' | 'reject' | 'hold' | null

export function PreAuthInlineApproval({
  leadId,
  kypSubmissionId,
  lead,
  preAuthData,
  onSuccess,
}: PreAuthInlineApprovalProps) {
  const [action, setAction] = useState<ApprovalAction>(null)
  const [approvedAmount, setApprovedAmount] = useState(
    preAuthData?.approvedAmount != null ? String(preAuthData.approvedAmount) : ''
  )
  const [approvalNotes, setApprovalNotes] = useState(preAuthData?.approvalNotes || '')
  const [rejectionReason, setRejectionReason] = useState('')
  const [rejectionLetterFile, setRejectionLetterFile] = useState<{ name: string; url: string } | null>(null)
  const [holdReasonInput, setHoldReasonInput] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { uploadFile, uploading: uploadUploading } = useFileUpload()
  const [showHospitalForm, setShowHospitalForm] = useState(false)
  const [showInitiateForm, setShowInitiateForm] = useState(false)

  const queryClient = useQueryClient()
  const searchParams = useSearchParams()

  const { data: initiateFormData } = useQuery<any>({
    queryKey: ['insurance-initiate-form', leadId],
    queryFn: () => apiGet<any>(`/api/insurance-initiate-form?leadId=${leadId}`),
    enabled: !!leadId,
  })

  const isNewHospital = preAuthData?.isNewHospitalRequest === true
  const newHospitalMarked = preAuthData?.newHospitalPreAuthRaised === true
  const showMarkNewHospitalFirst = isNewHospital && !newHospitalMarked

  const isPreAuthRaised = 
    lead?.caseStage === 'PREAUTH_RAISED' || 
    lead?.caseStage === 'PREAUTH_COMPLETE' ||
    lead?.caseStage === 'INITIATED' ||
    lead?.caseStage === 'ADMITTED' ||
    lead?.caseStage === 'DISCHARGED'

  const isFullyProcessed =
    (preAuthData?.approvalStatus === PreAuthStatus.APPROVED ||
     preAuthData?.approvalStatus === PreAuthStatus.REJECTED) &&
    isPreAuthRaised

  const isTempApproved =
    preAuthData?.approvalStatus === PreAuthStatus.TEMP_APPROVED &&
    isPreAuthRaised
  const isOnHold = preAuthData?.approvalStatus === PreAuthStatus.ON_HOLD

  const initiateForm = initiateFormData?.initiateForm
  const isInitiateFormFilled =
    initiateForm &&
    initiateForm.totalBillAmount != null &&
    initiateForm.totalBillAmount > 0 &&
    initiateForm.copay !== null &&
    typeof initiateForm.copay === 'number'

  const hasHospitalSuggestions =
    (preAuthData?.suggestedHospitals && preAuthData.suggestedHospitals.length > 0) || false

  const hasLegacyHospitals =
    (preAuthData?.hospitalSuggestions &&
      (preAuthData.hospitalSuggestions as string[]).length > 0) ||
    preAuthData?.hospitalNameSuggestion

  const hasAnyHospitalData = hasHospitalSuggestions || !!hasLegacyHospitals
  const isLocked = 
    lead?.caseStage === 'PREAUTH_COMPLETE' ||
    lead?.caseStage === 'INITIATED' ||
    lead?.caseStage === 'ADMITTED' ||
    lead?.caseStage === 'DISCHARGED'

  const shouldForceHospitalForm = !hasAnyHospitalData

  useEffect(() => {
    // Show if query param is present
    if (searchParams.get('initiate') === 'true') {
      setShowInitiateForm(true)
    }
    // Show by default if in raised/complete stage AND form is not filled
    else if (isPreAuthRaised && !isInitiateFormFilled && initiateFormData) {
      setShowInitiateForm(true)
    }
  }, [searchParams, isPreAuthRaised, isInitiateFormFilled, !!initiateFormData])

  // ─── Handlers ────────────────────────────────────────────────────────────────

  const handleApprove = async (status: 'APPROVED' | 'TEMP_APPROVED', payload?: { approvedAmount: number; approvalNotes?: string }) => {
    if (!hasAnyHospitalData) {
      toast.error('Please suggest hospitals before approving')
      return
    }
    if (status === 'APPROVED' && !isInitiateFormFilled) {
      toast.error('Please fill the Insurance Initial Form before giving full approval')
      return
    }
    // Amount and notes required only for temporary approval
    if (status === 'TEMP_APPROVED') {
      if (!approvedAmount || isNaN(Number(approvedAmount)) || Number(approvedAmount) < 0) {
        toast.error('Please enter a valid approved amount')
        return
      }
    }

    // Full approval: use Total Authorized Amount from initiate form; temp approval: use form input
    const approvedAmountToSend = payload?.approvedAmount ?? (
      status === 'TEMP_APPROVED'
        ? Number(approvedAmount)
        : (Number(initiateForm?.totalAuthorizedAmount) || 0)
    )
    const approvalNotesToSend = payload?.approvalNotes ?? (status === 'TEMP_APPROVED' ? approvalNotes.trim() || undefined : undefined)

    setIsSubmitting(true)
    try {
      await apiPost(`/api/pre-auth/${kypSubmissionId}/approve`, {
        approvalStatus: status,
        approvedAmount: approvedAmountToSend,
        approvalNotes: approvalNotesToSend,
      })
      const label = status === 'TEMP_APPROVED' ? 'temporarily approved' : 'approved'
      toast.success(`Pre-authorization ${label} successfully`)
      queryClient.invalidateQueries({ queryKey: ['leads', 'insurance'] })
      queryClient.invalidateQueries({ queryKey: ['lead', leadId] })
      queryClient.invalidateQueries({ queryKey: ['kyp-submission', leadId] })
      setAction(null)
      onSuccess?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to approve pre-auth')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleFullApprovalConfirm = () => {
    const authorizedAmount = Number(initiateForm?.totalAuthorizedAmount) || 0
    handleApprove('APPROVED', { approvedAmount: authorizedAmount })
  }

  const handleRejectionLetterChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const result = await uploadFile(file)
    if (result) {
      setRejectionLetterFile({ name: file.name, url: result.url })
    }
  }

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      toast.error('Please provide a reason for rejection')
      return
    }
    setIsSubmitting(true)
    try {
      await apiPost(`/api/pre-auth/${kypSubmissionId}/reject`, {
        reason: rejectionReason,
        rejectionLetterUrl: rejectionLetterFile?.url,
        rejectionLetterName: rejectionLetterFile?.name,
      })
      toast.success('Pre-authorization rejected')
      queryClient.invalidateQueries({ queryKey: ['leads', 'insurance'] })
      queryClient.invalidateQueries({ queryKey: ['lead', leadId] })
      queryClient.invalidateQueries({ queryKey: ['kyp-submission', leadId] })
      setAction(null)
      setRejectionReason('')
      setRejectionLetterFile(null)
      onSuccess?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to reject pre-auth')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleHold = async () => {
    const reason = holdReasonInput.trim()
    if (!reason) {
      toast.error('Please provide a reason for the hold')
      return
    }
    setIsSubmitting(true)
    try {
      await apiPost(`/api/pre-auth/${kypSubmissionId}/hold`, { reason })
      toast.success('Pre-auth put on hold')
      queryClient.invalidateQueries({ queryKey: ['leads', 'insurance'] })
      queryClient.invalidateQueries({ queryKey: ['lead', leadId] })
      queryClient.invalidateQueries({ queryKey: ['kyp-submission', leadId] })
      setAction(null)
      setHoldReasonInput('')
      onSuccess?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to hold pre-auth')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleReleaseHold = async () => {
    setIsSubmitting(true)
    try {
      await apiPost(`/api/pre-auth/${kypSubmissionId}/release-hold`, {})
      toast.success('Hold released')
      queryClient.invalidateQueries({ queryKey: ['leads', 'insurance'] })
      queryClient.invalidateQueries({ queryKey: ['lead', leadId] })
      queryClient.invalidateQueries({ queryKey: ['kyp-submission', leadId] })
      onSuccess?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to release hold')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleMarkNewHospitalRaised = async () => {
    setIsSubmitting(true)
    try {
      await apiPost(`/api/pre-auth/${kypSubmissionId}/mark-new-hospital-raised`, {})
      toast.success('Marked pre-auth raised for new hospital')
      queryClient.invalidateQueries({ queryKey: ['kyp-submission', leadId] })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update')
    } finally {
      setIsSubmitting(false)
    }
  }

  // ─── Shared: hospital suggestions list (read-only) ───────────────────────────
  const hospitalSuggestionsJsx = hasAnyHospitalData ? (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Hospital className="w-4 h-4 text-blue-600" />
          Hospital Suggestions Provided
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {preAuthData?.suggestedHospitals?.map((hospital, idx) => (
            <div
              key={idx}
              className={`p-4 rounded-xl border-2 ${
                preAuthData.requestedHospitalName === hospital.hospitalName
                  ? 'border-teal-500 bg-teal-50/30'
                  : 'border-gray-100 dark:border-gray-800'
              }`}
            >
              <div className="font-bold flex justify-between">
                {hospital.hospitalName}
                {preAuthData.requestedHospitalName === hospital.hospitalName && (
                  <Badge className="bg-teal-500">SELECTED</Badge>
                )}
              </div>
              <div className="text-sm mt-2 space-y-1 text-muted-foreground">
                {hospital.tentativeBill && (
                  <p>Tentative Bill: ₹{hospital.tentativeBill.toLocaleString()}</p>
                )}
                <p>
                  Room Rents:{' '}
                  {[
                    hospital.roomRentGeneral != null && `Gen: ₹${hospital.roomRentGeneral.toLocaleString()}`,
                    hospital.roomRentSingle != null && `Single: ₹${hospital.roomRentSingle.toLocaleString()}`,
                    hospital.roomRentDeluxe != null && `Deluxe: ₹${hospital.roomRentDeluxe.toLocaleString()}`,
                    hospital.roomRentSemiPrivate != null && `Semi-Pvt: ₹${hospital.roomRentSemiPrivate.toLocaleString()}`,
                  ]
                    .filter(Boolean)
                    .join(', ') || 'N/A'}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  ) : null

  // ─── Full approval: simple confirm (no amount/notes — those are in the initiate form) ─
  const fullApprovalConfirmJsx = (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <p className="font-medium">Confirm full approval</p>
        <Button variant="ghost" size="sm" onClick={() => setAction(null)}>
          Cancel
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        You have filled the Insurance Initial Form. Confirm to mark pre-authorization as fully approved.
      </p>
      <Button
        onClick={handleFullApprovalConfirm}
        disabled={isSubmitting}
        className="w-full bg-green-600 hover:bg-green-700 text-white"
      >
        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Confirm Approval
      </Button>
    </div>
  )

  // ─── Temporary approval only: form with approved amount + notes ─────────────────
  const tempApprovalDetailJsx = (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <p className="font-medium">Temporary Approval Details</p>
        <Button variant="ghost" size="sm" onClick={() => setAction(null)}>
          Cancel
        </Button>
      </div>

      <div>
        <Label htmlFor="approvedAmount">
          Approved Amount <span className="text-red-500">*</span>
        </Label>
        <div className="relative mt-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
            ₹
          </span>
          <Input
            id="approvedAmount"
            type="number"
            min="0"
            step="0.01"
            value={approvedAmount}
            onChange={(e) => setApprovedAmount(e.target.value)}
            placeholder="0.00"
            className="pl-7"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="approvalNotes">
          Conditions / Notes <span className="text-muted-foreground text-xs">(optional)</span>
        </Label>
        <Textarea
          id="approvalNotes"
          value={approvalNotes}
          onChange={(e) => setApprovalNotes(e.target.value)}
          placeholder="Specify conditions for temporary approval…"
          rows={3}
          className="mt-1"
        />
      </div>

      <Button
        onClick={() => handleApprove('TEMP_APPROVED')}
        disabled={isSubmitting}
        className="w-full bg-amber-500 hover:bg-amber-600 text-white"
      >
        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Confirm Temporary Approval
      </Button>
    </div>
  )

  // ─── On-hold banner (shown during hospital suggestion step AND approval step) ──
  const onHoldBannerJsx = (
    <div className="p-4 rounded-lg border bg-orange-50 border-orange-200 dark:bg-orange-950/30 dark:border-orange-800">
      <div className="flex items-center gap-2">
        <PauseCircle className="h-5 w-5 text-orange-600" />
        <span className="font-medium text-orange-700 dark:text-orange-400">
          Pre-authorization is on hold
        </span>
        <Badge className="bg-orange-500 text-white ml-2">On Hold</Badge>
      </div>
      {preAuthData?.holdReason && (
        <p className="mt-2 text-sm text-orange-800 dark:text-orange-300">
          Reason: {preAuthData.holdReason}
        </p>
      )}
      {preAuthData?.heldBy?.name && (
        <p className="mt-1 text-xs text-muted-foreground">
          Held by {preAuthData.heldBy.name}
        </p>
      )}
      <Button
        variant="outline"
        size="sm"
        onClick={handleReleaseHold}
        disabled={isSubmitting}
        className="mt-3 border-orange-300 text-orange-700 hover:bg-orange-100 dark:border-orange-800 dark:text-orange-300 dark:hover:bg-orange-950/50"
      >
        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlayCircle className="w-4 h-4 mr-2" />}
        Release Hold
      </Button>
    </div>
  )

  // ─── Hold form (remark input + confirm; shared between steps) ──────────────
  const holdFormJsx = (
    <div className="space-y-4 rounded-lg border border-orange-200 dark:border-orange-800 p-4">
      <div className="flex items-center justify-between">
        <p className="font-medium text-orange-700 dark:text-orange-400">Put Pre-Auth On Hold</p>
        <Button variant="ghost" size="sm" onClick={() => { setAction(null); setHoldReasonInput('') }}>
          Cancel
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Use Hold to pause review (e.g. waiting on docs from BD or hospital). BD will be notified
        with the reason. Approving, temp-approving, or rejecting later will automatically clear the hold.
      </p>
      <div>
        <Label htmlFor="holdReason">
          Hold Reason <span className="text-red-500">*</span>
        </Label>
        <Textarea
          id="holdReason"
          placeholder="Why are you holding this pre-auth? (e.g. awaiting investigation reports, hospital query)"
          value={holdReasonInput}
          onChange={(e) => setHoldReasonInput(e.target.value)}
          rows={3}
          className="mt-1"
        />
      </div>
      <Button
        onClick={handleHold}
        disabled={isSubmitting || !holdReasonInput.trim()}
        className="w-full bg-orange-500 hover:bg-orange-600 text-white"
      >
        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {isSubmitting ? 'Holding...' : 'Confirm Hold'}
      </Button>
    </div>
  )

  // ─── 1. Fully processed (APPROVED / REJECTED) — locked read-only ─────────────
  if (isFullyProcessed) {
    const isApproved = preAuthData?.approvalStatus === PreAuthStatus.APPROVED
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="pt-6">
            <div
              className={`p-4 rounded-lg border ${
                isApproved
                  ? 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800'
                  : 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800'
              }`}
            >
              <div className="flex items-center gap-2">
                {isApproved ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-600" />
                )}
                <span
                  className={`font-medium ${
                    isApproved
                      ? 'text-green-700 dark:text-green-400'
                      : 'text-red-700 dark:text-red-400'
                  }`}
                >
                  {isApproved
                    ? 'Pre-authorization has been approved'
                    : 'Pre-authorization has been rejected'}
                </span>
                {isApproved ? (
                  <Badge className="bg-green-600 text-white ml-2">Approved</Badge>
                ) : (
                  <Badge variant="destructive" className="ml-2">Rejected</Badge>
                )}
              </div>
              {isApproved && preAuthData?.approvedAmount != null && (
                <p className="mt-2 text-sm text-muted-foreground">
                  Approved Amount:{' '}
                  <span className="font-semibold">
                    ₹{preAuthData.approvedAmount.toLocaleString()}
                  </span>
                </p>
              )}
              {isApproved && preAuthData?.approvalNotes && (
                <p className="mt-1 text-sm text-muted-foreground">
                  Notes: {preAuthData.approvalNotes}
                </p>
              )}
              {!isApproved && preAuthData?.rejectionReason && (
                <div className="mt-2 space-y-1">
                  <p className="text-sm text-muted-foreground">
                    Reason: {preAuthData.rejectionReason}
                  </p>
                  {preAuthData?.rejectionLetterUrl && (
                    <a
                      href={preAuthData.rejectionLetterUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                    >
                      <File className="h-4 w-4" />
                      Rejection letter
                    </a>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {hospitalSuggestionsJsx}

        {initiateForm && (
          <InitiateFormCard initiateForm={initiateForm} />
        )}
      </div>
    )
  }

  // ─── 2. Temporarily approved — fill initiate form, then confirm full approval ─
  if (isTempApproved) {
    return (
      <div className="space-y-6">
        {/* Status banner */}
        <Card>
          <CardContent className="pt-6">
            <div className="p-4 rounded-lg border bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-amber-600" />
                <span className="font-medium text-amber-700 dark:text-amber-400">
                  Pre-authorization is temporarily approved
                </span>
                <Badge className="bg-amber-500 text-white ml-2">Temp Approved</Badge>
              </div>
              {preAuthData?.approvedAmount != null && (
                <p className="mt-2 text-sm text-muted-foreground">
                  Approved Amount:{' '}
                  <span className="font-semibold">
                    ₹{preAuthData.approvedAmount.toLocaleString()}
                  </span>
                </p>
              )}
              {preAuthData?.approvalNotes && (
                <p className="mt-1 text-sm text-muted-foreground">
                  Conditions: {preAuthData.approvalNotes}
                </p>
              )}
              <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">
                Fill in the Insurance Initial Form below, then give final approval.
              </p>
            </div>
          </CardContent>
        </Card>

        {hospitalSuggestionsJsx}

        {/* Insurance Initiate Form — show readonly card when filled, else editable form (edit disabled for now) */}
        <div className="space-y-4">
          {initiateForm && isInitiateFormFilled ? (
            <InitiateFormCard initiateForm={initiateForm} />
          ) : (
            <InsuranceInitiateForm
              leadId={leadId}
              initialData={initiateFormData?.initiateForm}
              onSuccess={() => {
                queryClient.invalidateQueries({ queryKey: ['insurance-initiate-form', leadId] })
                queryClient.invalidateQueries({ queryKey: ['lead', leadId] })
              }}
              embedded
            />
          )}
        </div>

        {/* Confirm full approval */}
        <Card>
          <CardHeader>
            <CardTitle>Confirm Full Approval</CardTitle>
            <CardDescription>
              Once the Initial Form is filled, confirm full approval to complete Step 4.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isInitiateFormFilled && (
              <p className="text-sm text-amber-600 dark:text-amber-400">
                Fill in the Insurance Initial Form above to enable full approval.
              </p>
            )}
            {action === null && (
              <Button
                onClick={() => setAction('approve')}
                disabled={!isInitiateFormFilled}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Give Full Approval
              </Button>
            )}
            {action === 'approve' && fullApprovalConfirmJsx}
          </CardContent>
        </Card>
      </div>
    )
  }

  // ─── 3. Active — PENDING, awaiting Insurance decision ────────────────────────
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {shouldForceHospitalForm ? 'Suggest Hospitals' : 'Complete Pre-Authorization'}
        </CardTitle>
        <CardDescription>
          {shouldForceHospitalForm
            ? 'Hospital suggestions are required before proceeding with pre-authorization'
            : 'Review hospital suggestions and approve or reject the pre-authorization request'}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* On-hold banner (informational; visible during hospital suggestion step AND approval step) */}
        {isOnHold && onHoldBannerJsx}

        {/* Hospital suggestion form */}
        {(shouldForceHospitalForm || showHospitalForm) && (
          <HospitalSuggestionForm
            kypSubmissionId={kypSubmissionId}
            initialSumInsured={preAuthData?.sumInsured || ''}
            initialBalanceInsured={preAuthData?.balanceInsured || ''}
            initialCopayPercentage={preAuthData?.copay || ''}
            initialCapping={preAuthData?.capping ? Number(preAuthData.capping) : undefined}
            initialInsuranceName={preAuthData?.insurance || lead?.insuranceName || ''}
            initialTpa={preAuthData?.tpa || ''}
            initialDoctorName={lead?.ipdDrName || ''}
            initialHospitals={preAuthData?.suggestedHospitals}
            onSuccess={() => {
              setShowHospitalForm(false)
              queryClient.invalidateQueries({ queryKey: ['kyp-submission', leadId] })
              queryClient.invalidateQueries({ queryKey: ['lead', leadId] })
            }}
            onCancel={shouldForceHospitalForm ? undefined : () => setShowHospitalForm(false)}
          />
        )}

        {/* Hospitals provided — read-only view with modify/lock status */}
        {hasAnyHospitalData && !shouldForceHospitalForm && !showHospitalForm && (
          <div className="space-y-4">
            {/* Suggested hospitals read-only display */}
            {hospitalSuggestionsJsx}

            {/* Modify button only before pre-auth is completed */}
            {!isLocked && (
              <Button onClick={() => setShowHospitalForm(true)} variant="default" size="sm">
                Modify Hospital Suggestions
              </Button>
            )}
            {isLocked && (
              <p className="text-xs text-muted-foreground">
                Hospital suggestions are locked — pre-authorization is complete.
              </p>
            )}
          </div>
        )}

        {/* Hold with remark — available during the hospital suggestion step (before pre-auth is raised) */}
        {!isPreAuthRaised && !isOnHold && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setAction('hold')}
                className="border-orange-300 text-orange-700 hover:bg-orange-50 dark:border-orange-800 dark:text-orange-400 dark:hover:bg-orange-950/40"
              >
                <PauseCircle className="w-4 h-4 mr-2" />
                Hold with Remark
              </Button>
            </div>
            {action === 'hold' && holdFormJsx}
          </div>
        )}

        {/* Approval section — only visible after pre-auth is raised */}
        {hasAnyHospitalData && !showHospitalForm && isPreAuthRaised && (
          <div className="space-y-5 border-t pt-5">
            {showMarkNewHospitalFirst && (
              <Button onClick={handleMarkNewHospitalRaised} disabled={isSubmitting}>
                Mark pre-auth raised for new hospital
              </Button>
            )}

            {/* Insurance Initiate Form — readonly card when saved, else editable form (edit disabled for now) */}
            {showInitiateForm && (
              <div className="space-y-4 rounded-lg border p-4 bg-muted/30">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold">Insurance Initiate Form</h3>
                  <Button variant="ghost" size="sm" onClick={() => { setShowInitiateForm(false) }}>
                    Close
                  </Button>
                </div>
                {initiateForm && isInitiateFormFilled ? (
                  <InitiateFormCard initiateForm={initiateForm} />
                ) : (
                  <InsuranceInitiateForm
                    leadId={leadId}
                    initialData={initiateFormData?.initiateForm}
                    onSuccess={() => {
                      queryClient.invalidateQueries({ queryKey: ['insurance-initiate-form', leadId] })
                      queryClient.invalidateQueries({ queryKey: ['lead', leadId] })
                      setShowInitiateForm(false)
                    }}
                    embedded
                  />
                )}
              </div>
            )}

            {/* Three action buttons */}
            {action === null && (
              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={() => setAction('approve')}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Approve
                </Button>

                <Button
                  onClick={() => setAction('temp_approve')}
                  className="flex-1 bg-amber-500 hover:bg-amber-600 text-white"
                >
                  <Clock className="w-4 h-4 mr-2" />
                  Temporary Approval
                </Button>

                <Button
                  variant="destructive"
                  onClick={() => setAction('reject')}
                  className="flex-1"
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Reject
                </Button>

                {!isOnHold && (
                  <Button
                    variant="outline"
                    onClick={() => setAction('hold')}
                    className="flex-1 border-orange-300 text-orange-700 hover:bg-orange-50 dark:border-orange-800 dark:text-orange-400 dark:hover:bg-orange-950/40"
                  >
                    <PauseCircle className="w-4 h-4 mr-2" />
                    Hold
                  </Button>
                )}

                {isTempApproved && !showInitiateForm && (
                  <Button
                    onClick={() => setShowInitiateForm(true)}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white"
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    {isInitiateFormFilled ? 'View Initial Form' : 'Fill Initial Form'}
                  </Button>
                )}
              </div>
            )}


            {/* Approve detail form */}
            {action === 'approve' && fullApprovalConfirmJsx}

            {/* Temp approve detail form */}
            {action === 'temp_approve' && tempApprovalDetailJsx}

            {/* Hold form */}
            {action === 'hold' && holdFormJsx}

            {/* Reject form */}
            {action === 'reject' && (
              <div className="space-y-4 rounded-lg border border-red-200 dark:border-red-800 p-4">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-red-700 dark:text-red-400">Rejection Details</p>
                  <Button variant="ghost" size="sm" onClick={() => setAction(null)}>
                    Cancel
                  </Button>
                </div>
                <div>
                  <Label htmlFor="rejectionReason">
                    Reason for Rejection <span className="text-red-500">*</span>
                  </Label>
                  <Textarea
                    id="rejectionReason"
                    placeholder="Provide a reason for rejection"
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    rows={3}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Rejection letter (optional)</Label>
                  <Input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={handleRejectionLetterChange}
                    className="mt-1"
                  />
                  {rejectionLetterFile && (
                    <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                      <File className="h-4 w-4" />
                      <span>{rejectionLetterFile.name}</span>
                    </div>
                  )}
                </div>
                <Button
                  variant="destructive"
                  onClick={handleReject}
                  disabled={isSubmitting || uploadUploading}
                  className="w-full"
                >
                  {(isSubmitting || uploadUploading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {uploadUploading ? 'Uploading...' : isSubmitting ? 'Rejecting...' : 'Confirm Rejection'}
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
