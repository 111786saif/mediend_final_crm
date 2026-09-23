'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { User, Phone, MapPin, Stethoscope, ExternalLink, ClipboardList } from 'lucide-react'
import Link from 'next/link'
import { CaseStage } from '@/generated/prisma/enums'
import { useAuth } from '@/hooks/use-auth'
import { canViewPhoneNumber } from '@/lib/case-permissions'
import { getPhoneDisplay } from '@/lib/phone-utils'

interface PatientDetailsPanelProps {
  lead: {
    id: number
    leadRef: string
    patientName: string
    phoneNumber: string
    circle?: string | null
    hospitalName: string
    treatment: string | null
    category: string | null
    caseStage: CaseStage | string
    kypSubmission?: {
      id: string
      status: string
      location?: string | null
      area?: string | null
    } | null
  }
}

export function PatientDetailsPanel({ lead }: PatientDetailsPanelProps) {
  const { user } = useAuth()
  const getStageBadgeColor = (stage: CaseStage | string) => {
    const colors: Record<string, string> = {
      [CaseStage.NEW_LEAD]: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
      [CaseStage.KYP_BASIC_PENDING]: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
      [CaseStage.KYP_BASIC_COMPLETE]: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300',
      [CaseStage.KYP_DETAILED_PENDING]: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
      [CaseStage.KYP_DETAILED_COMPLETE]: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
      [CaseStage.PREAUTH_RAISED]: 'bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300',
      [CaseStage.PREAUTH_COMPLETE]: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
      [CaseStage.INITIATED]: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
      [CaseStage.DISCHARGED]: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
    }
    return colors[stage] || 'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300'
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Patient Details</h3>
        <Button asChild variant="outline" size="sm">
          <Link href={`/patient/${lead.id}`}>
            <ExternalLink className="h-4 w-4 mr-2" />
            View Full Details
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{lead.patientName}</CardTitle>
          <CardDescription>{lead.leadRef}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                <Phone className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <Label className="text-xs text-gray-500 dark:text-gray-400">Phone</Label>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{getPhoneDisplay(lead.phoneNumber, canViewPhoneNumber(user))}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="p-2 bg-teal-50 dark:bg-teal-950/30 rounded-lg border border-teal-200 dark:border-teal-800">
                <MapPin className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              </div>
              <div>
                <Label className="text-xs text-gray-500 dark:text-gray-400">Location</Label>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{lead.kypSubmission?.location?.trim() || lead.circle || '-'}</p>
              </div>
            </div>

            {(lead.kypSubmission?.area?.trim()) && (
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                  <MapPin className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <Label className="text-xs text-gray-500 dark:text-gray-400">Area</Label>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{lead.kypSubmission.area}</p>
                </div>
              </div>
            )}

            {lead.treatment && (
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
                  <Stethoscope className="w-4 h-4 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <Label className="text-xs text-gray-500 dark:text-gray-400">Treatment</Label>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{lead.treatment}</p>
                </div>
              </div>
            )}

            {lead.category && (
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-700">
                  <ClipboardList className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                </div>
                <div>
                  <Label className="text-xs text-gray-500 dark:text-gray-400">Category</Label>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{lead.category}</p>
                </div>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-gray-200 dark:border-gray-800">
            <Label className="text-xs text-gray-500 dark:text-gray-400 mb-2 block">Case Stage</Label>
            <Badge className={`border-0 ${getStageBadgeColor(lead.caseStage)}`}>
              {String(lead.caseStage).replace(/_/g, ' ')}
            </Badge>
          </div>

          {lead.kypSubmission && (
            <div className="pt-4 border-t border-gray-200 dark:border-gray-800">
              <Label className="text-xs text-gray-500 dark:text-gray-400 mb-2 block">KYP Status</Label>
              <Badge variant="secondary">
                {lead.kypSubmission.status.replace(/_/g, ' ')}
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
