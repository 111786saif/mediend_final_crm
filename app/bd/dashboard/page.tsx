'use client'

import { AuthenticatedLayout } from '@/components/authenticated-layout'
import { useAuth } from '@/hooks/use-auth'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useLeads } from '@/hooks/use-leads'
import { useRouter } from 'next/navigation'
import { CaseStage } from '@/generated/prisma/enums'
import { Eye, FileText, AlertCircle, CheckCircle2, Clock, ArrowRight } from 'lucide-react'
import { format } from 'date-fns'
import { canViewPhoneNumber } from '@/lib/case-permissions'
import { getPhoneDisplay } from '@/lib/phone-utils'

interface LeadWithStage {
  id: string
  leadRef: string
  patientName: string
  phoneNumber: string
  circle?: string | null
  hospitalName: string
  treatment?: string
  caseStage: CaseStage
  createdDate: string
  kypSubmission?: {
    id: string
    status: string
  } | null
  preAuthData?: {
    id: string
    preAuthRaisedAt?: string | null
  } | null
}

export default function BDDashboardPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'awaiting-kyp' | 'ready-preauth' | 'preauth-complete' | 'ipd-scheduled' | 'admitted' | 'queries'>('awaiting-kyp')

  const { leads, isLoading } = useLeads({ bdId: user?.id })

  // Fetch KYP submissions
  const { data: kypSubmissions } = useQuery<any[]>({
    queryKey: ['kyp-submissions', 'dashboard', user?.id],
    queryFn: () => apiGet<any[]>('/api/kyp'),
    enabled: !!user?.id,
  })

  // Fetch queries
  const { data: queries } = useQuery<any[]>({
    queryKey: ['queries', 'dashboard', user?.id],
    queryFn: () => apiGet<any[]>('/api/kyp/queries'),
    enabled: !!user?.id,
  })

  // Create maps for quick lookup
  const kypMap = new Map<string, any>()
  kypSubmissions?.forEach((kyp) => {
    kypMap.set(kyp.leadId, kyp)
  })

  const queryMap = new Map<string, any[]>()
  queries?.forEach((query) => {
    if (!queryMap.has(query.preAuthorization.kypSubmission.leadId)) {
      queryMap.set(query.preAuthorization.kypSubmission.leadId, [])
    }
    queryMap.get(query.preAuthorization.kypSubmission.leadId)?.push(query)
  })

  // Filter leads by stage
  const filteredLeads = leads.filter((lead) => {
    const kyp = kypMap.get(lead.id)
    const leadQueries = queryMap.get(lead.id) || []
    const pendingQueries = leadQueries.filter((q: any) => q.status === 'PENDING')

    switch (activeTab) {
      case 'awaiting-kyp':
        return !kyp || kyp.status === 'PENDING'
      case 'ready-preauth':
        return kyp?.status === 'KYP_DETAILS_ADDED' && lead.caseStage === CaseStage.KYP_COMPLETE
      case 'preauth-complete':
        return lead.caseStage === CaseStage.PREAUTH_COMPLETE
      case 'ipd-scheduled':
        return lead.caseStage === CaseStage.INITIATED
      case 'admitted':
        return lead.caseStage === CaseStage.ADMITTED
      case 'queries':
        return pendingQueries.length > 0
      default:
        return false
    }
  })

  const getStageBadge = (stage: CaseStage | undefined) => {
    if (!stage) {
      return (
        <Badge variant="secondary">
          Unknown
        </Badge>
      )
    }
    const variants: Record<CaseStage, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      [CaseStage.NEW_LEAD]: 'secondary',
      [CaseStage.KYP_BASIC_PENDING]: 'secondary',
      [CaseStage.KYP_BASIC_COMPLETE]: 'default',
      [CaseStage.KYP_DETAILED_PENDING]: 'secondary',
      [CaseStage.KYP_DETAILED_COMPLETE]: 'default',
      [CaseStage.KYP_PENDING]: 'secondary',
      [CaseStage.KYP_COMPLETE]: 'default',
      [CaseStage.HOSPITALS_SUGGESTED]: 'default',
      [CaseStage.PREAUTH_RAISED]: 'default',
      [CaseStage.PREAUTH_COMPLETE]: 'default',
      [CaseStage.INITIATED]: 'default',
      [CaseStage.ADMITTED]: 'default',
      [CaseStage.DISCHARGED]: 'outline',
      [CaseStage.IPD_DONE]: 'default',
      [CaseStage.PL_PENDING]: 'secondary',
      [CaseStage.OUTSTANDING]: 'secondary',
      // Cash Flow Stages
      [CaseStage.CASH_IPD_PENDING]: 'secondary',
      [CaseStage.CASH_IPD_SUBMITTED]: 'secondary',
      [CaseStage.CASH_APPROVED]: 'default',
      [CaseStage.CASH_ON_HOLD]: 'destructive',
      [CaseStage.CASH_IPD_DONE]: 'default',
      [CaseStage.CASH_DISCHARGED]: 'outline',
    }
    return (
      <Badge variant={variants[stage] || 'secondary'}>
        {stage.replace(/_/g, ' ')}
      </Badge>
    )
  }

  const getTabStats = () => {
    const awaitingKYP = leads.filter((lead) => {
      const kyp = kypMap.get(lead.id)
      return !kyp || kyp.status === 'PENDING'
    }).length

    const readyPreAuth = leads.filter((lead) => {
      const kyp = kypMap.get(lead.id)
      return kyp?.status === 'KYP_DETAILS_ADDED' && lead.caseStage === CaseStage.KYP_COMPLETE
    }).length

    const preAuthComplete = leads.filter((lead) => lead.caseStage === CaseStage.PREAUTH_COMPLETE).length

    const ipdScheduled = leads.filter((lead) => lead.caseStage === CaseStage.INITIATED).length
    const admitted = leads.filter((lead) => lead.caseStage === CaseStage.ADMITTED).length

    const pendingQueries = queries?.filter((q: any) => q.status === 'PENDING').length || 0

    return {
      awaitingKYP,
      readyPreAuth,
      preAuthComplete,
      ipdScheduled,
      admitted,
      pendingQueries,
    }
  }

  const stats = getTabStats()

  return (
    <AuthenticatedLayout>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6">
        <div className="mx-auto max-w-7xl space-y-6">
          <div>
            <h1 className="text-3xl font-bold">BD Dashboard</h1>
            <p className="text-muted-foreground mt-2">Manage your active cases and tasks</p>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab('awaiting-kyp')}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Awaiting KYP</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.awaitingKYP}</div>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab('ready-preauth')}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Ready for Pre-Auth</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.readyPreAuth}</div>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab('preauth-complete')}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Pre-Auth Complete</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.preAuthComplete}</div>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab('ipd-scheduled')}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">IPD Scheduled</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.ipdScheduled}</div>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab('admitted')}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Admitted</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.admitted}</div>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab('queries')}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Pending Queries</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold flex items-center gap-2">
                  {stats.pendingQueries}
                  {stats.pendingQueries > 0 && <AlertCircle className="w-5 h-5 text-destructive" />}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Active Cases Table */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>
                    {activeTab === 'awaiting-kyp' && 'Awaiting KYP Submission'}
                    {activeTab === 'ready-preauth' && 'Ready for Pre-Auth'}
                    {activeTab === 'preauth-complete' && 'Pre-Auth Complete'}
                    {activeTab === 'ipd-scheduled' && 'IPD Scheduled Patients'}
                    {activeTab === 'admitted' && 'Admitted Patients'}
                    {activeTab === 'queries' && 'Pending Queries'}
                  </CardTitle>
                  <CardDescription>
                    {filteredLeads.length} case{filteredLeads.length !== 1 ? 's' : ''}
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant={activeTab === 'awaiting-kyp' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setActiveTab('awaiting-kyp')}
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    KYP
                  </Button>
                  <Button
                    variant={activeTab === 'ready-preauth' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setActiveTab('ready-preauth')}
                  >
                    <ArrowRight className="w-4 h-4 mr-2" />
                    Pre-Auth
                  </Button>
                  <Button
                    variant={activeTab === 'preauth-complete' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setActiveTab('preauth-complete')}
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Complete
                  </Button>
                  <Button
                    variant={activeTab === 'ipd-scheduled' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setActiveTab('ipd-scheduled')}
                  >
                    <Clock className="w-4 h-4 mr-2" />
                    Scheduled
                  </Button>
                  <Button
                    variant={activeTab === 'admitted' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setActiveTab('admitted')}
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Admitted
                  </Button>
                  <Button
                    variant={activeTab === 'queries' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setActiveTab('queries')}
                  >
                    <AlertCircle className="w-4 h-4 mr-2" />
                    Queries
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : filteredLeads.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No cases found in this category
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Lead Ref</TableHead>
                      <TableHead>Patient</TableHead>
                      <TableHead>Hospital</TableHead>
                      <TableHead>Treatment</TableHead>
                      <TableHead>Stage</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLeads.map((lead) => {
                      const leadQueries = queryMap.get(lead.id) || []
                      const pendingQueries = leadQueries.filter((q: any) => q.status === 'PENDING')
                      
                      return (
                        <TableRow key={lead.id}>
                          <TableCell className="font-medium">{lead.leadRef}</TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">{lead.patientName}</div>
                              <div className="text-sm text-muted-foreground">{getPhoneDisplay(lead.phoneNumber, canViewPhoneNumber(user ? { role: user.role } : null))}</div>
                            </div>
                          </TableCell>
                          <TableCell>{lead.hospitalName}</TableCell>
                          <TableCell>{lead.treatment || '-'}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getStageBadge(lead.caseStage)}
                              {pendingQueries.length > 0 && (
                                <Badge variant="destructive" className="text-xs">
                                  {pendingQueries.length} query{pendingQueries.length !== 1 ? 'ies' : 'y'}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {lead.createdDate
                              ? format(new Date(lead.createdDate), 'MMM dd, yyyy')
                              : '-'}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => router.push(`/patient/${lead.id}`)}
                            >
                              <Eye className="w-4 h-4 mr-2" />
                              View
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AuthenticatedLayout>
  )
}
