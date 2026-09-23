'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { PreAuthDetailsView } from './pre-auth-details-view'
import { CaseStage, PreAuthStatus } from '@/generated/prisma/enums'
import { apiPost, apiGet } from '@/lib/api-client'
import { useQueryClient, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { InsuranceInitiateForm } from '@/components/insurance/insurance-initiate-form'

interface PreAuthApprovalModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  leadId: number
  leadRef: string
  patientName: string
  kypSubmissionId: string
  preAuthData: {
    id: string
    sumInsured?: string | null
    roomRent?: string | null
    capping?: string | null
    copay?: string | null
    icu?: string | null
    hospitalNameSuggestion?: string | null
    hospitalSuggestions?: string[] | null
    roomTypes?: Array<{ name: string; rent: string }> | null
    insurance?: string | null
    tpa?: string | null
    requestedHospitalName?: string | null
    requestedRoomType?: string | null
    diseaseDescription?: string | null
    diseaseImages?: Array<{ name: string; url: string }> | null
    preAuthRaisedAt?: string | null
    handledAt?: string | null
    handledBy?: {
      id: string
      name: string
    } | null
    preAuthRaisedBy?: {
      id: string
      name: string
    } | null
    approvalStatus?: PreAuthStatus
    rejectionReason?: string | null
    isNewHospitalRequest?: boolean
    newHospitalPreAuthRaised?: boolean
  }
}

export function PreAuthApprovalModal({
  open,
  onOpenChange,
  leadId,
  leadRef,
  patientName,
  kypSubmissionId,
  preAuthData,
}: PreAuthApprovalModalProps) {
  const [action, setAction] = useState<'approve' | 'reject' | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showInitiateForm, setShowInitiateForm] = useState(false)
  const queryClient = useQueryClient()

  // Fetch initiate form data if it exists
  const { data: initiateFormData } = useQuery<any>({
    queryKey: ['insurance-initiate-form', leadId],
    queryFn: () => apiGet<any>(`/api/insurance-initiate-form?leadId=${leadId}`),
    enabled: !!leadId && open,
  })

  const isNewHospital = preAuthData.isNewHospitalRequest === true
  const newHospitalMarked = preAuthData.newHospitalPreAuthRaised === true
  const showMarkNewHospitalFirst = isNewHospital && !newHospitalMarked

  const handleApprove = async () => {
    setIsSubmitting(true)
    try {
      await apiPost(`/api/pre-auth/${kypSubmissionId}/approve`, {})
      toast.success('Pre-authorization approved successfully')
      queryClient.invalidateQueries({ queryKey: ['leads', 'insurance'] })
      queryClient.invalidateQueries({ queryKey: ['lead', leadId] })
      queryClient.invalidateQueries({ queryKey: ['kyp-submission', leadId] })
      onOpenChange(false)
      setAction(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to approve pre-auth')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleMarkNewHospitalRaised = async () => {
    setIsSubmitting(true)
    try {
      await apiPost(`/api/pre-auth/${kypSubmissionId}/mark-new-hospital-raised`, {})
      toast.success('Marked pre-auth raised for new hospital')
      queryClient.invalidateQueries({ queryKey: ['leads', 'insurance'] })
      queryClient.invalidateQueries({ queryKey: ['lead', leadId] })
      queryClient.invalidateQueries({ queryKey: ['kyp-submission', leadId] })
      queryClient.invalidateQueries({ queryKey: ['case-chat', leadId] })
      setAction(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update')
    } finally {
      setIsSubmitting(false)
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
      })
      toast.success('Pre-authorization rejected')
      queryClient.invalidateQueries({ queryKey: ['leads', 'insurance'] })
      queryClient.invalidateQueries({ queryKey: ['lead', leadId] })
      queryClient.invalidateQueries({ queryKey: ['kyp-submission', leadId] })
      onOpenChange(false)
      setAction(null)
      setRejectionReason('')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to reject pre-auth')
    } finally {
      setIsSubmitting(false)
    }
  }

  const isAlreadyProcessed = preAuthData.approvalStatus === PreAuthStatus.APPROVED || 
                             preAuthData.approvalStatus === PreAuthStatus.REJECTED

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Complete Pre-Authorization</DialogTitle>
          <DialogDescription>
            Review the pre-authorization details and approve or reject the request
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Pre-Auth Details */}
          <PreAuthDetailsView
            preAuthData={preAuthData}
            caseStage={CaseStage.PREAUTH_RAISED}
            leadRef={leadRef}
            patientName={patientName}
          />

          {/* Approval Status */}
          {isAlreadyProcessed && (
            <div className="p-4 rounded-lg bg-muted">
              <div className="flex items-center gap-2">
                {preAuthData.approvalStatus === PreAuthStatus.APPROVED ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <span className="font-medium text-green-600">Pre-authorization has been approved</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-5 w-5 text-red-600" />
                    <span className="font-medium text-red-600">Pre-authorization has been rejected</span>
                  </>
                )}
              </div>
              {preAuthData.approvalStatus === PreAuthStatus.REJECTED && preAuthData.rejectionReason && (
                <p className="mt-2 text-sm text-muted-foreground">
                  Reason: {preAuthData.rejectionReason}
                </p>
              )}
            </div>
          )}

          {/* Action Buttons */}
          {!isAlreadyProcessed && (
            <div className="space-y-4 border-t pt-4">
              {showMarkNewHospitalFirst && action === null && (
                <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4">
                  <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                    This is a new hospital request. Mark that pre-auth has been raised for the new hospital, then approve or reject.
                  </p>
                  <Button
                    onClick={handleMarkNewHospitalRaised}
                    disabled={isSubmitting}
                    className="mt-3"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Updating...
                      </>
                    ) : (
                      'Mark pre-auth raised for new hospital'
                    )}
                  </Button>
                </div>
              )}

              {(!showMarkNewHospitalFirst || newHospitalMarked) && action === null && (
                <div className="flex gap-3">
                  <Button
                    onClick={() => setAction('approve')}
                    className="flex-1"
                    variant="default"
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Approve Pre-Auth
                  </Button>
                  <Button
                    onClick={() => setAction('reject')}
                    className="flex-1"
                    variant="destructive"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Reject Pre-Auth
                  </Button>
                </div>
              )}

              {action === 'approve' && (
                <div className="space-y-4">
                  {/* Initiate Form Section */}
                  <div className="space-y-3">
                    <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900">
                      <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                        Insurance Initiate Form
                      </p>
                      <p className="text-xs text-blue-700 dark:text-blue-300">
                        Please fill in the financial details before approving the pre-authorization. This form is a predecessor of the discharge form.
                      </p>
                    </div>
                    
                    {!showInitiateForm && (
                      <Button
                        onClick={() => setShowInitiateForm(true)}
                        variant="outline"
                        className="w-full"
                      >
                        {initiateFormData?.data?.initiateForm ? 'Edit Initiate Form' : 'Fill Initiate Form'}
                      </Button>
                    )}

                    {showInitiateForm && (
                      <div className="border rounded-lg p-4 bg-white dark:bg-gray-950 max-h-[60vh] overflow-y-auto">
                        <InsuranceInitiateForm
                          leadId={leadId}
                          initialData={initiateFormData?.data?.initiateForm}
                          onSuccess={() => {
                            queryClient.invalidateQueries({ queryKey: ['insurance-initiate-form', leadId] })
                            setShowInitiateForm(false)
                            toast.success('Initiate form saved successfully')
                          }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Approval Confirmation */}
                  <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900">
                    <p className="text-sm font-medium text-green-900 dark:text-green-100">
                      Are you sure you want to approve this pre-authorization?
                    </p>
                    <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                      This will move the case to the next stage and notify the BD team.
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <Button
                      onClick={handleApprove}
                      disabled={isSubmitting}
                      className="flex-1"
                      variant="default"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Approving...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Confirm Approval
                        </>
                      )}
                    </Button>
                    {showInitiateForm && (
                      <Button
                        onClick={() => setShowInitiateForm(false)}
                        disabled={isSubmitting}
                        variant="outline"
                      >
                        Hide Form
                      </Button>
                    )}
                    {!showInitiateForm && (
                      <Button
                        onClick={() => setAction(null)}
                        disabled={isSubmitting}
                        variant="outline"
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {action === 'reject' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="rejectionReason">Rejection Reason *</Label>
                    <Textarea
                      id="rejectionReason"
                      placeholder="Please provide a reason for rejecting this pre-authorization..."
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      rows={4}
                      className="resize-none"
                    />
                    <p className="text-xs text-muted-foreground">
                      This reason will be communicated to the BD team.
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <Button
                      onClick={handleReject}
                      disabled={isSubmitting || !rejectionReason.trim()}
                      className="flex-1"
                      variant="destructive"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Rejecting...
                        </>
                      ) : (
                        <>
                          <XCircle className="h-4 w-4 mr-2" />
                          Confirm Rejection
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={() => {
                        setAction(null)
                        setRejectionReason('')
                      }}
                      disabled={isSubmitting}
                      variant="outline"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
