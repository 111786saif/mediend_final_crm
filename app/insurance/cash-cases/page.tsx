'use client'

import { ProtectedRoute } from '@/components/protected-route'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost } from '@/lib/api-client'
import { format, startOfDay, startOfMonth } from 'date-fns'
import { useRouter } from 'next/navigation'
import { CaseStage, FlowType } from '@/generated/prisma/enums'
import { useState, useMemo, useEffect } from 'react'
import {
  FileText, AlertCircle, CheckCircle2, Clock, ArrowRight,
  Receipt, Shield, Activity, Search, LayoutList, CalendarDays, BarChart3,
  AlertTriangle, Wallet, X, XCircle, CalendarCheck,
} from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { canViewPhoneNumber } from '@/lib/case-permissions'
import { getLatestActivityTime } from '@/lib/lead-activity'
import { getPhoneDisplay } from '@/lib/phone-utils'
import { getCaseStageBadgeConfig } from '@/lib/case-stage-labels'
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
  atsAmount?: number | null
  atsStatus?: string | null
  settledTotal?: number | null
  caseStage: CaseStage
  flowType: FlowType
  surgeryDate?: string | null
  bdId?: string | null
  bd?: { id: string; name: string } | null
  createdDate: string
  updatedDate: string
  dischargeSheet?: { id: string; isFinalized?: boolean; dischargeDate?: string | null; markedAt?: string | null; updatedAt?: string } | null
  kypSubmission?: {
    updatedAt?: string
    preAuthData?: {
      updatedAt?: string
      queries?: { updatedAt?: string }[]
    } | null
  } | null
  insuranceInitiateForm?: { id: string; updatedAt?: string } | null
  admissionRecord?: {
    id: string
    admissionDate: string
    admittingHospital: string
    ipdStatus?: string | null
    ipdStatusUpdatedAt?: string | null
    initiatedAt?: string
    surgeryDate?: string | null
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

const IPD_MARK_OPTIONS = [
  { value: '', label: 'All marks' },
  { value: 'ADMITTED_DONE', label: 'Admitted' },
  { value: 'IPD_DONE', label: 'Surgery Done' },
  { value: 'POSTPONED', label: 'Postponed' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'NONE', label: 'Not set' },
] as const
type IpdMarkFilterValue = '' | 'ADMITTED_DONE' | 'IPD_DONE' | 'POSTPONED' | 'CANCELLED' | 'NONE'

const FILTER_STORAGE_KEY = 'cash-cases-filters-v1'
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const ANY_VALUE = '__any__'

function needsDischargeFill(lead: LeadWithStage): boolean {
  return (
    (lead.caseStage === CaseStage.CASH_APPROVED || lead.caseStage === CaseStage.CASH_IPD_DONE) &&
    !lead.dischargeSheet
  )
}

function needsReview(lead: LeadWithStage): boolean {
  return lead.caseStage === CaseStage.CASH_IPD_SUBMITTED || lead.caseStage === CaseStage.CASH_ON_HOLD
}

function getPriorityTier(lead: LeadWithStage): 0 | 1 | 2 {
  if (needsDischargeFill(lead)) return 2
  if (needsReview(lead)) return 1
  return 0
}

function getIpdMarkBadgeClass(status: string | null | undefined): string {
  switch (status) {
    case 'ADMITTED_DONE': return 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 border-green-200 dark:border-green-800'
    case 'IPD_DONE': return 'bg-teal-100 dark:bg-teal-900 text-teal-800 dark:text-teal-200 border-teal-200 dark:border-teal-800'
    case 'POSTPONED': return 'bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-800'
    case 'CANCELLED': return 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 border-red-200 dark:border-red-800'
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
    default: return status.replace(/_/g, ' ')
  }
}

export default function InsuranceCashCasesPage() {
  const { user } = useAuth()
  const router = useRouter()
  const queryClient = useQueryClient()
  const now = new Date()

  const [activeTab, setActiveTab] = useState<TabKey>('pending-review')
  const [searchQuery, setSearchQuery] = useState('')
  const [ipdMarkFilter, setIpdMarkFilter] = useState<IpdMarkFilterValue>('')

  // Review Modal State
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)
  const [reviewAction, setReviewAction] = useState<'APPROVE' | 'HOLD' | null>(null)
  const [reviewReason, setReviewReason] = useState('')
  const [submittingReview, setSubmittingReview] = useState(false)

  // Filter bar (persisted)
  const [activityMonth, setActivityMonth] = useState<number>(now.getMonth() + 1)
  const [activityYear, setActivityYear] = useState<number>(now.getFullYear())
  const [bdFilter, setBdFilter] = useState<string>('')
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

  // Build server query
  const leadsQueryString = useMemo(() => {
    const params = new URLSearchParams()
    if (bdFilter) params.set('bdId', bdFilter)
    return params.toString()
  }, [bdFilter])

  const { data: leads, isLoading, error } = useQuery<LeadWithStage[]>({
    queryKey: ['leads', 'insurance', 'cash', leadsQueryString],
    queryFn: async () => {
      try {
        const data = await apiGet<LeadWithStage[]>(`/api/leads?${leadsQueryString}`)
        return (data || []).filter(l => l.flowType === FlowType.CASH)
      } catch (err) {
        console.error('Error fetching leads:', err)
        return []
      }
    },
    enabled: hydrated,
  })

  // Universe for dropdown options
  const { data: universeLeads } = useQuery<Pick<LeadWithStage, 'bdId' | 'bd' | 'circle' | 'treatment'>[]>({
    queryKey: ['leads', 'insurance', 'cash', 'universe'],
    queryFn: async () => {
      try {
        const data = await apiGet<LeadWithStage[]>('/api/leads')
        return (data || []).filter(l => l.flowType === FlowType.CASH).map(l => ({ bdId: l.bdId, bd: l.bd, circle: l.circle, treatment: l.treatment }))
      } catch { return [] }
    },
    enabled: hydrated,
    staleTime: 5 * 60 * 1000,
  })

  const bdOptions = useMemo(() => {
    const map = new Map<string, string>()
      ; (universeLeads || []).forEach(l => {
        if (l.bdId && l.bd?.name) map.set(l.bdId, l.bd.name)
      })
    return Array.from(map.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
  }, [universeLeads])

  const circleOptions = useMemo(() => {
    const set = new Set<string>()
      ; (universeLeads || []).forEach(l => { if (l.circle) set.add(l.circle) })
    return Array.from(set).sort()
  }, [universeLeads])

  const treatmentOptions = useMemo(() => {
    const set = new Set<string>()
      ; (universeLeads || []).forEach(l => { if (l.treatment) set.add(l.treatment) })
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

  // Apply client-side circle + treatment + surgery-month filters
  const scopedLeads = useMemo(() => {
    if (!leads) return []
    const monthStart = new Date(activityYear, activityMonth - 1, 1)
    const monthEnd = new Date(activityYear, activityMonth, 1)
    return leads.filter(l => {
      if (circleFilter && l.circle !== circleFilter) return false
      if (treatmentFilter && l.treatment !== treatmentFilter) return false

      // Filter by surgery date falling in the selected month
      const surgeryDate = l.admissionRecord?.surgeryDate
        ? new Date(l.admissionRecord.surgeryDate).getTime()
        : null
      if (surgeryDate == null) return false
      return surgeryDate >= monthStart.getTime() && surgeryDate < monthEnd.getTime()
    })
  }, [leads, circleFilter, treatmentFilter, activityMonth, activityYear])

  // Stats
  const stats = useMemo(() => {
    if (!scopedLeads) return { pendingReview: 0, onHold: 0, approved: 0, dischargeDone: 0, allCash: 0 }
    return {
      pendingReview: scopedLeads.filter(l => l.caseStage === CaseStage.CASH_IPD_SUBMITTED).length,
      onHold: scopedLeads.filter(l => l.caseStage === CaseStage.CASH_ON_HOLD).length,
      approved: scopedLeads.filter(l => l.caseStage === CaseStage.CASH_APPROVED || l.caseStage === CaseStage.CASH_IPD_DONE).length,
      dischargeDone: scopedLeads.filter(l => l.caseStage === CaseStage.CASH_DISCHARGED).length,
      allCash: scopedLeads.length,
    }
  }, [scopedLeads])

  // Sheets filled chart data
  const sheetChartData = useMemo(() => {
    if (!scopedLeads.length) return { daily: [], monthly: [] }
    const filledLeads = scopedLeads.filter(l => l.dischargeSheet?.isFinalized === true)

    const dayMap = new Map<string, number>()
    for (let i = 13; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      dayMap.set(format(startOfDay(d), 'MMM d'), 0)
    }
    filledLeads.forEach(l => {
      const date = l.dischargeSheet?.updatedAt
      if (!date) return
      const key = format(startOfDay(new Date(date)), 'MMM d')
      if (dayMap.has(key)) dayMap.set(key, (dayMap.get(key) || 0) + 1)
    })
    const daily = Array.from(dayMap.entries()).map(([day, count]) => ({ day, count }))

    const monthMap = new Map<string, number>()
    for (let i = 5; i >= 0; i--) {
      const d = new Date()
      d.setMonth(d.getMonth() - i)
      monthMap.set(format(startOfMonth(d), 'MMM yy'), 0)
    }
    filledLeads.forEach(l => {
      const date = l.dischargeSheet?.updatedAt
      if (!date) return
      const key = format(startOfMonth(new Date(date)), 'MMM yy')
      if (monthMap.has(key)) monthMap.set(key, (monthMap.get(key) || 0) + 1)
    })
    const monthly = Array.from(monthMap.entries()).map(([month, count]) => ({ month, count }))

    return { daily, monthly }
  }, [scopedLeads])

  // Filtered leads per tab
  const filteredLeads = useMemo(() => {
    if (!scopedLeads.length) return []

    let result = scopedLeads.filter(lead => {
      switch (activeTab) {
        case 'pending-review':
          return lead.caseStage === CaseStage.CASH_IPD_SUBMITTED
        case 'on-hold':
          return lead.caseStage === CaseStage.CASH_ON_HOLD
        case 'approved':
          return lead.caseStage === CaseStage.CASH_APPROVED || lead.caseStage === CaseStage.CASH_IPD_DONE
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

    if (ipdMarkFilter === 'NONE') {
      result = result.filter(l => !l.admissionRecord?.ipdStatus)
    } else if (ipdMarkFilter) {
      result = result.filter(l => l.admissionRecord?.ipdStatus === ipdMarkFilter)
    }

    // Priority sort: urgent actions first, then by latest activity
    return result.sort((a, b) => {
      const tierA = getPriorityTier(a)
      const tierB = getPriorityTier(b)
      if (tierA !== tierB) return tierB - tierA
      return getLatestActivityTime(b) - getLatestActivityTime(a)
    })
  }, [scopedLeads, activeTab, searchQuery, ipdMarkFilter])

  // Review Handler
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
      queryClient.invalidateQueries({ queryKey: ['leads', 'insurance', 'cash', leadsQueryString] })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to submit review')
    } finally {
      setSubmittingReview(false)
    }
  }

  // Components
  const getStageBadge = (stage: CaseStage) => {
    const { className, label } = getCaseStageBadgeConfig(stage)
    return <Badge variant="secondary" className={className}>{label}</Badge>
  }

  const tabs: { id: TabKey; label: string; icon: React.FC<{ className?: string }>; value: number; gradient: string; bgGradient: string; iconColor: string; borderColor: string }[] = [
    { id: 'pending-review', label: 'Pending Review', icon: Clock, value: stats.pendingReview, gradient: 'from-blue-500 to-cyan-500', bgGradient: 'from-blue-50 to-cyan-50 dark:from-blue-950 dark:to-cyan-950', iconColor: 'text-blue-600 dark:text-blue-400', borderColor: 'border-blue-200 dark:border-blue-800' },
    { id: 'on-hold', label: 'On Hold', icon: AlertCircle, value: stats.onHold, gradient: 'from-amber-500 to-orange-500', bgGradient: 'from-amber-50 to-orange-50 dark:from-amber-950 dark:to-orange-950', iconColor: 'text-amber-600 dark:text-amber-400', borderColor: 'border-amber-200 dark:border-amber-800' },
    { id: 'approved', label: 'Approved', icon: CheckCircle2, value: stats.approved, gradient: 'from-green-500 to-emerald-500', bgGradient: 'from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950', iconColor: 'text-green-600 dark:text-green-400', borderColor: 'border-green-200 dark:border-green-800' },
    { id: 'discharge-done', label: 'Discharge Done', icon: Shield, value: stats.dischargeDone, gradient: 'from-purple-500 to-indigo-500', bgGradient: 'from-purple-50 to-indigo-50 dark:from-purple-950 dark:to-indigo-950', iconColor: 'text-purple-600 dark:text-purple-400', borderColor: 'border-purple-200 dark:border-purple-800' },
    { id: 'all-cash', label: 'All Cash Cases', icon: LayoutList, value: stats.allCash, gradient: 'from-slate-500 to-gray-500', bgGradient: 'from-slate-50 to-gray-50 dark:from-slate-950 dark:to-gray-950', iconColor: 'text-slate-600 dark:text-slate-400', borderColor: 'border-slate-200 dark:border-slate-800' },
  ]

  const tabLabels: Record<TabKey, string> = {
    'pending-review': 'Pending Review — Cash IPD Submitted',
    'on-hold': 'On Hold — Requires Action',
    'approved': 'Approved — Ready for Discharge',
    'discharge-done': 'Discharge Done — Completed Cash Cases',
    'all-cash': 'All Cash Cases',
  }

  const chartConfig = {
    count: { label: 'Sheets Filled', color: 'rgb(var(--chart-1))' },
  }

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

          {/* ── Charts Row ─────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Day-wise chart */}
            <Card className="border-2">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-blue-500" />
                  <CardTitle className="text-sm font-semibold text-gray-700 dark:text-gray-300">Cash Sheets Filled – Last 14 Days</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-2">
                <ChartContainer config={chartConfig} className="h-[110px] w-full">
                  <BarChart data={sheetChartData.daily} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="day" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} interval={2} />
                    <YAxis tick={{ fontSize: 9 }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>

            {/* Month-wise chart */}
            <Card className="border-2">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-purple-500" />
                  <CardTitle className="text-sm font-semibold text-gray-700 dark:text-gray-300">Cash Sheets Filled – Last 6 Months</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-2">
                <ChartContainer config={{ count: { label: 'Cash Sheets Filled', color: 'rgb(var(--chart-2))' } }} className="h-[110px] w-full">
                  <BarChart data={sheetChartData.monthly} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>

          {/* ── Filter Bar ─────────────────────────────────────────────── */}
          <Card className="border-2 bg-white dark:bg-gray-950">
            <CardContent className="py-3 px-4">
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold uppercase text-gray-500">
                    Active in
                  </label>
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
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {tabs.map((card) => {
              const Icon = card.icon
              const isActive = activeTab === card.id
              return (
                <Card
                  key={card.id}
                  className={`cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-xl border-2 ${isActive ? card.borderColor + ' shadow-lg ring-2 ring-offset-2' : 'border-transparent'
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
                  </CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
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
                      className="pl-8 bg-white dark:bg-gray-950 border-gray-200 dark:border-gray-800 focus:ring-green-500"
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
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600" />
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
                        <TableHead className="font-bold text-gray-700 dark:text-gray-300">BD</TableHead>
                        <TableHead className="font-bold text-gray-700 dark:text-gray-300">Circle</TableHead>
                        <TableHead className="font-bold text-gray-700 dark:text-gray-300">Treatment</TableHead>
                        <TableHead className="font-bold text-gray-700 dark:text-gray-300">IPD Mark</TableHead>
                        <TableHead className="font-bold text-gray-700 dark:text-gray-300">ATS Status</TableHead>
                        <TableHead className="font-bold text-gray-700 dark:text-gray-300">Stage</TableHead>
                        <TableHead className="font-bold text-gray-700 dark:text-gray-300">Last Modified</TableHead>
                        <TableHead className="font-bold text-gray-700 dark:text-gray-300">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredLeads.map((lead, index) => {
                        const tier = getPriorityTier(lead)
                        const isDischargeUrgent = tier === 2
                        const isReviewUrgent = tier === 1

                        const rowBg = isDischargeUrgent
                          ? 'bg-orange-50/60 dark:bg-orange-950/20'
                          : isReviewUrgent
                            ? 'bg-amber-50/60 dark:bg-amber-950/20'
                            : index % 2 === 0
                              ? 'bg-white dark:bg-gray-950'
                              : 'bg-gray-50/50 dark:bg-gray-900/50'

                        const borderLeft = isDischargeUrgent
                          ? 'border-l-4 border-l-orange-500'
                          : isReviewUrgent
                            ? 'border-l-4 border-l-amber-500'
                            : 'border-l-4 border-l-transparent'

                        return (
                          <TableRow
                            key={lead.id}
                            className={`transition-colors cursor-pointer hover:brightness-95 ${rowBg} ${borderLeft}`}
                            onClick={() => router.push(`/patient/${lead.id}`)}
                          >
                            <TableCell className="font-semibold text-gray-900 dark:text-gray-100">
                              <span className="px-2 py-1 rounded bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 text-sm font-mono">
                                {lead.leadRef}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div>
                                <div className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-1">
                                  {lead.patientName}
                                  {isDischargeUrgent && (
                                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 text-[10px] font-bold">
                                      <AlertTriangle className="w-2.5 h-2.5" /> Fill Discharge
                                    </span>
                                  )}
                                  {isReviewUrgent && (
                                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-[10px] font-bold">
                                      <AlertTriangle className="w-2.5 h-2.5" /> Needs Review
                                    </span>
                                  )}
                                </div>
                                {canViewPhoneNumber(user) && <div className="text-sm text-gray-600 dark:text-gray-400">{getPhoneDisplay(lead.phoneNumber, canViewPhoneNumber(user))}</div>}
                              </div>
                            </TableCell>
                            <TableCell className="text-gray-700 dark:text-gray-300">{lead.hospitalName || <span className="text-gray-400">-</span>}</TableCell>
                            <TableCell className="text-gray-700 dark:text-gray-300">{lead.bd?.name || <span className="text-gray-400">-</span>}</TableCell>
                            <TableCell className="text-gray-700 dark:text-gray-300">{lead.circle || <span className="text-gray-400">-</span>}</TableCell>
                            <TableCell className="text-gray-700 dark:text-gray-300">{lead.treatment || <span className="text-gray-400">-</span>}</TableCell>
                            <TableCell>
                              {lead.admissionRecord?.ipdStatus ? (
                                <Badge variant="outline" className={getIpdMarkBadgeClass(lead.admissionRecord.ipdStatus)}>
                                  {getIpdMarkLabel(lead.admissionRecord.ipdStatus)}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground text-sm">–</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1">
                                {lead.atsStatus === 'ABOVE_ATS' ? (
                                  <Badge className="bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800 text-xs">
                                    <CheckCircle2 className="w-3 h-3 mr-1" />
                                    Auto-Approved
                                  </Badge>
                                ) : lead.atsStatus === 'BELOW_ATS' ? (
                                  <Badge className="bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800 text-xs">
                                    <AlertTriangle className="w-3 h-3 mr-1" />
                                    Needs Approval
                                  </Badge>
                                ) : (
                                  <span className="text-gray-400 text-sm">-</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>{getStageBadge(lead.caseStage)}</TableCell>
                            <TableCell className="text-gray-600 dark:text-gray-400">
                              {(() => {
                                const t = getLatestActivityTime(lead)
                                return t ? format(new Date(t), 'MMM dd, HH:mm') : '-'
                              })()}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                                {isReviewUrgent && (
                                  <Button
                                    variant="default"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setSelectedLeadId(lead.id)
                                      setReviewAction(null)
                                      setReviewReason('')
                                      setShowReviewModal(true)
                                    }}
                                    className="bg-blue-600 hover:bg-blue-700 text-white"
                                  >
                                    <FileText className="w-4 h-4 mr-1" />
                                    Review
                                  </Button>
                                )}
                                {isDischargeUrgent && (
                                  <Button
                                    variant="default"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      router.push(`/patient/${lead.id}/discharge-cash`)
                                    }}
                                    className="bg-teal-600 hover:bg-teal-700 text-white"
                                  >
                                    <CalendarCheck className="w-4 h-4 mr-1" />
                                    Fill Discharge
                                  </Button>
                                )}
                                {lead.dischargeSheet?.isFinalized === true && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      router.push(`/patient/${lead.id}/discharge-cash`)
                                    }}
                                    className="border-teal-300 dark:border-teal-800 text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-950"
                                  >
                                    <Receipt className="w-4 h-4 mr-1" />
                                    View Sheet
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
