'use client'

import { ProtectedRoute } from '@/components/protected-route'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import { format, startOfDay, startOfMonth } from 'date-fns'
import { useRouter } from 'next/navigation'
import { CaseStage } from '@/generated/prisma/enums'
import { useState, useMemo, useEffect } from 'react'
import {
  FileText, AlertCircle, CheckCircle2, Clock, ArrowRight,
  Receipt, Shield, Activity, Search, LayoutList, CalendarDays, BarChart3,
  AlertTriangle, CalendarCheck, X,
} from 'lucide-react'
import { PreAuthStatus } from '@/generated/prisma/enums'
import { useAuth } from '@/hooks/use-auth'
import { getCaseStageBadgeConfig } from '@/lib/case-stage-labels'
import { getLatestActivityTime } from '@/lib/lead-activity'
import { canViewPhoneNumber } from '@/lib/case-permissions'
import { getPhoneDisplay } from '@/lib/phone-utils'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'

interface LeadWithStage {
  id: string
  leadRef: string
  patientName: string
  phoneNumber: string
  circle?: string | null
  hospitalName: string
  treatment?: string
  caseStage: CaseStage
  bdId?: string | null
  bd?: { id: string; name: string } | null
  createdDate: string
  updatedDate: string
  kypSubmission?: {
    id: string
    status: string
    submittedAt: string
    updatedAt?: string
    preAuthData?: {
      id: string
      requestedHospitalName?: string | null
      requestedRoomType?: string | null
      bdSuggestedHospital?: string | null
      diseaseDescription?: string | null
      diseaseImages?: Array<{ name: string; url: string }> | null
      preAuthRaisedAt?: string | null
      sumInsured?: string | null
      roomRent?: string | null
      capping?: string | null
      copay?: string | null
      icu?: string | null
      insurance?: string | null
      tpa?: string | null
      hospitalNameSuggestion?: string | null
      hospitalSuggestions?: string[] | null
      roomTypes?: Array<{ name: string; rent: string }> | null
      handledAt?: string | null
      approvalStatus?: PreAuthStatus
      rejectionReason?: string | null
      updatedAt?: string
      queries?: { updatedAt?: string }[]
      handledBy?: { id: string; name: string } | null
      preAuthRaisedBy?: { id: string; name: string } | null
    } | null
  } | null
  admissionRecord?: {
    id: string
    admissionDate: string
    admittingHospital: string
    ipdStatus?: string | null
    ipdStatusUpdatedAt?: string | null
    initiatedAt?: string
  } | null
  dischargeSheet?: { id: string; isFinalized?: boolean; dischargeDate?: string | null; markedAt?: string | null; updatedAt?: string } | null
  insuranceInitiateForm?: { id: string; updatedAt?: string } | null
  plRecord?: { updatedAt?: string } | null
  caseStageHistory?: { changedAt?: string }[]
  caseChatMessages?: { createdAt?: string }[]
}

const IPD_MARK_OPTIONS = [
  { value: '', label: 'All marks' },
  { value: 'ADMITTED_DONE', label: 'Admitted' },
  { value: 'IPD_DONE', label: 'Surgery Done' },
  { value: 'POSTPONED', label: 'Postponed' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'NONE', label: 'Not set' },
] as const
type IpdMarkFilterValue = '' | 'ADMITTED_DONE' | 'IPD_DONE' | 'POSTPONED' | 'CANCELLED' | 'NONE'

type TabKey =
  | 'kyp-review'
  | 'preauth-raised'
  | 'preauth-complete'
  | 'admitted'
  | 'to-mark-discharged'
  | 'to-fill-sheet'
  | 'ipd-done'
  | 'all-patients'

const KYP_STAGES: CaseStage[] = [
  CaseStage.KYP_BASIC_PENDING,
  CaseStage.KYP_BASIC_COMPLETE,
  CaseStage.KYP_DETAILED_PENDING,
  CaseStage.KYP_DETAILED_COMPLETE,
  CaseStage.KYP_PENDING,
  CaseStage.KYP_COMPLETE,
  CaseStage.HOSPITALS_SUGGESTED,
]

// BD has marked IPD_DONE, no sheet yet → Insurance needs to mark discharge date.
function needsMarkDischarged(lead: LeadWithStage): boolean {
  return lead.caseStage === CaseStage.IPD_DONE && !lead.dischargeSheet
}

// Insurance has marked discharged (or legacy DISCHARGED leads), full sheet not filled yet.
function needsSheetFilled(lead: LeadWithStage): boolean {
  if (lead.caseStage !== CaseStage.DISCHARGED) return false
  if (!lead.dischargeSheet) return true // legacy: skipped mark step
  return lead.dischargeSheet.isFinalized === false
}

function getPriorityTier(lead: LeadWithStage): 0 | 1 | 2 | 3 {
  // Tier 3: Hospital Suggestion Pending (Highest)
  if (lead.caseStage === CaseStage.HOSPITALS_SUGGESTED && lead.kypSubmission?.preAuthData?.bdSuggestedHospital) return 3
  // Tier 1: needs Insurance touch on the discharge flow
  if (needsMarkDischarged(lead) || needsSheetFilled(lead)) return 1
  // Tier 2: Initial Form Pending
  if (lead.caseStage === CaseStage.PREAUTH_COMPLETE && !lead.insuranceInitiateForm) return 2
  return 0
}

const FILTER_STORAGE_KEY = 'insurance-dashboard-filters-v1'
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const ANY_VALUE = '__any__'

function getIpdMarkBadgeClass(status: string | null | undefined): string {
  switch (status) {
    case 'ADMITTED_DONE': return 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 border-green-200 dark:border-green-800'
    case 'IPD_DONE': return 'bg-teal-100 dark:bg-teal-900 text-teal-800 dark:text-teal-200 border-teal-200 dark:border-teal-800'
    case 'POSTPONED': return 'bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-800'
    case 'CANCELLED': return 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 border-red-200 dark:border-red-800'
    case 'DISCHARGED': return 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-800'
    default: return 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700'
  }
}

function getIpdMarkLabel(status: string | null | undefined): string {
  if (!status) return '–'
  switch (status) {
    case 'ADMITTED_DONE': return 'Admitted'
    case 'IPD_DONE': return 'Surgery Done'
    case 'POSTPONED': return 'Postponed'
    case 'CANCELLED': return 'Cancelled'
    case 'DISCHARGED': return 'Discharged'
    default: return status.replace(/_/g, ' ')
  }
}

export default function InsuranceDashboardPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabKey>('kyp-review')
  const [searchQuery, setSearchQuery] = useState('')
  const [ipdMarkFilter, setIpdMarkFilter] = useState<IpdMarkFilterValue>('')
  const [preAuthFilter, setPreAuthFilter] = useState<'all' | 'pending' | 'rejected'>('all')

  // ── Filter bar (persisted) ───────────────────────────────────────────────
  const now = new Date()
  const [activityMonth, setActivityMonth] = useState<number>(now.getMonth() + 1)
  const [activityYear, setActivityYear] = useState<number>(now.getFullYear())
  const [bdFilter, setBdFilter] = useState<string>('') // bd user id, '' = all
  const [circleFilter, setCircleFilter] = useState<string>('')
  const [treatmentFilter, setTreatmentFilter] = useState<string>('')
  const [hydrated, setHydrated] = useState(false)

  // Restore from localStorage (client-only)
  useEffect(() => {
    try {
      const raw = typeof window !== 'undefined' && window.localStorage.getItem(FILTER_STORAGE_KEY)
      if (raw) {
        const saved = JSON.parse(raw) as Partial<{
          activityMonth: number; activityYear: number;
          bdFilter: string; circleFilter: string; treatmentFilter: string;
        }>
        if (typeof saved.activityMonth === 'number') setActivityMonth(saved.activityMonth)
        if (typeof saved.activityYear === 'number') setActivityYear(saved.activityYear)
        if (typeof saved.bdFilter === 'string') setBdFilter(saved.bdFilter)
        if (typeof saved.circleFilter === 'string') setCircleFilter(saved.circleFilter)
        if (typeof saved.treatmentFilter === 'string') setTreatmentFilter(saved.treatmentFilter)
      }
    } catch { /* ignore */ }
    setHydrated(true)
  }, [])

  // Persist on change (skip first render before hydration)
  useEffect(() => {
    if (!hydrated) return
    try {
      window.localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify({
        activityMonth, activityYear, bdFilter, circleFilter, treatmentFilter,
      }))
    } catch { /* ignore */ }
  }, [hydrated, activityMonth, activityYear, bdFilter, circleFilter, treatmentFilter])

  // Build server query: only send activity window + bd to server. Circle and
  // treatment are filtered client-side so they don't shrink the dropdown lists.
  const leadsQueryString = useMemo(() => {
    const params = new URLSearchParams()
    params.set('activityMonth', String(activityMonth))
    params.set('activityYear', String(activityYear))
    if (bdFilter) params.set('bdId', bdFilter)
    return params.toString()
  }, [activityMonth, activityYear, bdFilter])

  const { data: leads, isLoading, error } = useQuery<LeadWithStage[]>({
    queryKey: ['leads', 'insurance', leadsQueryString],
    queryFn: async () => {
      try {
        const data = await apiGet<LeadWithStage[]>(`/api/leads?${leadsQueryString}`)
        return data || []
      } catch (err) {
        console.error('Error fetching leads:', err)
        return []
      }
    },
    enabled: hydrated,
  })

  // Universe for dropdown options — unfiltered by activity month so users can
  // always find their BD / circle / treatment regardless of the active window.
  const { data: universeLeads } = useQuery<Pick<LeadWithStage, 'bdId' | 'bd' | 'circle' | 'treatment'>[]>({
    queryKey: ['leads', 'insurance', 'universe'],
    queryFn: async () => {
      try {
        const data = await apiGet<LeadWithStage[]>('/api/leads')
        return (data || []).map(l => ({ bdId: l.bdId, bd: l.bd, circle: l.circle, treatment: l.treatment }))
      } catch { return [] }
    },
    enabled: hydrated,
    staleTime: 5 * 60 * 1000,
  })

  const bdOptions = useMemo(() => {
    const map = new Map<string, string>()
    ;(universeLeads || []).forEach(l => {
      if (l.bdId && l.bd?.name) map.set(l.bdId, l.bd.name)
    })
    return Array.from(map.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
  }, [universeLeads])

  const circleOptions = useMemo(() => {
    const set = new Set<string>()
    ;(universeLeads || []).forEach(l => { if (l.circle) set.add(l.circle) })
    return Array.from(set).sort()
  }, [universeLeads])

  const treatmentOptions = useMemo(() => {
    const set = new Set<string>()
    ;(universeLeads || []).forEach(l => { if (l.treatment) set.add(l.treatment) })
    return Array.from(set).sort()
  }, [universeLeads])

  const yearOptions = useMemo(() => {
    const y = now.getFullYear()
    return [y - 2, y - 1, y, y + 1]
  }, [now])

  const resetFilters = () => {
    setActivityMonth(now.getMonth() + 1)
    setActivityYear(now.getFullYear())
    setBdFilter('')
    setCircleFilter('')
    setTreatmentFilter('')
  }
  const filtersActive =
    activityMonth !== now.getMonth() + 1 ||
    activityYear !== now.getFullYear() ||
    !!bdFilter || !!circleFilter || !!treatmentFilter

  // Apply client-side circle + treatment filters so dropdown universe stays full
  const scopedLeads = useMemo(() => {
    if (!leads) return []
    return leads.filter(l => {
      if (circleFilter && l.circle !== circleFilter) return false
      if (treatmentFilter && l.treatment !== treatmentFilter) return false
      return true
    })
  }, [leads, circleFilter, treatmentFilter])

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    if (!scopedLeads.length && !leads) return { kypReview: 0, preAuthRaised: 0, preAuthPending: 0, preAuthRejected: 0, preAuthComplete: 0, admitted: 0, toMarkDischarged: 0, toFillSheet: 0, ipdDone: 0, allPatients: 0, ipdScheduled: 0 }
    const preAuthRaisedLeads = scopedLeads.filter(l => l.caseStage === CaseStage.PREAUTH_RAISED)
    return {
      kypReview: scopedLeads.filter(l => KYP_STAGES.includes(l.caseStage) || (l.kypSubmission && l.caseStage === CaseStage.NEW_LEAD)).length,
      preAuthRaised: preAuthRaisedLeads.length,
      preAuthPending: preAuthRaisedLeads.filter(l => !l.kypSubmission?.preAuthData?.approvalStatus || l.kypSubmission.preAuthData.approvalStatus === PreAuthStatus.PENDING).length,
      preAuthRejected: preAuthRaisedLeads.filter(l => l.kypSubmission?.preAuthData?.approvalStatus === PreAuthStatus.REJECTED).length,
      preAuthComplete: scopedLeads.filter(l => l.caseStage === CaseStage.PREAUTH_COMPLETE).length,
      admitted: scopedLeads.filter(l => l.caseStage === CaseStage.INITIATED || l.caseStage === CaseStage.ADMITTED).length,
      toMarkDischarged: scopedLeads.filter(needsMarkDischarged).length,
      toFillSheet: scopedLeads.filter(needsSheetFilled).length,
      ipdDone: scopedLeads.filter(l => l.caseStage === CaseStage.IPD_DONE || l.caseStage === CaseStage.DISCHARGED || l.caseStage === CaseStage.PL_PENDING).length,
      ipdScheduled: scopedLeads.filter(l => l.caseStage === CaseStage.INITIATED || l.caseStage === CaseStage.ADMITTED).length,
      allPatients: scopedLeads.length,
    }
  }, [leads, scopedLeads])

  // ── IPD chart data ─────────────────────────────────────────────────────────
  const ipdChartData = useMemo(() => {
    if (!scopedLeads.length) return { daily: [], monthly: [] }
    const ipdLeads = scopedLeads.filter(l =>
      l.caseStage === CaseStage.IPD_DONE ||
      l.caseStage === CaseStage.INITIATED ||
      l.caseStage === CaseStage.ADMITTED ||
      l.caseStage === CaseStage.DISCHARGED
    )

    // Day-wise: last 14 days
    const dayMap = new Map<string, number>()
    for (let i = 13; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      dayMap.set(format(startOfDay(d), 'MMM d'), 0)
    }
    ipdLeads.forEach(l => {
      const date = l.updatedDate || l.createdDate
      if (!date) return
      const key = format(startOfDay(new Date(date)), 'MMM d')
      if (dayMap.has(key)) dayMap.set(key, (dayMap.get(key) || 0) + 1)
    })
    const daily = Array.from(dayMap.entries()).map(([day, count]) => ({ day, count }))

    // Month-wise: last 6 months
    const monthMap = new Map<string, number>()
    for (let i = 5; i >= 0; i--) {
      const d = new Date()
      d.setMonth(d.getMonth() - i)
      monthMap.set(format(startOfMonth(d), 'MMM yy'), 0)
    }
    ipdLeads.forEach(l => {
      const date = l.updatedDate || l.createdDate
      if (!date) return
      const key = format(startOfMonth(new Date(date)), 'MMM yy')
      if (monthMap.has(key)) monthMap.set(key, (monthMap.get(key) || 0) + 1)
    })
    const monthly = Array.from(monthMap.entries()).map(([month, count]) => ({ month, count }))

    return { daily, monthly }
  }, [leads])

  // ── Filtered leads per tab ─────────────────────────────────────────────────
  const filteredLeads = useMemo(() => {
    if (!scopedLeads.length) return []

    let result = scopedLeads.filter(lead => {
      switch (activeTab) {
        case 'kyp-review':
          return KYP_STAGES.includes(lead.caseStage) || (lead.kypSubmission && lead.caseStage === CaseStage.NEW_LEAD)
        case 'preauth-raised': {
          if (lead.caseStage !== CaseStage.PREAUTH_RAISED) return false
          if (preAuthFilter === 'pending') return !lead.kypSubmission?.preAuthData?.approvalStatus || lead.kypSubmission.preAuthData.approvalStatus === PreAuthStatus.PENDING
          if (preAuthFilter === 'rejected') return lead.kypSubmission?.preAuthData?.approvalStatus === PreAuthStatus.REJECTED
          return true
        }
        case 'preauth-complete':
          return lead.caseStage === CaseStage.PREAUTH_COMPLETE
        case 'admitted':
          return lead.caseStage === CaseStage.INITIATED || lead.caseStage === CaseStage.ADMITTED
        case 'to-mark-discharged':
          return needsMarkDischarged(lead)
        case 'to-fill-sheet':
          return needsSheetFilled(lead)
        case 'ipd-done':
          return lead.caseStage === CaseStage.IPD_DONE
            || lead.caseStage === CaseStage.DISCHARGED
            || lead.caseStage === CaseStage.PL_PENDING
        case 'all-patients':
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

    if (ipdMarkFilter === 'NONE') {
      result = result.filter(l => !l.admissionRecord?.ipdStatus)
    } else if (ipdMarkFilter) {
      result = result.filter(l => l.admissionRecord?.ipdStatus === ipdMarkFilter)
    }

    // Priority sort: tier 3 > tier 1 > tier 2 > rest, then by latest activity
    return result.sort((a, b) => {
      const tierA = getPriorityTier(a)
      const tierB = getPriorityTier(b)
      if (tierA !== tierB) return tierB - tierA // higher tier first
      return getLatestActivityTime(b) - getLatestActivityTime(a)
    })
  }, [scopedLeads, activeTab, searchQuery, ipdMarkFilter, preAuthFilter])

  // ── Pending Hospital Suggestions ───────────────────────────────────────────
  const pendingSuggestions = useMemo(() => {
    if (!scopedLeads.length) return []
    return scopedLeads.filter(l =>
      l.caseStage === CaseStage.HOSPITALS_SUGGESTED &&
      l.kypSubmission?.preAuthData?.bdSuggestedHospital
    )
  }, [scopedLeads])

  // ── Components ─────────────────────────────────────────────────────────────
  const getStageBadge = (stage: CaseStage) => {
    const { className, label } = getCaseStageBadgeConfig(stage)
    return <Badge variant="secondary" className={className}>{label}</Badge>
  }

  const tabs: { id: TabKey; label: string; icon: React.FC<{ className?: string }>; value: number; gradient: string; bgGradient: string; iconColor: string; borderColor: string }[] = [
    { id: 'kyp-review', label: 'Card Details', icon: FileText, value: stats.kypReview, gradient: 'from-blue-500 to-cyan-500', bgGradient: 'from-blue-50 to-cyan-50 dark:from-blue-950 dark:to-cyan-950', iconColor: 'text-blue-600 dark:text-blue-400', borderColor: 'border-blue-200 dark:border-blue-800' },
    { id: 'preauth-raised', label: 'Pre-Auth Raised', icon: ArrowRight, value: stats.preAuthRaised, gradient: 'from-purple-500 to-pink-500', bgGradient: 'from-purple-50 to-pink-50 dark:from-purple-950 dark:to-pink-950', iconColor: 'text-purple-600 dark:text-purple-400', borderColor: 'border-purple-200 dark:border-purple-800' },
    { id: 'preauth-complete', label: 'Pre-Auth Approved', icon: CheckCircle2, value: stats.preAuthComplete, gradient: 'from-green-500 to-emerald-500', bgGradient: 'from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950', iconColor: 'text-green-600 dark:text-green-400', borderColor: 'border-green-200 dark:border-green-800' },
    { id: 'admitted', label: 'IPD / Admitted', icon: Activity, value: stats.admitted, gradient: 'from-indigo-500 to-blue-500', bgGradient: 'from-indigo-50 to-blue-50 dark:from-indigo-950 dark:to-blue-950', iconColor: 'text-indigo-600 dark:text-indigo-400', borderColor: 'border-indigo-200 dark:border-indigo-800' },
    { id: 'to-mark-discharged', label: 'To Mark Discharged', icon: CalendarCheck, value: stats.toMarkDischarged, gradient: 'from-orange-500 to-amber-500', bgGradient: 'from-orange-50 to-amber-50 dark:from-orange-950 dark:to-amber-950', iconColor: 'text-orange-600 dark:text-orange-400', borderColor: 'border-orange-200 dark:border-orange-800' },
    { id: 'to-fill-sheet', label: 'To Fill Sheet', icon: Receipt, value: stats.toFillSheet, gradient: 'from-rose-500 to-orange-500', bgGradient: 'from-rose-50 to-orange-50 dark:from-rose-950 dark:to-orange-950', iconColor: 'text-rose-600 dark:text-rose-400', borderColor: 'border-rose-200 dark:border-rose-800' },
    { id: 'ipd-done', label: 'IPD Done (all)', icon: Shield, value: stats.ipdDone, gradient: 'from-teal-500 to-cyan-500', bgGradient: 'from-teal-50 to-cyan-50 dark:from-teal-950 dark:to-cyan-950', iconColor: 'text-teal-600 dark:text-teal-400', borderColor: 'border-teal-200 dark:border-teal-800' },
    { id: 'all-patients', label: 'All Patients', icon: LayoutList, value: stats.allPatients, gradient: 'from-slate-500 to-gray-500', bgGradient: 'from-slate-50 to-gray-50 dark:from-slate-950 dark:to-gray-950', iconColor: 'text-slate-600 dark:text-slate-400', borderColor: 'border-slate-200 dark:border-slate-800' },
  ]

  const tabLabels: Record<TabKey, string> = {
    'kyp-review': 'Card Details & Hospitals',
    'preauth-raised': 'Pre-Auth Raised',
    'preauth-complete': 'Pre-Auth Approved',
    'admitted': 'IPD / Admitted',
    'to-mark-discharged': 'To Mark Discharged — confirm discharge date',
    'to-fill-sheet': 'To Fill Sheet — discharged, sheet pending',
    'ipd-done': 'IPD Done (incl. discharged & in PL)',
    'all-patients': 'All Patients',
  }

  const chartConfig = {
    count: { label: 'IPD Cases', color: 'rgb(var(--chart-1))' },
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen p-6">
        <div className="mx-auto max-w-7xl space-y-6">

          {/* ── Pending Hospital Suggestions Alert ────────────────────────── */}
          {pendingSuggestions.length > 0 && (
            <Card className="border-border border-l-4 border-l-amber-500 bg-card">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  <CardTitle className="text-lg font-bold text-amber-900 dark:text-amber-100">
                    Hospital Suggestions Pending ({pendingSuggestions.length})
                  </CardTitle>
                </div>
                <CardDescription className="text-amber-700 dark:text-amber-300">
                  The following cases have new hospital suggestions from BD that need your review.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {pendingSuggestions.map(lead => (
                    <div key={lead.id} className="flex items-center justify-between p-3 bg-white dark:bg-gray-900 rounded-lg border border-amber-100 dark:border-amber-900 shadow-sm">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-900 dark:text-gray-100">{lead.patientName}</span>
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">{lead.leadRef}</Badge>
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          Suggested: <span className="font-medium text-amber-700 dark:text-amber-400">{lead.kypSubmission?.preAuthData?.bdSuggestedHospital}</span>
                        </div>
                      </div>
                      <Button 
                        size="sm" 
                        className="bg-amber-600 hover:bg-amber-700 text-white border-0"
                        onClick={() => router.push(`/patient/${lead.id}/pre-auth`)}
                      >
                        Update Hospitals
                        <ArrowRight className="ml-2 h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── IPD Metrics Row ─────────────────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Quick IPD counters */}
            <div className="grid grid-cols-2 gap-4">
              <Card className="bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-teal-950 dark:to-cyan-950 border-teal-200 dark:border-teal-800 border-2">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold text-gray-700 dark:text-gray-300">Total IPD Done</CardTitle>
                    <div className="p-2 rounded-lg bg-white/50 dark:bg-black/20 text-teal-600 dark:text-teal-400">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold bg-gradient-to-r from-teal-500 to-cyan-500 bg-clip-text text-transparent">{stats.ipdDone}</div>
                  <p className="text-xs text-gray-500 mt-1">All time</p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950 dark:to-blue-950 border-indigo-200 dark:border-indigo-800 border-2">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold text-gray-700 dark:text-gray-300">IPD Scheduled</CardTitle>
                    <div className="p-2 rounded-lg bg-white/50 dark:bg-black/20 text-indigo-600 dark:text-indigo-400">
                      <CalendarDays className="w-4 h-4" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold bg-gradient-to-r from-indigo-500 to-blue-500 bg-clip-text text-transparent">{stats.ipdScheduled}</div>
                  <p className="text-xs text-gray-500 mt-1">Currently admitted / initiated</p>
                </CardContent>
              </Card>
            </div>

            {/* Day-wise chart */}
            <Card className="border-2">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-blue-500" />
                  <CardTitle className="text-sm font-semibold text-gray-700 dark:text-gray-300">IPD Activity – Last 14 Days</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-2">
                <ChartContainer config={chartConfig} className="h-[110px] w-full">
                  <BarChart data={ipdChartData.daily} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="day" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} interval={2} />
                    <YAxis tick={{ fontSize: 9 }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>

          {/* Month-wise chart */}
          <Card className="border-2">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-purple-500" />
                <CardTitle className="text-sm font-semibold text-gray-700 dark:text-gray-300">IPD Activity – Last 6 Months</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-2">
              <ChartContainer config={{ count: { label: 'IPD Cases', color: 'rgb(var(--chart-2))' } }} className="h-[110px] w-full">
                <BarChart data={ipdChartData.monthly} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* ── Filter Bar ─────────────────────────────────────────────── */}
          <Card className="border-2 bg-white dark:bg-gray-950">
            <CardContent className="py-3 px-4">
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold uppercase text-gray-500">Active in</label>
                  <div className="flex gap-1">
                    <Select value={String(activityMonth)} onValueChange={(v) => setActivityMonth(parseInt(v, 10))}>
                      <SelectTrigger className="w-[110px] h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MONTH_NAMES.map((name, i) => (
                          <SelectItem key={i} value={String(i + 1)}>{name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={String(activityYear)} onValueChange={(v) => setActivityYear(parseInt(v, 10))}>
                      <SelectTrigger className="w-[90px] h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {yearOptions.map(y => (
                          <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold uppercase text-gray-500">BD</label>
                  <Select value={bdFilter || ANY_VALUE} onValueChange={(v) => setBdFilter(v === ANY_VALUE ? '' : v)}>
                    <SelectTrigger className="w-[180px] h-9">
                      <SelectValue placeholder="All BDs" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ANY_VALUE}>All BDs</SelectItem>
                      {bdOptions.map(opt => (
                        <SelectItem key={opt.id} value={opt.id}>{opt.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold uppercase text-gray-500">Circle</label>
                  <Select value={circleFilter || ANY_VALUE} onValueChange={(v) => setCircleFilter(v === ANY_VALUE ? '' : v)}>
                    <SelectTrigger className="w-[160px] h-9">
                      <SelectValue placeholder="All circles" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ANY_VALUE}>All circles</SelectItem>
                      {circleOptions.map(c => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold uppercase text-gray-500">Treatment</label>
                  <Select value={treatmentFilter || ANY_VALUE} onValueChange={(v) => setTreatmentFilter(v === ANY_VALUE ? '' : v)}>
                    <SelectTrigger className="w-[200px] h-9">
                      <SelectValue placeholder="All treatments" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ANY_VALUE}>All treatments</SelectItem>
                      {treatmentOptions.map(t => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {filtersActive && (
                  <Button variant="ghost" size="sm" onClick={resetFilters} className="h-9 text-gray-600">
                    <X className="h-4 w-4 mr-1" />
                    Reset
                  </Button>
                )}

                <div className="ml-auto text-xs text-gray-500">
                  Showing cases that moved in <span className="font-semibold">{MONTH_NAMES[activityMonth - 1]} {activityYear}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── Stage Stat Cards (tab switchers) ────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
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
                  <CardTitle className="text-2xl font-bold text-gray-800 dark:text-gray-100">
                    {tabLabels[activeTab]}
                  </CardTitle>
                  <CardDescription className="text-base mt-1">
                    <span className="font-semibold text-gray-700 dark:text-gray-300">{filteredLeads.length}</span> case{filteredLeads.length !== 1 ? 's' : ''}
                    {activeTab === 'all-patients' && (
                      <span className="ml-2 text-amber-600 dark:text-amber-400 text-sm font-medium">
                        · Urgent cases highlighted on top
                      </span>
                    )}
                  </CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {activeTab === 'preauth-raised' && (
                    <div className="flex items-center gap-1 mr-2">
                      {([
                        { key: 'all' as const, label: 'All', count: stats.preAuthRaised },
                        { key: 'pending' as const, label: 'Pending', count: stats.preAuthPending },
                        { key: 'rejected' as const, label: 'Rejected', count: stats.preAuthRejected },
                      ] as const).map((pill) => (
                        <button
                          key={pill.key}
                          onClick={() => setPreAuthFilter(pill.key)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                            preAuthFilter === pill.key
                              ? pill.key === 'rejected'
                                ? 'bg-red-600 text-white shadow-md'
                                : 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-md'
                              : pill.key === 'rejected'
                                ? 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-950/50 border border-red-200 dark:border-red-800'
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
                          }`}
                        >
                          {pill.label}
                          <span className={`inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full text-[10px] font-bold px-1 ${
                            preAuthFilter === pill.key
                              ? 'bg-white/20 text-inherit'
                              : pill.key === 'rejected'
                                ? 'bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200'
                                : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                          }`}>
                            {pill.count}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                  <Select
                    value={ipdMarkFilter === '' ? 'all' : ipdMarkFilter}
                    onValueChange={(v) => setIpdMarkFilter((v === 'all' ? '' : v) as IpdMarkFilterValue)}
                  >
                    <SelectTrigger className="w-[140px] bg-white dark:bg-gray-950 border-gray-200 dark:border-gray-800">
                      <SelectValue placeholder="IPD mark" />
                    </SelectTrigger>
                    <SelectContent>
                      {IPD_MARK_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value || 'all'} value={opt.value || 'all'}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="relative w-full md:w-64">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
                    <Input
                      placeholder="Search patient, ref, hospital..."
                      className="pl-8 bg-white dark:bg-gray-950 border-gray-200 dark:border-gray-800 focus:ring-blue-500"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="text-center py-12">
                  <div className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
                    <span className="text-lg">Loading cases...</span>
                  </div>
                </div>
              ) : error ? (
                <div className="text-center py-12">
                  <div className="inline-flex flex-col items-center gap-2 p-4 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
                    <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
                    <span className="text-red-700 dark:text-red-300 font-semibold">
                      Error loading leads: {error instanceof Error ? error.message : 'Unknown error'}
                    </span>
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
                      <TableRow className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100 dark:hover:from-gray-800 dark:hover:to-gray-900">
                        <TableHead className="font-bold text-gray-700 dark:text-gray-300">Lead Ref</TableHead>
                        <TableHead className="font-bold text-gray-700 dark:text-gray-300">Patient</TableHead>
                        <TableHead className="font-bold text-gray-700 dark:text-gray-300">Hospital</TableHead>
                        <TableHead className="font-bold text-gray-700 dark:text-gray-300">Treatment</TableHead>
                        <TableHead className="font-bold text-gray-700 dark:text-gray-300">Stage</TableHead>
                        <TableHead className="font-bold text-gray-700 dark:text-gray-300">IPD Mark</TableHead>
                        <TableHead className="font-bold text-gray-700 dark:text-gray-300">Last Modified</TableHead>
                        <TableHead className="font-bold text-gray-700 dark:text-gray-300">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredLeads.map((lead, index) => {
                        const tier = getPriorityTier(lead)
                        const isSuggestionPending = tier === 3
                        const isMarkUrgent = needsMarkDischarged(lead)
                        const isFillUrgent = needsSheetFilled(lead)
                        const isDischargeUrgent = isMarkUrgent || isFillUrgent
                        const isInitialFormUrgent = tier === 2
                        const isRejected = lead.kypSubmission?.preAuthData?.approvalStatus === PreAuthStatus.REJECTED

                        const rowBg = isRejected
                          ? 'bg-red-50/60 dark:bg-red-950/20'
                          : isSuggestionPending
                          ? 'bg-amber-50/60 dark:bg-amber-950/20'
                          : isDischargeUrgent
                          ? 'bg-amber-50/60 dark:bg-amber-950/20'
                          : isInitialFormUrgent
                          ? 'bg-purple-50/60 dark:bg-purple-950/20'
                          : index % 2 === 0
                          ? 'bg-white dark:bg-gray-950'
                          : 'bg-gray-50/50 dark:bg-gray-900/50'

                        const borderLeft = isRejected
                          ? 'border-l-4 border-l-red-500'
                          : isSuggestionPending
                          ? 'border-l-4 border-l-amber-500'
                          : isDischargeUrgent
                          ? 'border-l-4 border-l-orange-500'
                          : isInitialFormUrgent
                          ? 'border-l-4 border-l-purple-500'
                          : 'border-l-4 border-l-transparent'

                        return (
                          <TableRow
                            key={lead.id}
                            className={`transition-colors cursor-pointer hover:brightness-95 ${rowBg} ${borderLeft}`}
                            onClick={() => router.push(`/patient/${lead.id}`)}
                          >
                            <TableCell className="font-semibold text-gray-900 dark:text-gray-100">
                              <span className="px-2 py-1 rounded bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-sm font-mono">
                                {lead.leadRef}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div>
                                <div className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-1">
                                  {lead.patientName}
                                  {isRejected && (
                                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 text-[10px] font-bold">
                                      <AlertCircle className="w-2.5 h-2.5" /> Rejected
                                    </span>
                                  )}
                                  {isSuggestionPending && (
                                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-[10px] font-bold">
                                      <AlertTriangle className="w-2.5 h-2.5" /> Hospital Suggestion Pending
                                    </span>
                                  )}
                                  {isMarkUrgent && (
                                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 text-[10px] font-bold">
                                      <AlertTriangle className="w-2.5 h-2.5" /> Mark Discharged
                                    </span>
                                  )}
                                  {isFillUrgent && (
                                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 text-[10px] font-bold">
                                      <AlertTriangle className="w-2.5 h-2.5" /> Fill Sheet
                                    </span>
                                  )}
                                  {isInitialFormUrgent && (
                                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 text-[10px] font-bold">
                                      <AlertTriangle className="w-2.5 h-2.5" /> Fill Initial Form
                                    </span>
                                  )}
                                </div>
                                {canViewPhoneNumber(user) && <div className="text-sm text-gray-600 dark:text-gray-400">{lead.phoneNumber}</div>}
                              </div>
                            </TableCell>
                            <TableCell className="text-gray-700 dark:text-gray-300">{lead.hospitalName}</TableCell>
                            <TableCell className="text-gray-700 dark:text-gray-300">{lead.treatment || <span className="text-gray-400">-</span>}</TableCell>
                            <TableCell>{getStageBadge(lead.caseStage)}</TableCell>
                            <TableCell>
                              {lead.admissionRecord?.ipdStatus ? (
                                <Badge variant="outline" className={getIpdMarkBadgeClass(lead.admissionRecord.ipdStatus)}>
                                  {getIpdMarkLabel(lead.admissionRecord.ipdStatus)}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground text-sm">–</span>
                              )}
                            </TableCell>
                            <TableCell className="text-gray-600 dark:text-gray-400">
                              {(() => {
                                const t = getLatestActivityTime(lead)
                                return t ? format(new Date(t), 'MMM dd, HH:mm') : '-'
                              })()}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                                {isSuggestionPending && (
                                  <Button
                                    variant="default"
                                    size="sm"
                                    onClick={(e) => { e.stopPropagation(); router.push(`/patient/${lead.id}/pre-auth`) }}
                                    className="bg-amber-600 hover:bg-amber-700 text-white shadow-md"
                                  >
                                    <ArrowRight className="w-4 h-4 mr-1" />
                                    Update Hospitals
                                  </Button>
                                )}
                                {lead.caseStage === CaseStage.PREAUTH_RAISED && (
                                  <Button
                                    variant="default"
                                    size="sm"
                                    onClick={(e) => { e.stopPropagation(); router.push(`/patient/${lead.id}/pre-auth`) }}
                                    className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white shadow-md"
                                  >
                                    <CheckCircle2 className="w-4 h-4 mr-1" />
                                    Complete Pre-Auth
                                  </Button>
                                )}
                                {lead.caseStage === CaseStage.PREAUTH_COMPLETE && !lead.insuranceInitiateForm && (
                                  <Button
                                    variant="default"
                                    size="sm"
                                    onClick={(e) => { e.stopPropagation(); router.push(`/patient/${lead.id}/pre-auth`) }}
                                    className="bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white shadow-md"
                                  >
                                    <FileText className="w-4 h-4 mr-1" />
                                    Fill Initial Form
                                  </Button>
                                )}
                                {isMarkUrgent && (
                                  <Button
                                    variant="default"
                                    size="sm"
                                    onClick={(e) => { e.stopPropagation(); router.push(`/patient/${lead.id}/discharge`) }}
                                    className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-md"
                                  >
                                    <CalendarCheck className="w-4 h-4 mr-1" />
                                    Mark Discharged
                                  </Button>
                                )}
                                {isFillUrgent && (
                                  <Button
                                    variant="default"
                                    size="sm"
                                    onClick={(e) => { e.stopPropagation(); router.push(`/patient/${lead.id}/discharge`) }}
                                    className="bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-600 hover:to-orange-600 text-white shadow-md"
                                  >
                                    <Receipt className="w-4 h-4 mr-1" />
                                    Fill Sheet
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </ProtectedRoute>
  )
}
