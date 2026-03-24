'use client'

import { AuthenticatedLayout } from '@/components/authenticated-layout'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { useRouter, useParams } from 'next/navigation'
import { format } from 'date-fns'
import { KYPBasicForm } from '@/components/kyp/kyp-basic-form'

interface Lead {
  id: string
  leadRef: string
  patientName: string
  phoneNumber: string
  /** City / region from lead (synced from MySQL circle) */
  circle?: string
  treatment?: string
  dateOfBirth?: string | null
  sex?: string
}

export default function KYPBasicSubmitPage() {
  const router = useRouter()
  const params = useParams()
  const queryClient = useQueryClient()
  const leadId = params.leadId as string

  const { data: lead, isLoading } = useQuery<Lead>({
    queryKey: ['lead', leadId],
    queryFn: () => apiGet<Lead>(`/api/leads/${leadId}`),
    enabled: !!leadId,
  })

  if (isLoading) {
    return (
      <AuthenticatedLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </AuthenticatedLayout>
    )
  }

  if (!lead) {
    return (
      <AuthenticatedLayout>
        <div className="space-y-6">
          <Button variant="ghost" onClick={() => router.push(`/patient/${leadId}`)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Patient not found.
            </CardContent>
          </Card>
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
            onClick={() => router.push(`/patient/${leadId}`)}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Card Details</h1>
            <p className="text-muted-foreground">
              {lead.leadRef} - {lead.patientName}
            </p>
          </div>
        </div>

        <Card className="">
          <CardHeader>
            <CardTitle>Submit Card Details</CardTitle>
            <CardDescription>
              Insurance card, city and area required. Insurance will then suggest hospitals.
            </CardDescription>
          </CardHeader>
          <CardContent className="">
            <KYPBasicForm
              leadId={leadId}
              initialPatientName={lead.patientName}
              initialPhone={lead.phoneNumber}
              initialCity={lead.circle?.trim() || ''}
              initialTreatment={lead.treatment}
              initialDob={lead.dateOfBirth ? format(new Date(lead.dateOfBirth), 'yyyy-MM-dd') : undefined}
              initialSex={lead.sex}
              onSuccess={() => {
                queryClient.invalidateQueries({ queryKey: ['lead', leadId] })
                queryClient.invalidateQueries({ queryKey: ['kyp-submission', leadId] })
                queryClient.invalidateQueries({ queryKey: ['case-chat', leadId] })
                router.push(`/patient/${leadId}`)
              }}
              onCancel={() => router.push(`/patient/${leadId}`)}
            />
          </CardContent>
        </Card>
      </div>
    </AuthenticatedLayout>
  )
}
