'use client'

import { AuthenticatedLayout } from '@/components/authenticated-layout'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost } from '@/lib/api-client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft, AlertCircle, Loader2 } from 'lucide-react'
import { useRouter, useParams } from 'next/navigation'
import { PreAuthRaiseForm } from '@/components/case/preauth-raise-form'
import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from 'sonner'
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox'
import { cn } from '@/lib/utils'

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

interface HospitalSuggestionItem {
  id: string
  hospitalName: string
  tentativeBill?: number | null
  roomRentGeneral?: number | null
  roomRentSingle?: number | null
  roomRentDeluxe?: number | null
  roomRentSemiPrivate?: number | null
  notes?: string | null
}

interface KYPSubmission {
  id: string
  leadId: string
  // KYP fields for auto-fills
  disease: string | null
  aadhar: string | null
  pan: string | null
  aadharFileUrl: string | null
  panFileUrl: string | null
  prescriptionFileUrl: string | null
  location: string | null
  area: string | null
  insuranceType: string | null
  // Lead data
  lead: {
    id: string
    leadRef: string
    patientName: string
    surgeonName?: string | null
    ipdDrName?: string | null
    insuranceName?: string | null
  }
  preAuthData?: {
    id: string
    requestedHospitalName?: string | null
    requestedRoomType?: string | null
    bdSuggestedHospital?: string | null
    diseaseDescription?: string | null
    diseaseImages?: Array<{ name: string; url: string }> | null
    hospitalSuggestions?: string[] | null
    roomTypes?: Array<{ name: string; rent: string }> | null
    suggestedHospitals?: HospitalSuggestionItem[] | null
    prescriptionFiles?: Array<{ name: string; url: string }> | null
    investigationFileUrls?: Array<{ name: string; url: string }> | null
    notes?: string | null
    expectedAdmissionDate?: string | null
    expectedSurgeryDate?: string | null
    // Insurance meta (auto-fills)
    sumInsured?: string | null
    balanceInsured?: string | null
    copay?: string | null
    capping?: string | number | null
    roomRent?: string | null
    insurance?: string | null
    tpa?: string | null
  } | null
}

export default function RaisePreAuthPage() {
  const router = useRouter()
  const params = useParams()
  const queryClient = useQueryClient()
  const leadId = params.leadId as string
  const [isSuggestDialogOpen, setIsSuggestDialogOpen] = useState(false)
  const [suggestedHospitalName, setSuggestedHospitalName] = useState('')
  const [suggestedTpa, setSuggestedTpa] = useState('')
  const [isSubmittingSuggestion, setIsSubmittingSuggestion] = useState(false)
  const debouncedTpaSearch = useDebouncedValue(suggestedTpa, 250)

  const { data: kypSubmission, isLoading } = useQuery<KYPSubmission | null>({
    queryKey: ['kyp-submission', leadId],
    queryFn: async () => {
      const submissions = await apiGet<KYPSubmission[]>('/api/kyp')
      return submissions.find((s) => s.leadId === leadId) || null
    },
    enabled: !!leadId,
  })

  const { data: tpaSuggestData } = useQuery({
    queryKey: ['suggest-hospital-tpas', leadId, debouncedTpaSearch],
    queryFn: () =>
      apiGet<{ items: { id: string; name: string }[] }>(
        `/api/leads/${leadId}/suggest-hospital?search=${encodeURIComponent(debouncedTpaSearch)}`
      ),
    enabled: !!leadId && isSuggestDialogOpen,
  })
  const tpaSuggestions = tpaSuggestData?.items ?? []

  const handleSuggestHospital = async () => {
    if (!suggestedHospitalName.trim()) {
      toast.error('Please enter a hospital name')
      return
    }

    try {
      setIsSubmittingSuggestion(true)
      await apiPost(`/api/leads/${leadId}/suggest-hospital`, {
        suggestedHospitalName: suggestedHospitalName.trim(),
        ...(suggestedTpa.trim() ? { tpa: suggestedTpa.trim() } : {}),
      })
      toast.success('Hospital suggestion submitted. Insurance team will be notified.')
      setIsSuggestDialogOpen(false)
      setSuggestedHospitalName('')
      setSuggestedTpa('')
      queryClient.invalidateQueries({ queryKey: ['kyp-submission', leadId] })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to suggest hospital')
    } finally {
      setIsSubmittingSuggestion(false)
    }
  }

  if (isLoading) {
    return (
      <AuthenticatedLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AuthenticatedLayout>
    )
  }

  if (!kypSubmission) {
    return (
      <AuthenticatedLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-muted-foreground">KYP submission not found</div>
        </div>
      </AuthenticatedLayout>
    )
  }

  const preAuth = kypSubmission.preAuthData
  const hasPendingSuggestion = !!preAuth?.bdSuggestedHospital

  return (
    <AuthenticatedLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push(`/patient/${leadId}`)}
            className="hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Raise Pre-Auth</h1>
            <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
              Select hospital and room type from Insurance suggestions
            </p>
          </div>
        </div>

        {hasPendingSuggestion ? (
          <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
            <CardContent className="pt-6 flex flex-col items-center text-center p-8">
              <div className="h-12 w-12 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center mb-4">
                <AlertCircle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              </div>
              <h3 className="text-lg font-semibold text-amber-900 dark:text-amber-100 mb-2">
                Hospital Suggestion Pending
              </h3>
              <p className="text-amber-700 dark:text-amber-300 max-w-md mb-6">
                You have suggested <strong>{preAuth.bdSuggestedHospital}</strong>. 
                Please wait for the Insurance team to update the hospital list before raising pre-auth.
              </p>
              <Button 
                variant="outline" 
                className="border-amber-300 text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-200 dark:hover:bg-amber-900/40"
                onClick={() => router.push(`/patient/${leadId}`)}
              >
                Return to Patient Page
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-6">
              <div className="space-y-1">
                <CardTitle>Pre-Auth Request Form</CardTitle>
                <CardDescription>
                  Select a hospital from Insurance&apos;s suggestions.
                  Upload required documents and provide disease details.
                </CardDescription>
              </div>
              <Dialog
                open={isSuggestDialogOpen}
                onOpenChange={(open) => {
                  setIsSuggestDialogOpen(open)
                  if (open) {
                    setSuggestedTpa(kypSubmission?.preAuthData?.tpa ?? '')
                  } else {
                    setSuggestedHospitalName('')
                    setSuggestedTpa('')
                  }
                }}
              >
                <DialogTrigger asChild>
                  <Button variant="outline" className="border-dashed border-2">
                    Suggest New Hospital
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Suggest New Hospital</DialogTitle>
                    <DialogDescription>
                      Suggest a hospital not in the current list. The Insurance team will review and update the options.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="hospital-name">Hospital Name</Label>
                      <Input
                        id="hospital-name"
                        value={suggestedHospitalName}
                        onChange={(e) => setSuggestedHospitalName(e.target.value)}
                        placeholder="Enter hospital name"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="suggest-tpa">TPA (optional)</Label>
                      <Combobox
                        autoHighlight
                        value={suggestedTpa || ''}
                        onValueChange={(value) => {
                          if (value) setSuggestedTpa(value)
                        }}
                      >
                        <ComboboxInput
                          id="suggest-tpa"
                          placeholder="Search TPAMaster or type any TPA name"
                          className={cn('w-full')}
                          value={suggestedTpa}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setSuggestedTpa(e.target.value)
                          }
                        />
                        <ComboboxContent>
                          <ComboboxList>
                            {tpaSuggestions.length > 0 ? (
                              tpaSuggestions.map((item) => (
                                <ComboboxItem key={item.id} value={item.name}>
                                  {item.name}
                                </ComboboxItem>
                              ))
                            ) : (
                              <ComboboxEmpty>
                                No TPA matches. Keep typing to use your own text.
                              </ComboboxEmpty>
                            )}
                          </ComboboxList>
                        </ComboboxContent>
                      </Combobox>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsSuggestDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleSuggestHospital} disabled={isSubmittingSuggestion}>
                      {isSubmittingSuggestion ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        'Submit Suggestion'
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <PreAuthRaiseForm
                leadId={leadId}
                initialData={
                  preAuth
                    ? {
                        requestedHospitalName: preAuth.requestedHospitalName || undefined,
                        requestedRoomType: preAuth.requestedRoomType || undefined,
                        diseaseDescription: preAuth.diseaseDescription || kypSubmission.disease || undefined,
                        diseaseImages: (preAuth.diseaseImages as Array<{ name: string; url: string }>) ?? undefined,
                        hospitalSuggestions: preAuth.hospitalSuggestions ?? undefined,
                        roomTypes: preAuth.roomTypes ?? undefined,
                        suggestedHospitals: preAuth.suggestedHospitals ?? undefined,
                        prescriptionFiles: (preAuth.prescriptionFiles as Array<{ name: string; url: string }>) ?? undefined,
                        investigationFileUrls: (preAuth.investigationFileUrls as Array<{ name: string; url: string }>) ?? undefined,
                        notes: preAuth.notes || undefined,
                        expectedAdmissionDate: preAuth.expectedAdmissionDate || undefined,
                        expectedSurgeryDate: preAuth.expectedSurgeryDate || undefined,
                      }
                    : undefined
                }
                kypData={{
                  disease: kypSubmission.disease,
                  surgeonName: kypSubmission.lead?.surgeonName,
                  doctorName: kypSubmission.lead?.ipdDrName,
                  insuranceType: kypSubmission.insuranceType
                    ? String(kypSubmission.insuranceType)
                    : undefined,
                  aadhar: kypSubmission.aadhar,
                  pan: kypSubmission.pan,
                  aadharFileUrl: kypSubmission.aadharFileUrl,
                  panFileUrl: kypSubmission.panFileUrl,
                  prescriptionFileUrl: kypSubmission.prescriptionFileUrl,
                  location: kypSubmission.location,
                  area: kypSubmission.area,
                }}
                preAuthMeta={{
                  sumInsured: preAuth?.sumInsured,
                  balanceInsured: preAuth?.balanceInsured,
                  copay: preAuth?.copay,
                  capping: preAuth?.capping,
                  roomRent: preAuth?.roomRent,
                  insurance: preAuth?.insurance || kypSubmission.lead?.insuranceName,
                  tpa: preAuth?.tpa,
                }}
                onSuccess={() => {
                  queryClient.invalidateQueries({ queryKey: ['lead', leadId] })
                  queryClient.invalidateQueries({ queryKey: ['kyp-submission', leadId] })
                  router.push(`/patient/${leadId}`)
                }}
                onCancel={() => {
                  router.push(`/patient/${leadId}`)
                }}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </AuthenticatedLayout>
  )
}
