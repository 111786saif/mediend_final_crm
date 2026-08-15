'use client'

import { useState } from 'react'
import { AuthenticatedLayout } from '@/components/authenticated-layout'
import { useAuth } from '@/hooks/use-auth'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft, CalendarCheck } from 'lucide-react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { DischargeSheetView } from '@/components/discharge/discharge-sheet-view'
import { DischargeSheetForm } from '@/components/discharge/discharge-sheet-form'
import { MarkDischargedDialog } from '@/components/discharge/mark-discharged-dialog'
import { resolveLeadHospitalDoctor } from '@/lib/lead-display'
import { resolveReturnTo } from '@/lib/navigation/return-to'

interface DischargeSheet {
  id: string
  leadId: string
  isFinalized: boolean
  dischargeDate: string | null
  markedAt: string | null
  finalizedAt: string | null
  // remaining fields are used by view/form via index signature
  lead: {
    id: string
    leadRef: string
    patientName: string
  }
  [key: string]: unknown
}

interface LeadShape {
  id: string
  caseStage: string
  patientName?: string | null
  surgeryDate?: string | null
  insuranceInitiateForm?: { id: string } | null
  admissionRecord?: { 
    ipdDischargeDate?: string | null
    surgeryDate?: string | null
  } | null
  [key: string]: unknown
}

export default function DischargeSheetPage() {
  const { user } = useAuth()
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const leadId = params.leadId as string
  const [markDialogOpen, setMarkDialogOpen] = useState(false)
  const returnHref = resolveReturnTo(searchParams) ?? `/patient/${leadId}`

  const { data: dischargeSheet, isLoading: sheetLoading } = useQuery<DischargeSheet | null>({
    queryKey: ['discharge-sheet', leadId],
    queryFn: async () => {
      const data = await apiGet<DischargeSheet[]>(`/api/discharge-sheet?leadId=${leadId}`)
      if (Array.isArray(data) && data.length > 0) {
        return data[0]
      }
      return null
    },
    enabled: !!leadId,
  })

  const { data: lead, isLoading: leadLoading } = useQuery<LeadShape | null>({
    queryKey: ['lead', leadId],
    queryFn: () => apiGet(`/api/leads/${leadId}`),
    enabled: !!leadId,
  })

  const isInsurance = ['INSURANCE', 'INSURANCE_HEAD', 'ADMIN', 'TESTER'].includes(user?.role || '')
  const hasInitiateForm = !!lead?.insuranceInitiateForm?.id
  const isFinalized = !!dischargeSheet?.isFinalized
  const sheetUnfinalized = !!dischargeSheet && !isFinalized
  const canMark =
    isInsurance &&
    !dischargeSheet &&
    lead?.caseStage === 'IPD_DONE' &&
    hasInitiateForm

  const initialDischargeDate = dischargeSheet?.dischargeDate
    ? new Date(dischargeSheet.dischargeDate).toISOString().slice(0, 10)
    : lead?.admissionRecord?.ipdDischargeDate
    ? lead.admissionRecord.ipdDischargeDate.slice(0, 10)
    : undefined

  const initialSurgeryDate = dischargeSheet?.surgeryDate
    ? new Date(dischargeSheet.surgeryDate as string).toISOString().slice(0, 10)
    : lead?.surgeryDate
    ? new Date(lead.surgeryDate as string).toISOString().slice(0, 10)
    : lead?.admissionRecord?.surgeryDate
    ? new Date(lead.admissionRecord.surgeryDate as string).toISOString().slice(0, 10)
    : undefined

  // Hospital + doctor chosen after pre-auth approval (single source of truth).
  const { hospital: resolvedHospital, doctor: resolvedDoctor } = resolveLeadHospitalDoctor(lead)
  const patientName =
    lead?.patientName ?? (dischargeSheet?.lead?.patientName as string | undefined) ?? ''

  if (sheetLoading || leadLoading) {
    return (
      <AuthenticatedLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-muted-foreground">Loading discharge sheet...</div>
        </div>
      </AuthenticatedLayout>
    )
  }

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
          <div>
            <h1 className="text-3xl font-bold">Discharge Sheet</h1>
            {sheetUnfinalized && (
              <p className="text-sm text-muted-foreground mt-1">
                Patient marked discharged
                {dischargeSheet?.dischargeDate
                  ? ` on ${new Date(dischargeSheet.dischargeDate).toLocaleDateString()}`
                  : ''}
                . Fill the sheet to move the case to P&L.
              </p>
            )}
          </div>
        </div>

        {isFinalized && dischargeSheet ? (
          <DischargeSheetView
            dischargeSheet={dischargeSheet as never}
            onEdit={() => router.push(`/discharge/${leadId}/edit`)}
          />
        ) : sheetUnfinalized && isInsurance ? (
          <DischargeSheetForm
            leadId={leadId}
            patientName={patientName}
            surgeryDate={initialSurgeryDate}
            hospital={resolvedHospital ?? ''}
            doctorName={resolvedDoctor ?? ''}
            initialDischargeDate={initialDischargeDate}
            onSuccess={async () => {
              await queryClient.invalidateQueries({ queryKey: ['lead', leadId] })
              await queryClient.invalidateQueries({ queryKey: ['discharge-sheet', leadId] })
              router.push(returnHref)
            }}
          />
        ) : canMark ? (
          <Card>
            <CardContent className="py-12 text-center space-y-4">
              <CalendarCheck className="h-12 w-12 mx-auto text-orange-500" />
              <div>
                <h3 className="text-lg font-semibold">Patient ready for discharge</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                  BD has marked surgery done. Mark the patient discharged with a date — you can
                  fill the full sheet later.
                </p>
              </div>
              <Button
                onClick={() => setMarkDialogOpen(true)}
                className="bg-orange-600 hover:bg-orange-700 text-white"
              >
                <CalendarCheck className="h-4 w-4 mr-2" />
                Mark Discharged
              </Button>
            </CardContent>
          </Card>
        ) : !dischargeSheet && isInsurance && !hasInitiateForm ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Initiate form must be filled before discharge can be marked.
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No discharge sheet found.
              {!isInsurance && ' Only Insurance team can mark and fill discharge.'}
            </CardContent>
          </Card>
        )}

        <MarkDischargedDialog
          leadId={leadId}
          open={markDialogOpen}
          onOpenChange={setMarkDialogOpen}
          defaultDate={initialDischargeDate}
        />
      </div>
    </AuthenticatedLayout>
  )
}
