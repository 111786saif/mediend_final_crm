'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import { getKYPStatusLabel } from '@/lib/kyp-status-labels'
import { File, ExternalLink, User, Phone, MapPin, Building2, CreditCard, FileText, Stethoscope, MessageSquare, Calendar, UserCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/use-auth'
import { canViewPhoneNumber } from '@/lib/case-permissions'
import { getPhoneDisplay } from '@/lib/phone-utils'

interface KYPSubmission {
  id: string
  leadId: number
  aadhar: string | null
  pan: string | null
  insuranceCard: string | null
  disease: string | null
  location: string | null
  remark: string | null
  aadharFileUrl: string | null
  panFileUrl: string | null
  insuranceCardFileUrl: string | null
  otherFiles: Array<{ name: string; url: string }> | null
  status: 'PENDING' | 'KYP_DETAILS_ADDED' | 'PRE_AUTH_COMPLETE' | 'FOLLOW_UP_COMPLETE' | 'COMPLETED'
  submittedAt: string
  lead: {
    id: number
    leadRef: string
    patientName: string
    phoneNumber: string
    circle?: string | null
    hospitalName: string
  }
  submittedBy: {
    id: string
    name: string
  }
}

interface KYPDetailsViewProps {
  kypSubmission: KYPSubmission
}

export function KYPDetailsView({ kypSubmission }: KYPDetailsViewProps) {
  const { user } = useAuth()
  const otherFiles = (kypSubmission.otherFiles as Array<{ name: string; url: string }>) || []

  const getStatusBadgeColor = (status: string) => {
    const colors: Record<string, string> = {
      PENDING: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
      KYP_DETAILS_ADDED: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
      PRE_AUTH_COMPLETE: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
      FOLLOW_UP_COMPLETE: 'bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300',
      COMPLETED: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
    }
    return colors[status] || 'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300'
  }

  return (
    <div className="space-y-6">
      {/* Consolidated Patient & KYP Details */}
      <Card className="border-2 shadow-sm">
        <CardHeader>
          <CardTitle>Patient & KYP Details</CardTitle>
          <CardDescription>Complete patient and KYP information</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Column: Patient Details */}
            <div className="space-y-4">
              <div className="pb-3 border-b border-gray-200 dark:border-gray-800">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                  <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  Patient Information
                </h3>
              </div>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800 mt-0.5">
                    <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <Label className="text-xs text-gray-500 dark:text-gray-400">Lead Reference</Label>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{kypSubmission.lead.leadRef}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800 mt-0.5">
                    <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <Label className="text-xs text-gray-500 dark:text-gray-400">Patient Name</Label>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{kypSubmission.lead.patientName}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-teal-50 dark:bg-teal-950/30 rounded-lg border border-teal-200 dark:border-teal-800 mt-0.5">
                    <Phone className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                  </div>
                  <div className="flex-1">
                    <Label className="text-xs text-gray-500 dark:text-gray-400">Phone Number</Label>
                    <p className="text-sm text-gray-900 dark:text-gray-100">{getPhoneDisplay(kypSubmission.lead.phoneNumber, canViewPhoneNumber(user))}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-teal-50 dark:bg-teal-950/30 rounded-lg border border-teal-200 dark:border-teal-800 mt-0.5">
                    <MapPin className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                  </div>
                  <div className="flex-1">
                    <Label className="text-xs text-gray-500 dark:text-gray-400">Circle</Label>
                    <p className="text-sm text-gray-900 dark:text-gray-100">{kypSubmission.lead.circle ?? '-'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800 mt-0.5">
                    <Building2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="flex-1">
                    <Label className="text-xs text-gray-500 dark:text-gray-400">Hospital</Label>
                    <p className="text-sm text-gray-900 dark:text-gray-100">{kypSubmission.lead.hospitalName}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: KYP Details */}
            <div className="space-y-4">
              <div className="pb-3 border-b border-gray-200 dark:border-gray-800">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-green-600 dark:text-green-400" />
                  KYP Information
                </h3>
              </div>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800 mt-0.5">
                    <CreditCard className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <Label className="text-xs text-gray-500 dark:text-gray-400">Aadhar</Label>
                    <p className="text-sm text-gray-900 dark:text-gray-100">{kypSubmission.aadhar || '-'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800 mt-0.5">
                    <CreditCard className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <Label className="text-xs text-gray-500 dark:text-gray-400">PAN</Label>
                    <p className="text-sm text-gray-900 dark:text-gray-100">{kypSubmission.pan || '-'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-teal-50 dark:bg-teal-950/30 rounded-lg border border-teal-200 dark:border-teal-800 mt-0.5">
                    <CreditCard className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                  </div>
                  <div className="flex-1">
                    <Label className="text-xs text-gray-500 dark:text-gray-400">Insurance Card</Label>
                    <p className="text-sm text-gray-900 dark:text-gray-100">{kypSubmission.insuranceCard || '-'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800 mt-0.5">
                    <Stethoscope className="w-4 h-4 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="flex-1">
                    <Label className="text-xs text-gray-500 dark:text-gray-400">Disease</Label>
                    <p className="text-sm text-gray-900 dark:text-gray-100">{kypSubmission.disease || '-'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-teal-50 dark:bg-teal-950/30 rounded-lg border border-teal-200 dark:border-teal-800 mt-0.5">
                    <MapPin className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                  </div>
                  <div className="flex-1">
                    <Label className="text-xs text-gray-500 dark:text-gray-400">Location (City)</Label>
                    <p className="text-sm text-gray-900 dark:text-gray-100">{kypSubmission.location || '-'}</p>
                  </div>
                </div>
                {kypSubmission.remark && (
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 mt-0.5">
                      <MessageSquare className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                    </div>
                    <div className="flex-1">
                      <Label className="text-xs text-gray-500 dark:text-gray-400">Remark</Label>
                      <p className="text-sm text-gray-900 dark:text-gray-100">{kypSubmission.remark}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Bottom Row: Status and Submission Info */}
          <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-800">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 mt-0.5">
                  <UserCheck className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                </div>
                <div className="flex-1">
                  <Label className="text-xs text-gray-500 dark:text-gray-400">Submitted By</Label>
                  <p className="text-sm text-gray-900 dark:text-gray-100">{kypSubmission.submittedBy?.name ?? 'Unknown'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="p-2 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 mt-0.5">
                  <Calendar className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                </div>
                <div className="flex-1">
                  <Label className="text-xs text-gray-500 dark:text-gray-400">Submitted At</Label>
                  <p className="text-sm text-gray-900 dark:text-gray-100">{format(new Date(kypSubmission.submittedAt), 'PPpp')}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="p-2 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 mt-0.5">
                  <FileText className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                </div>
                <div className="flex-1">
                  <Label className="text-xs text-gray-500 dark:text-gray-400">Status</Label>
                  <Badge className={`mt-1 border-0 ${getStatusBadgeColor(kypSubmission.status)}`}>
                    {getKYPStatusLabel(kypSubmission.status)}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Uploaded Files */}
      {(kypSubmission.aadharFileUrl ||
        kypSubmission.panFileUrl ||
        kypSubmission.insuranceCardFileUrl ||
        otherFiles.length > 0) && (
        <Card className="border-2 shadow-sm">
          <CardHeader>
            <CardTitle>Uploaded Documents</CardTitle>
            <CardDescription>Files uploaded with KYP submission</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {kypSubmission.aadharFileUrl && (
                <div className="flex items-center justify-between rounded-lg border-2 border-gray-200 dark:border-gray-800 p-3 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                      <File className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Aadhar Document</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(kypSubmission.aadharFileUrl!, '_blank')}
                    className="border-2"
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    View
                  </Button>
                </div>
              )}
              {kypSubmission.panFileUrl && (
                <div className="flex items-center justify-between rounded-lg border-2 border-gray-200 dark:border-gray-800 p-3 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                      <File className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">PAN Document</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(kypSubmission.panFileUrl!, '_blank')}
                    className="border-2"
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    View
                  </Button>
                </div>
              )}
              {kypSubmission.insuranceCardFileUrl && (
                <div className="flex items-center justify-between rounded-lg border-2 border-gray-200 dark:border-gray-800 p-3 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-teal-50 dark:bg-teal-950/30 rounded-lg border border-teal-200 dark:border-teal-800">
                      <File className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                    </div>
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Insurance Card Document</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(kypSubmission.insuranceCardFileUrl!, '_blank')}
                    className="border-2"
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    View
                  </Button>
                </div>
              )}
              {otherFiles.map((file, index) => (
                <div key={index} className="flex items-center justify-between rounded-lg border-2 border-gray-200 dark:border-gray-800 p-3 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
                      <File className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                    </div>
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{file.name}</span>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => window.open(file.url, '_blank')} className="border-2">
                    <ExternalLink className="h-3 w-3 mr-1" />
                    View
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
