'use client'

import { AuthenticatedLayout } from '@/components/authenticated-layout'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { format } from 'date-fns'
import { useMemo } from 'react'
import Link from 'next/link'
import {
  KYPBasicForm,
  type KYPBasicPrefill,
  parseJsonFileList,
  parseOtherFilesForInsurance,
} from '@/components/kyp/kyp-basic-form'
import { CaseStage, FlowType } from '@/generated/prisma/enums'

interface Lead {
  id: string
  leadRef: string
  patientName: string
  phoneNumber: string
  circle?: string
  treatment?: string
  dateOfBirth?: string | null
  sex?: string
  caseStage: CaseStage
  flowType?: FlowType | null
  insuranceName?: string | null
  ipdDrName?: string | null
}

interface KypForBasic {
  id: string
  location?: string | null
  area?: string | null
  disease?: string | null
  remark?: string | null
  insuranceType?: string | null
  aadhar?: string | null
  pan?: string | null
  otherFiles?: unknown
  aadharFiles?: unknown
  panFiles?: unknown
  insuranceCardFileUrl?: string | null
}

const ALLOWED_STAGES: CaseStage[] = [
  CaseStage.NEW_LEAD,
  CaseStage.OPD_SCHEDULED,
  CaseStage.OPD_DONE,
  CaseStage.KYP_BASIC_PENDING,
  CaseStage.KYP_BASIC_COMPLETE,
]

export default function KYPBasicSubmitPage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
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

  const needsKypPrefill = lead?.caseStage === CaseStage.KYP_BASIC_COMPLETE

  const { data: kypSubmission, isLoading: kypLoading } = useQuery<KypForBasic | null>({
    queryKey: ['kyp-submission', leadId],
    queryFn: async () => {
      const submissions = await apiGet<KypForBasic[]>(`/api/kyp?leadId=${leadId}`)
      if (!Array.isArray(submissions)) return null
      return submissions[0] ?? null
    },
    enabled: !!leadId && !!needsKypPrefill,
  })

  const prefill = useMemo((): KYPBasicPrefill | null => {
    if (!lead || lead.caseStage !== CaseStage.KYP_BASIC_COMPLETE || !kypSubmission) return null
    const k = kypSubmission
    return {
      kypId: k.id,
      location: k.location?.trim() ?? '',
      area: k.area?.trim() ?? '',
      patientName: lead.patientName,
      phone: lead.phoneNumber ?? '',
      dob: lead.dateOfBirth ? format(new Date(lead.dateOfBirth), 'yyyy-MM-dd') : '',
      sex: lead.sex ?? '',
      disease: k.disease?.trim() ?? '',
      insuranceType: k.insuranceType ?? '',
      remark: k.remark?.trim() ?? '',
      insuranceName: lead.insuranceName?.trim() ?? '',
      doctorName: lead.ipdDrName?.trim() ?? '',
      aadhar: k.aadhar?.trim() ?? '',
      pan: k.pan?.trim() ?? '',
      insuranceFiles: parseOtherFilesForInsurance(k.otherFiles, k.insuranceCardFileUrl),
      aadharFiles: parseJsonFileList(k.aadharFiles),
      panFiles: parseJsonFileList(k.panFiles),
    }
  }, [lead, kypSubmission])

  const isEditMode = Boolean(prefill)

  const showLoading = isLoading || (needsKypPrefill && kypLoading)

  if (showLoading) {
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
          <Button variant="ghost" onClick={() => router.push(returnHref)}>
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

  if (lead.flowType === FlowType.CASH) {
    return (
      <AuthenticatedLayout>
        <div className="space-y-6">
          <Button variant="ghost" onClick={() => router.push(returnHref)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <Card>
            <CardHeader>
              <CardTitle>Card Details</CardTitle>
              <CardDescription>This patient is on the Cash flow.</CardDescription>
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

  if (!ALLOWED_STAGES.includes(lead.caseStage)) {
    return (
      <AuthenticatedLayout>
        <div className="space-y-6">
          <Button variant="ghost" onClick={() => router.push(returnHref)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <Card>
            <CardHeader>
              <CardTitle>Card Details locked</CardTitle>
              <CardDescription>
                Card details can no longer be edited after hospitals have been suggested or the case has moved forward.
              </CardDescription>
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

  if (needsKypPrefill && !prefill) {
    return (
      <AuthenticatedLayout>
        <div className="space-y-6">
          <Button variant="ghost" onClick={() => router.push(returnHref)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Could not load card details for this patient.
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
            onClick={() => router.push(returnHref)}
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
            <CardTitle>{isEditMode ? 'Update Card Details' : 'Submit Card Details'}</CardTitle>
            <CardDescription>
              {isEditMode
                ? 'You can edit and save until insurance suggests hospitals.'
                : 'Insurance card, city and area required. Insurance will then suggest hospitals.'}
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
              prefill={prefill}
              isEditMode={isEditMode}
              onSuccess={() => {
                queryClient.invalidateQueries({ queryKey: ['lead', leadId] })
                queryClient.invalidateQueries({ queryKey: ['kyp-submission', leadId] })
                queryClient.invalidateQueries({ queryKey: ['case-chat', leadId] })
                queryClient.invalidateQueries({ queryKey: ['stage-history', leadId] })
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
