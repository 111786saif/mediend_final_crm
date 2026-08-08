'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/ui/data-table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PieChart, Pie, Cell, Tooltip } from 'recharts'
import { ArrowLeft, Users, Target, BarChart3, ChevronRight, TrendingUp, Clock, Filter, ArrowUpDown, ChevronDown, Loader2 } from 'lucide-react'
import type { DateRange } from 'react-day-picker'
import {
  type TeamDetail,
  type DashboardVariant,
  fmtK,
  UserAvatar,
  PIE_COLORS,
  HIDE_MISSING_INCENTIVE_CAPSULE
} from './sales-dashboard-view'

interface TeamDetailViewProps {
  teamId: string
  dateParams: string
  variant: DashboardVariant
  dateRange?: DateRange
  onBack: () => void
  onSelectNestedTeam?: (managerId: string) => void
}

export function TeamDetailView({
  teamId,
  dateParams,
  variant,
  dateRange,
  onBack,
  onSelectNestedTeam,
}: TeamDetailViewProps) {
  const [selectedBdId, setSelectedBdId] = useState<string>('all')
  const [selectedMonth, setSelectedMonth] = useState<string>('all')

  const { data, isLoading } = useQuery<TeamDetail>({
    queryKey: ['sales-dashboard', variant, 'team-detail-inline', teamId, dateParams],
    queryFn: () => apiGet<TeamDetail>(`/api/analytics/sales-dashboard/team-detail?managerId=${teamId}${dateParams ? '&' + dateParams : ''}`),
    enabled: !!teamId,
  })

  const { data: bdDetailData, isLoading: isBdLoading } = useQuery<any>({
    queryKey: ['sales-dashboard', variant, 'bd-detail-inline', selectedBdId, dateParams],
    queryFn: () => apiGet<any>(`/api/analytics/sales-dashboard/bd-detail?bdId=${selectedBdId}${dateParams ? '&' + dateParams : ''}`),
    enabled: !!selectedBdId && selectedBdId !== 'all',
  })

  const dateFrom = dateRange?.from || new Date()
  const incentiveMonth = dateFrom.getMonth() + 1
  const incentiveYear = dateFrom.getFullYear()

  const { data: incentivesData } = useQuery<{ records: any[] }>({
    queryKey: ['incentives-list', incentiveMonth, incentiveYear],
    queryFn: () => apiGet<{ records: any[] }>(`/api/incentives?month=${incentiveMonth}&year=${incentiveYear}`),
  })

  const incentivesByUserId = new Map<string, number>()
  const incentivesByName = new Map<string, number>()
  if (incentivesData?.records) {
    for (const rec of incentivesData.records) {
      if (rec.userId) incentivesByUserId.set(rec.userId, rec.amount)
      if (rec.employeeName) incentivesByName.set(rec.employeeName.toLowerCase().trim(), rec.amount)
    }
  }

  const isDetailLoading = isLoading || (selectedBdId !== 'all' && isBdLoading)

  if (isDetailLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
        <p className="text-muted-foreground animate-pulse font-medium">Loading...</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="text-center py-24 space-y-4">
        <p className="text-muted-foreground">No data found for this team in the selected period.</p>
        <Button variant="outline" onClick={onBack}>Go Back</Button>
      </div>
    )
  }

  const missingDataFallback = '–'

  const activeMember = data.members.find(m => m.id === selectedBdId)

  // Calculate dynamic KPIs based on selected BD
  const kpis = (selectedBdId !== 'all' && bdDetailData) ? {
    totalLeads: bdDetailData.kpis.totalLeads ?? 0,
    totalIpd: bdDetailData.kpis.ipdDone ?? bdDetailData.kpis.totalIpd ?? 0,
    conversionRate: bdDetailData.kpis.conversionRate ?? 0,
    totalBill: bdDetailData.kpis.billAmount ?? bdDetailData.kpis.totalBill ?? 0,
    totalProfit: bdDetailData.kpis.netProfit ?? 0,
  } : (activeMember ? {
    totalLeads: activeMember.leads ?? 0,
    totalIpd: activeMember.ipdDone ?? 0,
    conversionRate: activeMember.conversionRate ?? 0,
    totalBill: activeMember.billAmount ?? 0,
    totalProfit: 0,
  } : data.kpis)

  // Pipeline derivations
  const leadsToOpdMockRate = 0.65
  const mockOpdCount = Math.round((kpis.totalLeads || 0) * leadsToOpdMockRate)
  const leadsToOpdPercent = (kpis.totalLeads || 0) > 0 ? (mockOpdCount / (kpis.totalLeads || 0)) * 100 : 0
  const opdToIpdPercent = mockOpdCount > 0 ? ((kpis.totalIpd || 0) / mockOpdCount) * 100 : 0
  const overallConvPercent = kpis.conversionRate || 0

  const formatMonthName = (monthStr: string) => {
    if (!monthStr) return '–'
    const [year, month] = monthStr.split('-')
    if (!month) return monthStr
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const idx = parseInt(month, 10) - 1
    return idx >= 0 && idx < 12 ? `${monthNames[idx]} ${year.slice(2)}` : monthStr
  }

  // Month-wise derivations
  const months = data.monthWise.months
  const currentMonthIdx = months.length - 1
  const prevMonthIdx = months.length - 2
  const prev2MonthIdx = months.length - 3

  const getMemberIpdForMonth = (bdId: string, monthStr: string) => {
    if (!monthStr) return 0
    const row = data.monthWise.rows.find(r => r.bdId === bdId && r.month === monthStr)
    return row?.ipdCount || 0
  }

  const getMemberIpdForMonthRaw = (bdId: string, monthStr: string) => {
    if (!monthStr) return undefined
    const row = data.monthWise.rows.find(r => r.bdId === bdId && r.month === monthStr)
    return row ? (row.ipdCount ?? 0) : undefined
  }

  const getBdIpdForMonth = (monthStr: string) => {
    if (!bdDetailData || !monthStr) return 0
    const match = bdDetailData.monthWise.find((m: any) => m.month === monthStr)
    return match ? match.ipdCount : 0
  }

  const getMemberOlderMonthsIpd = (bdId: string) => {
    const activeMonths = [months[currentMonthIdx], months[prevMonthIdx], months[prev2MonthIdx]]
    return data.monthWise.rows
      .filter(r => r.bdId === bdId && !activeMonths.includes(r.month))
      .reduce((sum, r) => sum + (r.ipdCount || 0), 0)
  }

  const getMemberOlderMonthsIpdRaw = (bdId: string) => {
    const activeMonths = [months[currentMonthIdx], months[prevMonthIdx], months[prev2MonthIdx]]
    const rows = data.monthWise.rows.filter(r => r.bdId === bdId && !activeMonths.includes(r.month))
    if (rows.length === 0) return undefined
    return rows.reduce((sum, r) => sum + (r.ipdCount ?? 0), 0)
  }

  const getBdOlderMonthsIpd = () => {
    if (!bdDetailData) return 0
    const activeMonths = [months[currentMonthIdx], months[prevMonthIdx], months[prev2MonthIdx]]
    return bdDetailData.monthWise
      .filter((m: any) => !activeMonths.includes(m.month))
      .reduce((sum: number, m: any) => sum + (m.ipdCount || 0), 0)
  }

  // Calculate dynamic total IPD for each period based on selected BD
  const totalCurrent = selectedBdId === 'all'
    ? data.members.reduce((sum, m) => sum + getMemberIpdForMonth(m.id, months[currentMonthIdx]), 0)
    : getBdIpdForMonth(months[currentMonthIdx])

  const totalPrev = selectedBdId === 'all'
    ? data.members.reduce((sum, m) => sum + getMemberIpdForMonth(m.id, months[prevMonthIdx]), 0)
    : getBdIpdForMonth(months[prevMonthIdx])

  const totalPrev2 = selectedBdId === 'all'
    ? data.members.reduce((sum, m) => sum + getMemberIpdForMonth(m.id, months[prev2MonthIdx]), 0)
    : getBdIpdForMonth(months[prev2MonthIdx])

  const totalOlder = selectedBdId === 'all'
    ? data.members.reduce((sum, m) => sum + getMemberOlderMonthsIpd(m.id), 0)
    : getBdOlderMonthsIpd()

  const sumPast3 = totalCurrent + totalPrev + totalPrev2
  const ptCurrent = sumPast3 > 0 ? (totalCurrent / sumPast3) * 100 : 0
  const ptPrev = sumPast3 > 0 ? (totalPrev / sumPast3) * 100 : 0
  const ptPrev2 = sumPast3 > 0 ? (totalPrev2 / sumPast3) * 100 : 0

  const columns = useMemo<ColumnDef<TeamDetail['members'][number]>[]>(() => [
    {
      accessorKey: 'name',
      header: 'Member',
      cell: ({ row }) => {
        const m = row.original
        const amount = incentivesByUserId.get(m.id) ?? incentivesByName.get(m.name.toLowerCase().trim())
        return (
          <div className="flex items-center gap-3">
            <UserAvatar name={m.name} picture={m.profilePicture} />
            <div>
              <span className="font-semibold text-foreground">{m.name}</span>
              {amount !== undefined && !HIDE_MISSING_INCENTIVE_CAPSULE && (
                <span className="block text-[10px] font-medium text-amber-600 dark:text-amber-400 mt-0.5">
                  Inc: ₹{amount.toLocaleString()}
                </span>
              )}
            </div>
          </div>
        )
      }
    },
    {
      accessorKey: 'leads',
      header: 'Leads',
      meta: { headerClassName: 'text-right', cellClassName: 'text-right tabular-nums' },
      cell: ({ row }) => row.original.leads ?? missingDataFallback
    },
    {
      accessorKey: 'ipdDone',
      header: 'IPD',
      meta: { headerClassName: 'text-right', cellClassName: 'text-right tabular-nums font-semibold text-emerald-600 dark:text-emerald-400' },
      cell: ({ row }) => row.original.ipdDone ?? missingDataFallback
    },
    {
      accessorKey: 'conversionRate',
      header: 'Conv. Rate',
      meta: { headerClassName: 'text-right', cellClassName: 'text-right tabular-nums font-semibold text-violet-600 dark:text-violet-400' },
      cell: ({ row }) => `${row.original.conversionRate.toFixed(1)}%`
    },
    {
      id: 'currentMonth',
      header: formatMonthName(months[currentMonthIdx]),
      meta: { headerClassName: 'text-right', cellClassName: 'text-right tabular-nums' },
      cell: ({ row }) => getMemberIpdForMonthRaw(row.original.id, months[currentMonthIdx]) ?? missingDataFallback
    },
    {
      id: 'prevMonth',
      header: formatMonthName(months[prevMonthIdx]),
      meta: { headerClassName: 'text-right', cellClassName: 'text-right tabular-nums' },
      cell: ({ row }) => getMemberIpdForMonthRaw(row.original.id, months[prevMonthIdx]) ?? missingDataFallback
    },
    {
      id: 'prev2Month',
      header: formatMonthName(months[prev2MonthIdx]),
      meta: { headerClassName: 'text-right', cellClassName: 'text-right tabular-nums' },
      cell: ({ row }) => getMemberIpdForMonthRaw(row.original.id, months[prev2MonthIdx]) ?? missingDataFallback
    },
    {
      id: 'olderMonths',
      header: 'Older Months',
      meta: { headerClassName: 'text-right', cellClassName: 'text-right tabular-nums' },
      cell: ({ row }) => getMemberOlderMonthsIpdRaw(row.original.id) ?? missingDataFallback
    },
    {
      id: 'avgCallTime',
      header: 'Avg Call Time',
      meta: { headerClassName: 'text-right', cellClassName: 'text-right tabular-nums text-muted-foreground' },
      cell: () => missingDataFallback
    },
    {
      accessorKey: 'billAmount',
      header: 'Revenue',
      meta: { headerClassName: 'text-right', cellClassName: 'text-right tabular-nums font-medium text-amber-600 dark:text-amber-400' },
      cell: ({ row }) => row.original.billAmount ? fmtK(row.original.billAmount) : missingDataFallback
    }
  ], [data.members, months, incentivesByUserId, incentivesByName, currentMonthIdx, prevMonthIdx, prev2MonthIdx])

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* 1. Header Area */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-1.5 text-muted-foreground mb-2">
            <Button variant="ghost" size="icon" onClick={onBack} className="h-7 w-7 rounded-full">
              <ArrowLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="text-[10px] font-bold uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors" onClick={onBack}>Back to Team Cards</span>
          </div>
          <div className="flex items-center gap-4">
            <UserAvatar 
              name={activeMember ? activeMember.name : (data.team.manager?.name || 'Unknown')} 
              picture={activeMember ? activeMember.profilePicture : data.team.manager?.profilePicture} 
              size="md" 
            />
            <div>
              <h1 className="text-lg font-bold tracking-tight text-foreground">
                {activeMember ? `${activeMember.name} Performance` : `${data.team.name} Performance`}
              </h1>
              <div className="flex items-center gap-2 mt-0.5">
                {activeMember ? (
                  <p className="text-xs text-muted-foreground">BD Executive</p>
                ) : (
                  <>
                    {data.team.manager && (
                      <p className="text-xs text-muted-foreground">Manager: <span className="font-medium text-foreground">{data.team.manager.name}</span></p>
                    )}
                    {data.team.managerRole === 'CATEGORY_MANAGER' && <Badge variant="outline" className="text-xs text-teal-600 border-teal-600/30 py-0 h-5">Category Manager</Badge>}
                    {data.team.managerRole === 'ASSISTANT_CATEGORY_MANAGER' && <Badge variant="outline" className="text-xs text-blue-600 border-blue-600/30 py-0 h-5">ACM</Badge>}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Dropdowns on the right */}
        <div className="flex items-center gap-3">
          {/* Month Select */}
          <div className="flex flex-col">
            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Select Month</span>
            <div className="relative">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="appearance-none bg-[#151e3c] hover:bg-[#1f2847] border border-[#283150] hover:border-blue-500/40 rounded px-3 py-1.5 pr-8 text-xs font-bold uppercase tracking-wider text-[#dce1ff] transition-all cursor-pointer outline-none focus:ring-1 focus:ring-blue-500/50 min-w-[120px]"
              >
                <option value="all">All Months</option>
                {months.map((m) => (
                  <option key={m} value={m} className="bg-[#151e3c] text-foreground">{m}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#81859a] pointer-events-none transition-colors" />
            </div>
          </div>

          {/* BD Select */}
          <div className="flex flex-col">
            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Select BD</span>
            <div className="relative">
              <select
                value={selectedBdId}
                onChange={(e) => setSelectedBdId(e.target.value)}
                className="appearance-none bg-[#151e3c] hover:bg-[#1f2847] border border-[#283150] hover:border-blue-500/40 rounded px-3 py-1.5 pr-8 text-xs font-bold uppercase tracking-wider text-[#dce1ff] transition-all cursor-pointer outline-none focus:ring-1 focus:ring-blue-500/50 min-w-[160px]"
              >
                <option value="all">Whole Team</option>
                {data.members.map((m) => (
                  <option key={m.id} value={m.id} className="bg-[#151e3c] text-foreground">{m.name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#81859a] pointer-events-none transition-colors" />
            </div>
          </div>
        </div>
      </header>

      {/* 2. KPI Grid (6 Cards) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          {
            title: 'Total Leads',
            value: kpis.totalLeads ?? missingDataFallback,
            icon: <Users className="h-3.5 w-3.5" />,
            border: 'border-blue-500/10 hover:border-blue-500/50 hover:shadow-[0_0_15px_rgba(59,130,246,0.12)]',
            bg: 'bg-blue-500/[0.02]',
            iconBg: 'bg-blue-500/10 text-blue-500',
            valColor: 'text-foreground'
          },
          {
            title: 'IPD Done',
            value: kpis.totalIpd ?? missingDataFallback,
            icon: <Target className="h-3.5 w-3.5" />,
            border: 'border-emerald-500/10 hover:border-emerald-500/50 hover:shadow-[0_0_15px_rgba(16,185,129,0.12)]',
            bg: 'bg-emerald-500/[0.02]',
            iconBg: 'bg-emerald-500/10 text-emerald-500',
            valColor: 'text-emerald-600 dark:text-emerald-400'
          },
          {
            title: 'Conv. Rate',
            value: kpis.conversionRate ? `${kpis.conversionRate.toFixed(1)}%` : missingDataFallback,
            icon: <BarChart3 className="h-3.5 w-3.5" />,
            border: 'border-violet-500/10 hover:border-violet-500/50 hover:shadow-[0_0_15px_rgba(139,92,246,0.12)]',
            bg: 'bg-violet-500/[0.02]',
            iconBg: 'bg-violet-500/10 text-violet-500',
            valColor: 'text-violet-600 dark:text-violet-400'
          },
          {
            title: 'Net Profit',
            value: kpis.totalProfit ? fmtK(kpis.totalProfit) : missingDataFallback,
            icon: <TrendingUp className="h-3.5 w-3.5" />,
            border: 'border-amber-500/10 hover:border-amber-500/50 hover:shadow-[0_0_15px_rgba(245,158,11,0.12)]',
            bg: 'bg-amber-500/[0.02]',
            iconBg: 'bg-amber-500/10 text-amber-500',
            valColor: 'text-foreground'
          },
          {
            title: 'Bill Amount',
            value: kpis.totalBill ? fmtK(kpis.totalBill) : missingDataFallback,
            icon: <span className="text-xs font-bold leading-none">$</span>,
            border: 'border-sky-500/10 hover:border-sky-500/50 hover:shadow-[0_0_15px_rgba(14,165,233,0.12)]',
            bg: 'bg-sky-500/[0.02]',
            iconBg: 'bg-sky-500/10 text-sky-500 px-2.5',
            valColor: 'text-foreground'
          },
          {
            title: 'Avg Call Time',
            value: missingDataFallback,
            icon: <Clock className="h-3.5 w-3.5" />,
            border: 'border-slate-500/10 hover:border-slate-500/50 hover:shadow-[0_0_15px_rgba(100,116,139,0.12)]',
            bg: 'bg-slate-500/[0.02]',
            iconBg: 'bg-slate-500/10 text-slate-500',
            valColor: 'text-foreground'
          }
        ].map((card, idx) => (
          <Card key={idx} className={`bg-card shadow-sm transition-all duration-300 group ${card.border}`}>
            <CardContent className={`pt-2.5 pb-1 px-3.5 flex flex-col justify-between h-20 relative ${card.bg}`}>
              <div className="flex justify-between items-start">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{card.title}</p>
                <div className={`p-1 rounded transition-colors flex items-center justify-center ${card.iconBg}`}>
                  {card.icon}
                </div>
              </div>
              <div className="flex items-end justify-between mt-auto mb-0.5">
                <p className={`text-2xl font-extrabold tracking-tight ${card.valColor}`}>{card.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 3. Analytics Overview (4 Columns) */}
      <div className={`grid grid-cols-1 md:grid-cols-2 ${selectedBdId === 'all' ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-4`}>
        
        {/* Col 1: Lead Aging Dist */}
        <Card className="shadow-sm border-border flex flex-col bg-card/60 backdrop-blur-sm">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-base font-bold text-foreground tracking-tight">Lead Aging Distribution</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 p-4 pt-0 flex flex-col items-center justify-between gap-4">
            <div className="w-32 h-32 rounded-full border-[14px] border-muted relative flex items-center justify-center shadow-inner mt-2 shrink-0">
              <div className="text-center">
                <span className="block text-2xl font-extrabold text-foreground tracking-tight leading-none">{sumPast3}</span>
                <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5 block">IPD (3M)</span>
              </div>
            </div>
            <div className="space-y-1.5 w-full bg-muted/35 p-2.5 rounded-xl border border-border/50">
              {[
                { monthIdx: currentMonthIdx, color: 'bg-violet-500', pt: ptCurrent, tot: totalCurrent },
                { monthIdx: prevMonthIdx, color: 'bg-blue-500', pt: ptPrev, tot: totalPrev },
                { monthIdx: prev2MonthIdx, color: 'bg-teal-500', pt: ptPrev2, tot: totalPrev2 },
              ].map((p, i) => (
                <div key={i} className="flex justify-between items-center text-[10px]">
                  <div className="flex items-center gap-1.5">
                    <div className={`w-2.5 h-2.5 rounded ${p.color}`}></div>
                    <span className="text-muted-foreground font-semibold uppercase tracking-wider">{formatMonthName(months[p.monthIdx])}</span>
                  </div>
                  <span className="text-foreground font-bold">{p.pt.toFixed(0)}% <span className="text-muted-foreground font-medium ml-1">({p.tot})</span></span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Col 2: Pipeline Ratios */}
        <Card className="shadow-sm border-border flex flex-col bg-card/60 backdrop-blur-sm">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-base font-bold text-foreground tracking-tight">Pipeline Ratios</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 p-4 pt-0 flex flex-col gap-3 justify-center">
            {/* Leads to OPD */}
            <div className="flex flex-col gap-1.5 p-2.5 bg-blue-500/5 hover:bg-blue-500/10 rounded-xl border border-blue-500/10 hover:border-blue-500/20 transition-all group">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Leads to OPD</span>
                <span className="text-xs font-extrabold text-blue-600 dark:text-blue-400">{leadsToOpdPercent.toFixed(0)}%</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-blue-500/10 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${leadsToOpdPercent}%` }}></div>
                </div>
                <span className="text-[9px] font-semibold text-muted-foreground whitespace-nowrap">{mockOpdCount}/{kpis.totalLeads}</span>
              </div>
            </div>
            
            {/* OPD to IPD */}
            <div className="flex flex-col gap-1.5 p-2.5 bg-emerald-500/5 hover:bg-emerald-500/10 rounded-xl border border-emerald-500/10 hover:border-emerald-500/20 transition-all group">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">OPD to IPD</span>
                <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400">{opdToIpdPercent.toFixed(0)}%</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-emerald-500/10 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${opdToIpdPercent}%` }}></div>
                </div>
                <span className="text-[9px] font-semibold text-muted-foreground whitespace-nowrap">{kpis.totalIpd}/{mockOpdCount}</span>
              </div>
            </div>

            {/* Leads to IPD */}
            <div className="flex flex-col gap-1.5 p-2.5 bg-violet-500/5 hover:bg-violet-500/10 rounded-xl border border-violet-500/10 hover:border-violet-500/20 transition-all group">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-violet-600 dark:text-violet-400 uppercase tracking-wider">Leads to IPD</span>
                <span className="text-xs font-extrabold text-violet-600 dark:text-violet-400">{overallConvPercent.toFixed(0)}%</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-violet-500/10 rounded-full overflow-hidden">
                  <div className="h-full bg-violet-500 rounded-full transition-all duration-500" style={{ width: `${overallConvPercent}%` }}></div>
                </div>
                <span className="text-[9px] font-semibold text-muted-foreground whitespace-nowrap">{kpis.totalIpd}/{kpis.totalLeads}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Col 3: Specialty Conversion */}
        <Card className="shadow-sm border-border flex flex-col bg-card/60 backdrop-blur-sm">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-base font-bold text-foreground tracking-tight">Specialty Conversion</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 p-4 pt-0 flex flex-col gap-3 justify-center">
            {data.byCategory && data.byCategory.length > 0 ? (
              data.byCategory.slice(0, 3).map((c, i) => {
                const color = PIE_COLORS[i % PIE_COLORS.length];
                return (
                  <div key={c.category} className="flex flex-col gap-1.5 p-2.5 bg-muted/30 hover:bg-muted/50 rounded-xl border border-border/50 hover:border-border transition-all">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold text-foreground uppercase tracking-wider truncate max-w-[120px]">{c.category}</span>
                      <span className="text-xs font-extrabold" style={{ color }}>{c.conversionRate.toFixed(0)}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${c.conversionRate}%`, backgroundColor: color }}></div>
                      </div>
                      <span className="text-[9px] font-semibold text-muted-foreground whitespace-nowrap">{c.leads} Leads</span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-4 text-muted-foreground text-xs">No specialty data</div>
            )}
          </CardContent>
        </Card>

        {/* Col 4: Monthly IPD by BD */}
        {selectedBdId === 'all' && (
          <Card className="shadow-sm border-border flex flex-col bg-card/60 backdrop-blur-sm">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-base font-bold text-foreground tracking-tight">IPD by BD</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 p-4 pt-0 flex flex-col items-center justify-between gap-4">
              {data.members.some(m => m.ipdDone > 0) ? (
                <>
                  <div className="relative w-32 h-32 mt-2 shrink-0 flex items-center justify-center">
                    <PieChart width={128} height={128}>
                      <Pie data={data.members.filter(m => m.ipdDone > 0)} dataKey="ipdDone" nameKey="name" cx="50%" cy="50%" outerRadius={60} innerRadius={42}>
                        {data.members.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-xl font-extrabold tracking-tight text-foreground leading-none">{data.kpis.totalIpd}</span>
                      <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5 block">IPD</span>
                    </div>
                  </div>
                  <div className="space-y-1.5 w-full bg-muted/30 p-2.5 rounded-xl border border-border/50">
                    {data.members.filter(m => m.ipdDone > 0).slice(0, 3).map((m, i) => (
                      <div key={m.id} className="flex justify-between items-center text-[10px]">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 rounded" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}></div>
                          <span className="font-semibold text-muted-foreground truncate max-w-[80px]">{m.name}</span>
                        </div>
                        <span className="font-bold text-foreground">{m.ipdDone}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center w-full py-4 text-muted-foreground text-xs">No IPD data</div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* 5. Sub-Teams (If any) */}
      {data.nestedTeams && data.nestedTeams.length > 0 && selectedBdId === 'all' && (
        <Card className="shadow-sm border-border">
          <CardHeader className="pb-3 border-b border-border/50 bg-muted/20">
            <CardTitle className="text-sm flex items-center gap-2"><Users className="h-4 w-4 text-blue-500" /> Sub-Teams under {data.team.name}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {data.nestedTeams.map((nt) => {
                const conv = nt.totalLeads > 0 ? ((nt.totalIpd / nt.totalLeads) * 100).toFixed(1) : '0.0'
                return (
                  <button
                    key={nt.id}
                    type="button"
                    onClick={() => onSelectNestedTeam?.(nt.id)}
                    className="w-full text-left p-4 hover:bg-muted/40 transition-colors flex items-center justify-between group"
                  >
                    <div>
                      <p className="font-semibold text-sm group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{nt.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {nt.role === 'ASSISTANT_CATEGORY_MANAGER' ? 'ACM' : nt.role === 'CATEGORY_MANAGER' ? 'CM' : 'Team Lead'}
                      </p>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{nt.totalIpd} IPD</p>
                        <p className="text-xs text-muted-foreground">{nt.totalLeads} Leads ({conv}%)</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 6. Comprehensive Member Contribution Table */}
      {selectedBdId === 'all' && (
        <Card className="shadow-sm border-border w-full overflow-hidden">
          <div className="p-4 border-b border-border/50 bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h3 className="text-base font-semibold text-foreground">Team Member Contribution</h3>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="h-8 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Filter className="h-3.5 w-3.5 mr-1" /> Filter
              </Button>
              <Button variant="outline" size="sm" className="h-8 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <ArrowUpDown className="h-3.5 w-3.5 mr-1" /> Sort
              </Button>
            </div>
          </div>
          <DataTable
            columns={columns}
            data={data.members}
            enablePagination={false}
            emptyMessage="No members found"
          />
        </Card>
      )}

    </div>
  )
}
