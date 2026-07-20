'use client'

import { AuthenticatedLayout } from '@/components/authenticated-layout'
import { OPDScheduleForm } from '@/components/opd/opd-schedule-form'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/hooks/use-auth'
import { apiGet } from '@/lib/api-client'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { isReadOnlyPatientRole } from '@/lib/case-permissions'
import { useMemo } from 'react'

interface Lead {
  id: string
  leadRef: string
  patientName: string
  age?: number | null
  sex?: string | null
  phoneNumber: string
  alternateNumber?: string | null
  circle?: string | null
  hospitalName?: string | null
  ipdDrName?: string | null
  surgeonName?: string | null
  surgeonType?: string | null
  treatment?: string | null
  category?: string | null
  quantityGrade?: string | null
  status?: string | null
  opdHospital?: string | null
  opdDrName?: string | null
  opdContactNo?: string | null
  opdCharges?: number | null
  opdScheduleDate?: string | null
  opdMeeting?: number | null
  kypSubmission?: {
    location?: string | null
    area?: string | null
  } | null
}

export default function OPDSchedulePage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const leadId = params.leadId as string
  const returnToParam = searchParams.get('returnTo')
  const returnHref = useMemo(
    () =>
      typeof returnToParam === 'string' && returnToParam.startsWith('/')
        ? returnToParam
        : `/patient/${leadId}`,
    [leadId, returnToParam]
  )

  const { data: lead, isLoading } = useQuery<Lead>({
    queryKey: ['lead', leadId],
    queryFn: () => apiGet<Lead>(`/api/leads/${leadId}`),
    enabled: !!leadId,
  })

  if (isLoading) {
    return (
      <AuthenticatedLayout>
        <div className="flex min-h-[400px] items-center justify-center">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </AuthenticatedLayout>
    )
  }

  if (!lead) {
    return (
      <AuthenticatedLayout>
        <div className="space-y-6">
          <Button variant="ghost" onClick={() => router.push(returnHref)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
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

  if (user && isReadOnlyPatientRole(user as never)) {
    return (
      <AuthenticatedLayout>
        <div className="space-y-6">
          <Button variant="ghost" onClick={() => router.push(returnHref)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Card>
            <CardHeader>
              <CardTitle>OPD Details locked</CardTitle>
              <CardDescription>Your role can view this patient, but cannot edit OPD scheduling details.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline">
                <Link href={returnHref}>Back</Link>
              </Button>
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
          <Button variant="ghost" size="icon" onClick={() => router.push(returnHref)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">OPD Details</h1>
          </div>
        </div>

        <Card>
          <CardContent>
            <OPDScheduleForm
              leadId={leadId}
              leadRef={lead.leadRef}
              currentStatus={lead.status}
              patientName={lead.patientName}
              age={lead.age}
              sex={lead.sex}
              phoneNumber={lead.phoneNumber}
              alternateNumber={lead.alternateNumber}
              circle={lead.circle}
              city={lead.kypSubmission?.location ?? lead.circle}
              area={lead.kypSubmission?.area ?? null}
              category={lead.category}
              treatment={lead.treatment}
              quantityGrade={lead.quantityGrade}
              surgeonName={lead.opdDrName || lead.ipdDrName || lead.surgeonName}
              surgeonType={lead.surgeonType}
              hospitalName={lead.opdHospital || lead.hospitalName}
              opdHospital={lead.opdHospital}
              opdDrName={lead.opdDrName}
              opdCharges={lead.opdCharges}
              opdScheduleDate={lead.opdScheduleDate}
              opdMeeting={lead.opdMeeting}
              onSuccess={() => {
                queryClient.invalidateQueries({ queryKey: ['lead', leadId] })
                queryClient.invalidateQueries({ queryKey: ['leads'] })
                queryClient.invalidateQueries({ queryKey: ['pipeline'] })
                router.push(returnHref)
              }}
              onCancel={() => router.push(returnHref)}
            />
          </CardContent>
        </Card>
      </div>
    </AuthenticatedLayout>
  )
}
