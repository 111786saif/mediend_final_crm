'use client'

import { useState } from 'react'
import { AuthenticatedLayout } from '@/components/authenticated-layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/hooks/use-auth'
import { apiGet } from '@/lib/api-client'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ArrowLeft, MapPin, Shield, Stethoscope, Tag, User } from 'lucide-react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'

import { PreAuthInlineApproval } from '@/components/insurance/pre-auth-inline-approval'
import { ResetPatientDialog } from '@/components/insurance/reset-patient-dialog'
import { canCompletePreAuth, canResetPatient } from '@/lib/case-permissions'
import { resolveReturnTo } from '@/lib/navigation/return-to'
import { PreAuthStatus } from '@/generated/prisma/enums'

interface KYPSubmission {
  id: string
  leadId: string
  status: string
  lead: {
    id: string
    leadRef: string
    patientName: string
  }
  location?: string | null
  area?: string | null
  preAuthData?: {
    id: string
    sumInsured: string | null
    balanceInsured: string | null
    roomRent: string | null
    capping: string | null
    copay: string | null
    icu: string | null
    hospitalNameSuggestion: string | null
    hospitalSuggestions?: string[] | null
    suggestedHospitals?: Array<{
      hospitalName: string
      tentativeBill: number | null
      roomRentGeneral: number | null
      roomRentSingle: number | null
      roomRentDeluxe: number | null
      roomRentSemiPrivate: number | null
      notes: string | null
    }>
    roomTypes?: Array<{ name: string; rent: string }> | null
    insurance: string | null
    tpa: string | null
    handledAt?: string | null
    requestedHospitalName?: string | null
    requestedRoomType?: string | null
    diseaseDescription?: string | null
    diseaseImages?: Array<{ name: string; url: string }> | null
    preAuthRaisedAt?: string | null
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
  } | null
}

export default function PreAuthPage() {
  const { user } = useAuth()
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const leadId = params.leadId as string
  const [showResetDialog, setShowResetDialog] = useState(false)
  const returnHref = resolveReturnTo(searchParams) ?? `/patient/${leadId}`

  const { data: lead } = useQuery<any>({
    queryKey: ['lead', leadId],
    queryFn: () => apiGet<any>(`/api/leads/${leadId}`),
    enabled: !!leadId,
  })

  const { data: kypSubmission, isLoading } = useQuery<KYPSubmission | null>({
    queryKey: ['kyp-submission', leadId],
    queryFn: async () => {
      const submissions = await apiGet<KYPSubmission[]>('/api/kyp')
      return submissions.find((s) => s.leadId === leadId) || null
    },
    enabled: !!leadId,
  })

  if (isLoading) {
    return (
      <AuthenticatedLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-muted-foreground">Loading pre-authorization details...</div>
        </div>
      </AuthenticatedLayout>
    )
  }

  if (!kypSubmission) {
    return (
      <AuthenticatedLayout>
        <div className="space-y-6">
          <Button
            variant="ghost"
            onClick={() => router.push(returnHref)}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No KYP submission found. Please submit KYP first.
            </CardContent>
          </Card>
        </div>
      </AuthenticatedLayout>
    )
  }

  const canComplete = lead && user && canCompletePreAuth({ role: user.role } as any, lead)
  const canReset = lead && user && canResetPatient({ role: user.role } as any, lead)

  return (
    <AuthenticatedLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push(returnHref)}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold">Pre-Authorization</h1>
            <p className="text-muted-foreground">
              {kypSubmission?.lead.leadRef} - {kypSubmission?.lead.patientName}
            </p>
          </div>
          {canReset && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowResetDialog(true)}
              className="border-red-300 text-red-700 hover:bg-red-50 hover:text-red-800 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40"
            >
              <AlertTriangle className="h-4 w-4 mr-2" />
              Reset Patient
            </Button>
          )}
        </div>

        {/* Patient overview */}
        {lead && (
          <Card className="border-2 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                Patient overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                {lead.age && (
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                      <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Age</Label>
                      <p className="text-sm font-medium">{lead.age}</p>
                    </div>
                  </div>
                )}
                {lead.sex && (
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-50 dark:bg-indigo-950/30 rounded-lg border border-indigo-200 dark:border-indigo-800">
                      <User className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Sex</Label>
                      <p className="text-sm font-medium">{lead.sex}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-teal-50 dark:bg-teal-950/30 rounded-lg border border-teal-200 dark:border-teal-800">
                    <MapPin className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">City</Label>
                    <p className="text-sm font-medium">{(lead.kypSubmission?.location?.trim() || lead.circle) ?? '-'}</p>
                  </div>
                </div>
                {lead.kypSubmission?.area?.trim() && (
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                      <MapPin className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Area</Label>
                      <p className="text-sm font-medium">{lead.kypSubmission.area}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
                    <Stethoscope className="w-4 h-4 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Treatment</Label>
                    <p className="text-sm font-medium">{lead.treatment ?? '-'}</p>
                  </div>
                </div>
                {lead.ipdDrName && (
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-rose-50 dark:bg-rose-950/30 rounded-lg border border-rose-200 dark:border-rose-800">
                      <User className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Doctor</Label>
                      <p className="text-sm font-medium">{lead.ipdDrName}</p>
                    </div>
                  </div>
                )}
                {lead.opdDrName && (
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-50 dark:bg-purple-950/30 rounded-lg border border-purple-200 dark:border-purple-800">
                      <User className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Suggested Doctor</Label>
                      <p className="text-sm font-medium">{lead.opdDrName}</p>
                    </div>
                  </div>
                )}
                {lead.kypSubmission?.insuranceType && (
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-orange-50 dark:bg-orange-950/30 rounded-lg border border-orange-200 dark:border-orange-800">
                      <Shield className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Insurance Type</Label>
                      <p className="text-sm font-medium">{lead.kypSubmission.insuranceType}</p>
                    </div>
                  </div>
                )}
                {lead.insuranceName && (
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-cyan-50 dark:bg-cyan-950/30 rounded-lg border border-cyan-200 dark:border-cyan-800">
                      <Shield className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Insurance Name</Label>
                      <p className="text-sm font-medium">{lead.insuranceName}</p>
                    </div>
                  </div>
                )}
                {lead.category && (
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-700">
                      <Tag className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Category</Label>
                      <p className="text-sm font-medium">{lead.category}</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Hospital Suggestion and Pre-auth Approval */}
        {kypSubmission && (
          (
            lead?.caseStage === 'KYP_PENDING' || 
            lead?.caseStage === 'KYP_BASIC_COMPLETE' || 
            lead?.caseStage === 'KYP_BASIC_PENDING' ||
            lead?.caseStage === 'KYP_DETAILED_PENDING' ||
            lead?.caseStage === 'KYP_DETAILED_COMPLETE' ||
            lead?.caseStage === 'HOSPITALS_SUGGESTED' ||
            lead?.caseStage === 'PREAUTH_RAISED' ||
            lead?.caseStage === 'PREAUTH_COMPLETE' ||
            lead?.caseStage === 'INITIATED' ||
            lead?.caseStage === 'ADMITTED' ||
            lead?.caseStage === 'DISCHARGED' ||
            canComplete
          )
        ) && (
          <PreAuthInlineApproval
            leadId={leadId}
            kypSubmissionId={kypSubmission.id}
            lead={lead}
            preAuthData={kypSubmission.preAuthData}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ['lead', leadId] })
              queryClient.invalidateQueries({ queryKey: ['kyp-submission', leadId] })
            }}
          />
        )}

        <ResetPatientDialog
          leadId={leadId}
          open={showResetDialog}
          onOpenChange={setShowResetDialog}
        />
      </div>
    </AuthenticatedLayout>
  )
}
