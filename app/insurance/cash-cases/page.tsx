'use client'

import { ProtectedRoute } from '@/components/protected-route'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost } from '@/lib/api-client'
import { format } from 'date-fns'
import { useRouter } from 'next/navigation'
import { CaseStage, FlowType } from '@/generated/prisma/enums'
import { useState, useMemo } from 'react'
import {
  FileText, AlertCircle, CheckCircle2, Clock, ArrowRight,
  Receipt, Shield, Activity, Search, LayoutList, CalendarDays, BarChart3,
  AlertTriangle, Wallet, XCircle
} from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { canViewPhoneNumber } from '@/lib/case-permissions'
import { getLatestActivityTime } from '@/lib/lead-activity'
import { getPhoneDisplay } from '@/lib/phone-utils'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

interface LeadWithStage {
  id: string
  leadRef: string
  patientName: string
  phoneNumber: string
  circle?: string | null
  hospitalName: string
  treatment?: string
  caseStage: CaseStage
  flowType: FlowType
  createdDate: string
  updatedDate: string
  dischargeSheet?: { id: string; updatedAt?: string } | null
  kypSubmission?: {
    updatedAt?: string
    preAuthData?: {
      updatedAt?: string
      queries?: { updatedAt?: string }[]
    } | null
  } | null
  insuranceInitiateForm?: { id: string; updatedAt?: string } | null
  admissionRecord?: {
    ipdStatusUpdatedAt?: string | null
    initiatedAt?: string
  } | null
  plRecord?: { updatedAt?: string } | null
  caseStageHistory?: { changedAt?: string }[]
  caseChatMessages?: { createdAt?: string }[]
}

type TabKey =
  | 'pending-review'
  | 'on-hold'
  | 'approved'
  | 'discharge-done'
  | 'all-cash'

export default function InsuranceCashCasesPage() {
  const { user } = useAuth()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<TabKey>('pending-review')
  const [searchQuery, setSearchQuery] = useState('')
  
  // Review Modal State
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)
  const [reviewAction, setReviewAction] = useState<'APPROVE' | 'HOLD' | null>(null)
  const [reviewReason, setReviewReason] = useState('')
  const [submittingReview, setSubmittingReview] = useState(false)

  const { data: leads, isLoading, error } = useQuery<LeadWithStage[]>({
    queryKey: ['leads', 'insurance', 'cash'],
    queryFn: async () => {
      try {
        const data = await apiGet<LeadWithStage[]>('/api/leads')
        // Filter for cash flow leads only
        return (data || []).filter(l => l.flowType === FlowType.CASH)
      } catch (err) {
        console.error('Error fetching leads:', err)
        return []
      }
    },
    enabled: true,
  })

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    if (!leads) return { pendingReview: 0, onHold: 0, approved: 0, dischargeDone: 0, allCash: 0 }
    return {
      pendingReview: leads.filter(l => l.caseStage === CaseStage.CASH_IPD_SUBMITTED).length,
      onHold: leads.filter(l => l.caseStage === CaseStage.CASH_ON_HOLD).length,
      approved: leads.filter(l => l.caseStage === CaseStage.CASH_APPROVED).length,
      dischargeDone: leads.filter(l => l.caseStage === CaseStage.CASH_DISCHARGED).length,
      allCash: leads.length,
    }
  }, [leads])

  // ── Filtered leads per tab ─────────────────────────────────────────────────
  const filteredLeads = useMemo(() => {
    if (!leads) return []

    let result = leads.filter(lead => {
      switch (activeTab) {
        case 'pending-review':
          return lead.caseStage === CaseStage.CASH_IPD_SUBMITTED
        case 'on-hold':
          return lead.caseStage === CaseStage.CASH_ON_HOLD
        case 'approved':
          return lead.caseStage === CaseStage.CASH_APPROVED
        case 'discharge-done':
          return lead.caseStage === CaseStage.CASH_DISCHARGED
        case 'all-cash':
          return true
        default:
          return false
      }
    })

    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter(l =>
        l.patientName.toLowerCase().includes(q) ||
        l.leadRef.toLowerCase().includes(q) ||
        l.hospitalName.toLowerCase().includes(q) ||
        (l.treatment && l.treatment.toLowerCase().includes(q))
      )
    }

    // Sort by latest activity (newest first)
    return result.sort((a, b) => getLatestActivityTime(b) - getLatestActivityTime(a))
  }, [leads, activeTab, searchQuery])

  // ── Review Handler ─────────────────────────────────────────────────────────
  const handleReview = async () => {
    if (!selectedLeadId || !reviewAction) return
    
    setSubmittingReview(true)
    try {
      await apiPost(`/api/leads/${selectedLeadId}/cash-review`, {
        action: reviewAction,
        reason: reviewReason,
      })
      toast.success(`Case ${reviewAction === 'APPROVE' ? 'Approved' : 'Put on Hold'}`)
      setShowReviewModal(false)
      setSelectedLeadId(null)
      setReviewAction(null)
      setReviewReason('')
      queryClient.invalidateQueries({ queryKey: ['leads', 'insurance', 'cash'] })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to submit review')
    } finally {
      setSubmittingReview(false)
    }
  }

  // ── Components ─────────────────────────────────────────────────────────────
  const getStageBadge = (stage: CaseStage) => {
    const badgeConfig: Record<string, { className: string }> = {
      [CaseStage.CASH_IPD_PENDING]: { className: 'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300' },
      [CaseStage.CASH_IPD_SUBMITTED]: { className: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
      [CaseStage.CASH_ON_HOLD]: { className: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300' },
      [CaseStage.CASH_APPROVED]: { className: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
      [CaseStage.CASH_DISCHARGED]: { className: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300' },
    }
    const config = badgeConfig[stage] || { className: 'bg-gray-100 text-gray-700' }
    return <Badge variant="secondary" className={config.className}>{stage.replace(/_/g, ' ').replace('CASH ', '')}</Badge>
  }

  const tabs: { id: TabKey; label: string; icon: React.FC<{ className?: string }>; value: number; gradient: string; bgGradient: string; iconColor: string; borderColor: string }[] = [
    { id: 'pending-review', label: 'Pending Review', icon: Clock, value: stats.pendingReview, gradient: 'from-blue-500 to-cyan-500', bgGradient: 'from-blue-50 to-cyan-50 dark:from-blue-950 dark:to-cyan-950', iconColor: 'text-blue-600 dark:text-blue-400', borderColor: 'border-blue-200 dark:border-blue-800' },
    { id: 'on-hold', label: 'On Hold', icon: AlertCircle, value: stats.onHold, gradient: 'from-amber-500 to-orange-500', bgGradient: 'from-amber-50 to-orange-50 dark:from-amber-950 dark:to-orange-950', iconColor: 'text-amber-600 dark:text-amber-400', borderColor: 'border-amber-200 dark:border-amber-800' },
    { id: 'approved', label: 'Approved', icon: CheckCircle2, value: stats.approved, gradient: 'from-green-500 to-emerald-500', bgGradient: 'from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950', iconColor: 'text-green-600 dark:text-green-400', borderColor: 'border-green-200 dark:border-green-800' },
    { id: 'discharge-done', label: 'Discharge Done', icon: Shield, value: stats.dischargeDone, gradient: 'from-purple-500 to-indigo-500', bgGradient: 'from-purple-50 to-indigo-50 dark:from-purple-950 dark:to-indigo-950', iconColor: 'text-purple-600 dark:text-purple-400', borderColor: 'border-purple-200 dark:border-purple-800' },
    { id: 'all-cash', label: 'All Cash Cases', icon: LayoutList, value: stats.allCash, gradient: 'from-slate-500 to-gray-500', bgGradient: 'from-slate-50 to-gray-50 dark:from-slate-950 dark:to-gray-950', iconColor: 'text-slate-600 dark:text-slate-400', borderColor: 'border-slate-200 dark:border-slate-800' },
  ]

  return (
    <ProtectedRoute>
      <div className="min-h-screen p-6">
        <div className="mx-auto max-w-7xl space-y-6">
          
          <div className="flex items-center gap-3 mb-6">
             <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                <Wallet className="w-6 h-6 text-green-600 dark:text-green-400" />
             </div>
             <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Cash Cases Dashboard</h1>
                <p className="text-gray-500 dark:text-gray-400 text-sm">Manage cash flow approvals and discharges</p>
             </div>
          </div>

          {/* ── Stage Stat Cards (tab switchers) ────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {tabs.map((card) => {
              const Icon = card.icon
              const isActive = activeTab === card.id
              return (
                <Card
                  key={card.id}
                  className={`cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-xl border-2 ${
                    isActive ? card.borderColor + ' shadow-lg ring-2 ring-offset-2' : 'border-transparent'
                  } bg-gradient-to-br ${card.bgGradient}`}
                  onClick={() => setActiveTab(card.id)}
                >
                  <CardHeader className="pb-1 pt-3 px-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-[11px] font-semibold text-gray-700 dark:text-gray-300 leading-tight">
                        {card.label}
                      </CardTitle>
                      <div className={`p-1.5 rounded-lg bg-white/50 dark:bg-black/20 ${card.iconColor}`}>
                        <Icon className="w-3 h-3" />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="px-3 pb-3">
                    <div className={`text-2xl font-bold bg-gradient-to-r ${card.gradient} bg-clip-text text-transparent`}>
                      {card.value}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* ── Work Queue Table ─────────────────────────────────────────── */}
          <Card className="border-2 shadow-lg overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 border-b">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <CardTitle className="text-xl font-bold text-gray-800 dark:text-gray-100">
                    {tabs.find(t => t.id === activeTab)?.label}
                  </CardTitle>
                </div>
                <div className="relative w-full md:w-64">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
                  <Input
                    placeholder="Search patient..."
                    className="pl-8 bg-white dark:bg-gray-950 border-gray-200 dark:border-gray-800 focus:ring-green-500"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="text-center py-12">
                  <div className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600" />
                    <span className="text-lg">Loading cases...</span>
                  </div>
                </div>
              ) : filteredLeads.length === 0 ? (
                <div className="text-center py-12">
                  <div className="inline-flex flex-col items-center gap-2 p-6 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
                    <Clock className="w-12 h-12 text-gray-500 dark:text-gray-400" />
                    <span className="text-gray-700 dark:text-gray-300 font-semibold text-lg">No cases found</span>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900">
                        <TableHead className="font-bold text-gray-700 dark:text-gray-300">Lead Ref</TableHead>
                        <TableHead className="font-bold text-gray-700 dark:text-gray-300">Patient</TableHead>
                        <TableHead className="font-bold text-gray-700 dark:text-gray-300">Hospital</TableHead>
                        <TableHead className="font-bold text-gray-700 dark:text-gray-300">Stage</TableHead>
                        <TableHead className="font-bold text-gray-700 dark:text-gray-300">Last Modified</TableHead>
                        <TableHead className="font-bold text-gray-700 dark:text-gray-300">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredLeads.map((lead) => (
                        <TableRow
                          key={lead.id}
                          className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900"
                          onClick={() => router.push(`/patient/${lead.id}`)}
                        >
                          <TableCell className="font-semibold text-gray-900 dark:text-gray-100">
                            <span className="px-2 py-1 rounded bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 text-sm font-mono">
                              {lead.leadRef}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-semibold text-gray-900 dark:text-gray-100">{lead.patientName}</div>
                              {canViewPhoneNumber(user) && <div className="text-sm text-gray-600 dark:text-gray-400">{lead.phoneNumber}</div>}
                            </div>
                          </TableCell>
                          <TableCell className="text-gray-700 dark:text-gray-300">{lead.hospitalName}</TableCell>
                          <TableCell>{getStageBadge(lead.caseStage)}</TableCell>
                          <TableCell className="text-gray-600 dark:text-gray-400">
                            {(() => {
                              const t = getLatestActivityTime(lead)
                              return t ? format(new Date(t), 'MMM dd, HH:mm') : '-'
                            })()}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                              {/* Review Action */}
                              {(lead.caseStage === CaseStage.CASH_IPD_SUBMITTED || lead.caseStage === CaseStage.CASH_ON_HOLD) && (
                                <Button
                                  variant="default"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setSelectedLeadId(lead.id)
                                    setShowReviewModal(true)
                                  }}
                                  className="bg-blue-600 hover:bg-blue-700 text-white"
                                >
                                  Review
                                </Button>
                              )}
                              
                              {/* Discharge Action */}
                              {lead.caseStage === CaseStage.CASH_APPROVED && !lead.dischargeSheet && (
                                <Button
                                  variant="default"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    router.push(`/patient/${lead.id}/discharge-cash`)
                                  }}
                                  className="bg-teal-600 hover:bg-teal-700 text-white"
                                >
                                  Fill Discharge
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Review Modal */}
        <Dialog open={showReviewModal} onOpenChange={setShowReviewModal}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Review Cash Case</DialogTitle>
              <DialogDescription>
                Approve or hold this cash case.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex gap-2">
                <Button
                  variant={reviewAction === 'APPROVE' ? 'default' : 'outline'}
                  className={`flex-1 ${reviewAction === 'APPROVE' ? 'bg-green-600 hover:bg-green-700' : ''}`}
                  onClick={() => setReviewAction('APPROVE')}
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" /> Approve
                </Button>
                <Button
                  variant={reviewAction === 'HOLD' ? 'default' : 'outline'}
                  className={`flex-1 ${reviewAction === 'HOLD' ? 'bg-amber-600 hover:bg-amber-700' : ''}`}
                  onClick={() => setReviewAction('HOLD')}
                >
                  <AlertCircle className="mr-2 h-4 w-4" /> Hold
                </Button>
              </div>
              
              <div>
                <Label htmlFor="reviewReason">Reason / Notes</Label>
                <Textarea
                  id="reviewReason"
                  value={reviewReason}
                  onChange={(e) => setReviewReason(e.target.value)}
                  placeholder={reviewAction === 'HOLD' ? 'Reason for holding is required...' : 'Optional notes...'}
                  className="mt-2"
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={() => setShowReviewModal(false)}>Cancel</Button>
                <Button 
                  onClick={handleReview} 
                  disabled={!reviewAction || (reviewAction === 'HOLD' && !reviewReason.trim()) || submittingReview}
                >
                  {submittingReview ? 'Submitting...' : 'Submit Review'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

      </div>
    </ProtectedRoute>
  )
}
