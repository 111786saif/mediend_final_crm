'use client'

import { AuthenticatedLayout } from '@/components/authenticated-layout'
import { DischargeCashForm } from '@/components/discharge/discharge-cash-form'
import { DischargeCashView } from '@/components/discharge/discharge-cash-view'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useAuth } from '@/hooks/use-auth'
import { apiGet } from '@/lib/api-client'
import { canFillCashDischarge } from '@/lib/case-permissions'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { useParams, useRouter } from 'next/navigation'

export default function DischargeCashPage() {
  const { user } = useAuth()
  const router = useRouter()
  const params = useParams()
  const queryClient = useQueryClient()
  const leadId = params.leadId as string

  const { data: lead, isLoading } = useQuery<any>({
    queryKey: ['lead', leadId],
    queryFn: () => apiGet(`/api/leads/${leadId}`),
    enabled: !!leadId,
  })

  const { data: dischargeSheet, isLoading: isLoadingSheet } = useQuery<any>({
    queryKey: ['discharge-sheet', leadId],
    queryFn: () => apiGet(`/api/discharge-sheet?leadId=${leadId}`), // Reuse existing endpoint if it returns by leadId
    // Wait, I created /api/discharge-sheet-cash but for GET I might need to use existing or create new.
    // The existing /api/discharge-sheet probably handles GET by leadId?
    // Let's check if I need to create a GET endpoint.
    // Usually GET /api/leads/[id] returns dischargeSheet relation.
    // So I can just use lead.dischargeSheet.
    // But for full details I might need a specific endpoint if relation is partial.
    // Let's rely on lead.dischargeSheet for existence, and if needed fetch full.
    // Actually, lead object from /api/leads/[id] includes dischargeSheet.
    enabled: !!leadId,
  })

  // If lead has discharge sheet, use that data
  const sheetData = lead?.dischargeSheet

  if (isLoading) {
    return (
      <AuthenticatedLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AuthenticatedLayout>
    )
  }

  if (!lead) {
    return (
      <AuthenticatedLayout>
        <div className="p-6">Lead not found</div>
      </AuthenticatedLayout>
    )
  }

  const canFill = user && canFillCashDischarge(user as any, lead)

  return (
    <AuthenticatedLayout>
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Discharge Sheet (Cash)</h1>
            <p className="text-muted-foreground text-sm">
              {lead.patientName} ({lead.leadRef})
            </p>
          </div>
        </div>

        {sheetData ? (
          <DischargeCashView data={sheetData} />
        ) : canFill ? (
          <Card>
            <CardContent className="pt-6">
              <DischargeCashForm
                leadId={leadId}
                patientName={lead.patientName}
                hospitalName={lead.hospitalName}
                approvedAmount={lead.settledTotal}
                finalBillAmount={lead.billAmount}
                modeOfPayment={lead.modeOfPayment}
                onSuccess={() => {
                  queryClient.invalidateQueries({ queryKey: ['lead', leadId] })
                  router.refresh()
                }}
              />
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="pt-6 text-center text-muted-foreground">
              You do not have permission to fill the discharge sheet or the case is not in the correct stage.
            </CardContent>
          </Card>
        )}
      </div>
    </AuthenticatedLayout>
  )
}
