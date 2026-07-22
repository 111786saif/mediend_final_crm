'use client'

import React, { useState, useMemo } from 'react'
import {
  createColumnHelper,
  ColumnFiltersState,
} from '@tanstack/react-table'
import { Calendar, Download, Settings2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ColumnFilter } from '@/components/ui/column-filter'
import { DataTable } from '@/components/ui/data-table'
import { usePermissions } from '@/hooks/use-permissions'
import { cn } from '@/lib/utils'

// Helper function to generate month options
function generateMonthOptions() {
  const months = []
  const d = new Date()
  let y = d.getFullYear()
  let m = d.getMonth()
  for (let i = 0; i < 24; i++) {
    const key = `${y}-${String(m + 1).padStart(2, '0')}`
    const dateObj = new Date(y, m, 1)
    const label = dateObj.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    months.push({ key, label })
    m--
    if (m < 0) {
      m = 11
      y--
    }
  }
  return months
}

const MONTH_OPTIONS = generateMonthOptions()

function currentMonthKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// Define the data shape
export interface BluePrintRecord {
  id: string
  name: string
  team: string
  teamSize: number
  targetSalaryMin: number
  target: number
  month: string
  
  expectedMtdIpd: {
    achievement: number
    percentage: number
  }
  
  actualMtd: {
    ipdAverageJan25: number
    startDate: string
    opdDone: number
    endDate: string
    costPerIpdSalary: number
    costPerIpdSalarySeat: number
    salary: number
    seatCost: number
  }
  
  cost: {
    incentive: number
    marketingCost: number
    totalSpend: number
  }
  
  netProfit: {
    actual: number
    achievement: number
  }
  
  targetGroup: {
    revenueTarget: number
    ats: number
  }
  
  ipdDone: {
    jan25: number
  }
  
  revenueAndBill: {
    settledRevenue: number
    revenueAchievements: number
    ats1: number
    billRevenue: number
    achievement: number
    ats2: number
  }
  
  deductions: {
    netTotal: number
  }
  
  mediend: {
    share: number
    profit: number
  }
  
  previousMonths: {
    mar25: number
    jun25: number
    nov24: number
  }
  
  requiredRate: {
    surgeryShortMtd: number
    weeklySurgeriesRequiredCurrent: number
    weeklySurgeriesRequiredNext: number
  }
  
  expected: {
    mtd: number
  }
}

// Dynamic Month keys relative to runtime date
const d = new Date()
const curMonth = currentMonthKey()
const prevMonthDate = new Date(d.getFullYear(), d.getMonth() - 1, 1)
const prevMonth = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`

// Mock Data
const mockData: BluePrintRecord[] = [
  {
    id: '1',
    name: 'Ashwani',
    team: 'Team A',
    teamSize: 5,
    targetSalaryMin: 50000,
    target: 80000,
    month: curMonth,
    expectedMtdIpd: { achievement: 8, percentage: 100 },
    actualMtd: {
      ipdAverageJan25: 6.5,
      startDate: '01/07/2026',
      opdDone: 15,
      endDate: '31/07/2026',
      costPerIpdSalary: 6250,
      costPerIpdSalarySeat: 8500,
      salary: 50000,
      seatCost: 18000,
    },
    cost: { incentive: 5000, marketingCost: 2000, totalSpend: 75000 },
    netProfit: { actual: 120000, achievement: 150 },
    targetGroup: { revenueTarget: 200000, ats: 25000 },
    ipdDone: { jan25: 7 },
    revenueAndBill: {
      settledRevenue: 150000,
      revenueAchievements: 75,
      ats1: 21000,
      billRevenue: 180000,
      achievement: 90,
      ats2: 25700,
    },
    deductions: { netTotal: 5000 },
    mediend: { share: 45000, profit: 40000 },
    previousMonths: { mar25: 95, jun25: 88, nov24: 92 },
    requiredRate: { surgeryShortMtd: -2, weeklySurgeriesRequiredCurrent: 2.5, weeklySurgeriesRequiredNext: 3 },
    expected: { mtd: 10 },
  },
  {
    id: '2',
    name: 'Sonu',
    team: 'Team B',
    teamSize: 8,
    targetSalaryMin: 60000,
    target: 100000,
    month: prevMonth,
    expectedMtdIpd: { achievement: 12, percentage: 80 },
    actualMtd: {
      ipdAverageJan25: 10.2,
      startDate: '01/06/2026',
      opdDone: 25,
      endDate: '30/06/2026',
      costPerIpdSalary: 5000,
      costPerIpdSalarySeat: 7200,
      salary: 60000,
      seatCost: 26400,
    },
    cost: { incentive: 8000, marketingCost: 3500, totalSpend: 97900 },
    netProfit: { actual: 210000, achievement: 210 },
    targetGroup: { revenueTarget: 350000, ats: 29000 },
    ipdDone: { jan25: 11 },
    revenueAndBill: {
      settledRevenue: 280000,
      revenueAchievements: 80,
      ats1: 25400,
      billRevenue: 320000,
      achievement: 91,
      ats2: 29090,
    },
    deductions: { netTotal: 8000 },
    mediend: { share: 80000, profit: 72000 },
    previousMonths: { mar25: 105, jun25: 110, nov24: 102 },
    requiredRate: { surgeryShortMtd: 1, weeklySurgeriesRequiredCurrent: 3.5, weeklySurgeriesRequiredNext: 4 },
    expected: { mtd: 15 },
  }
]

// Custom Header Filter to bridge between TanStack and ColumnFilter
function HeaderFilter({ title, column, type = 'text', options = [] }: any) {
  const value = column.getFilterValue()
  return (
    <div className="flex items-center justify-between gap-1 whitespace-nowrap px-2 py-0.5 font-semibold text-[11px] text-slate-700 dark:text-[#c7c6cd]">
      <span>{title}</span>
      <ColumnFilter
        type={type}
        options={options}
        value={value}
        onChange={(val) => column.setFilterValue(val)}
      />
    </div>
  )
}

const columnHelper = createColumnHelper<BluePrintRecord>()

export function BluePrintTable() {
  const { hasAccess, permissions } = usePermissions()
  const [selectedMonths, setSelectedMonths] = useState<string[]>([currentMonthKey()])
  const [monthsMenuOpen, setMonthsMenuOpen] = useState(false)
  const [tempSelectedMonths, setTempSelectedMonths] = useState<string[]>([currentMonthKey()])
  const [monthsSearchQuery, setMonthsSearchQuery] = useState('')

  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({
    name: true,
    team: true,
    teamSize: true,
    targetSalaryMin: true,
    target: true,
    expectedMtdIpdAchievement: true,
    expectedMtdIpdPercentage: true,
    actualMtdIpdAverage: true,
    actualMtdStartDate: true,
    actualMtdOpdDone: true,
    actualMtdEndDate: true,
    actualMtdCostPerIpdSalary: true,
    actualMtdCostPerIpdSalarySeat: true,
    actualMtdSalary: true,
    actualMtdSeatCost: true,
    costIncentive: true,
    costMarketingCost: true,
    costTotalSpend: true,
    netProfitActual: true,
    netProfitAchievement: true,
    targetGroupRevenueTarget: true,
    targetGroupAts: true,
    ipdDoneJan25: true,
    revenueAndBillSettledRevenue: true,
    revenueAndBillRevenueAchievements: true,
    revenueAndBillAts1: true,
    revenueAndBillBillRevenue: true,
    revenueAndBillAchievement: true,
    revenueAndBillAts2: true,
    deductionsNetTotal: true,
    mediendShare: true,
    mediendProfit: true,
    previousMonthsMar25: true,
    previousMonthsJun25: true,
    previousMonthsNov24: true,
    requiredRateSurgeryShortMtd: true,
    requiredRateWeeklySurgeriesRequiredCurrent: true,
    requiredRateWeeklySurgeriesRequiredNext: true,
    expectedMtd: true,
  })

  // Theme-specific colors definition
  const scrollableHeaderL1Class = 'bg-[#f1f5f9] dark:bg-[#151a30] text-slate-800 dark:text-slate-200 font-bold uppercase tracking-wider text-center border-y border-slate-300 dark:border-[#2b355a]'
  const scrollableHeaderL2Class = 'bg-[#f8fafc] dark:bg-[#1c223f] text-slate-600 dark:text-[#a0aec0] font-semibold border-b border-slate-200 dark:border-[#283150]'
  const scrollableCellClass = 'bg-white dark:bg-[#0b0e1b]'

  // Sticky colors
  const stickyHeaderL1Class = 'sticky left-0 z-30 bg-[#cbd5e1] dark:bg-[#1a1f36] border-r-2 border-slate-350 dark:border-[#2b355a] shadow-[4px_0_8px_rgba(0,0,0,0.06)]'
  const stickyHeaderL2Class = 'sticky left-0 bg-[#e2e8f0] dark:bg-[#222949] z-30 text-slate-800 dark:text-[#dce1ff]'
  const stickyCellClass = 'sticky left-0 bg-[#f8fafc] dark:bg-[#0e1220] z-10 font-bold text-slate-900 dark:text-white shadow-[2px_0_4px_rgba(0,0,0,0.04)] border-r border-slate-100 dark:border-[#283150]/30'

  const columns = useMemo(() => {
    const isTeamVisible = columnVisibility.team

    // Apply double-thick borders to the boundary sticky column to demarcate sticky zone clearly
    const lastStickyHeaderClass = cn(
      stickyHeaderL2Class,
      "border-r-2 border-slate-350 dark:border-[#2b355a] shadow-[4px_0_8px_rgba(0,0,0,0.06)]"
    )
    const lastStickyCellClass = cn(
      stickyCellClass,
      "border-r-2 border-slate-300 dark:border-[#2b355a] shadow-[4px_0_8px_rgba(0,0,0,0.06)]"
    )

    const rawColumns = [
      // Sticky Basic Info Group (Contains only Name and Team sticky columns)
      columnHelper.group({
        id: 'basicInfo',
        header: '',
        meta: {
          headerClassName: stickyHeaderL1Class,
          headerStyle: { left: 0 },
        },
        columns: [
          columnHelper.accessor('name', {
            id: 'name',
            header: ({ column }) => <HeaderFilter title="Name" column={column} type="search" />,
            cell: info => <div className="min-w-[120px]">{info.getValue()}</div>,
            meta: {
              headerClassName: isTeamVisible ? stickyHeaderL2Class : lastStickyHeaderClass,
              headerStyle: { left: 0 },
              cellClassName: isTeamVisible ? stickyCellClass : lastStickyCellClass,
              cellStyle: { left: 0 },
            }
          }),
          columnHelper.accessor('team', {
            id: 'team',
            header: ({ column }) => <HeaderFilter title="Team" column={column} type="multiSelect" options={['Team A', 'Team B']} />,
            cell: info => <div className="min-w-[80px] text-center">{info.getValue()}</div>,
            meta: {
              headerClassName: lastStickyHeaderClass,
              headerStyle: { left: 153 },
              cellClassName: lastStickyCellClass,
              cellStyle: { left: 153 },
            }
          }),
        ]
      }),
      // Standalone Team Size Group to align Row 1 and Row 2 scrollable headers correctly
      columnHelper.group({
        id: 'teamSizeGroup',
        header: '',
        meta: { headerClassName: scrollableHeaderL1Class },
        columns: [
          columnHelper.accessor('teamSize', {
            id: 'teamSize',
            header: ({ column }) => <HeaderFilter title="Team Size" column={column} type="numberRange" />,
            cell: info => <div className="min-w-[80px] text-center">{info.getValue()}</div>,
            meta: {
              headerClassName: scrollableHeaderL2Class,
              cellClassName: scrollableCellClass
            }
          }),
        ]
      }),

      // ACTUAL Group
      columnHelper.group({
        id: 'actual',
        header: 'ACTUAL',
        meta: { headerClassName: scrollableHeaderL1Class },
        columns: [
          columnHelper.accessor('targetSalaryMin', {
            id: 'targetSalaryMin',
            header: ({ column }) => <HeaderFilter title="Target (Salary Min)" column={column} type="numberRange" />,
            cell: info => <div className="min-w-[120px] text-right">₹{info.getValue().toLocaleString('en-IN')}</div>,
            meta: { headerClassName: scrollableHeaderL2Class, cellClassName: scrollableCellClass }
          }),
          columnHelper.accessor('target', {
            id: 'target',
            header: ({ column }) => <HeaderFilter title="Target" column={column} type="numberRange" />,
            cell: info => <div className="min-w-[100px] text-right">₹{info.getValue().toLocaleString('en-IN')}</div>,
            meta: { headerClassName: scrollableHeaderL2Class, cellClassName: scrollableCellClass }
          }),
        ]
      }),

      // EXPECTED MTD-IPD Achievement Group
      columnHelper.group({
        id: 'expectedMtdIpd',
        header: 'EXPECTED MTD-IPD Achievement',
        meta: { headerClassName: scrollableHeaderL1Class },
        columns: [
          columnHelper.accessor('expectedMtdIpd.achievement', {
            id: 'expectedMtdIpdAchievement',
            header: ({ column }) => <HeaderFilter title="IPD Achievement" column={column} type="numberRange" />,
            cell: info => <div className="min-w-[120px] text-center">{info.getValue()}</div>,
            meta: { headerClassName: scrollableHeaderL2Class, cellClassName: scrollableCellClass }
          }),
          columnHelper.accessor('expectedMtdIpd.percentage', {
            id: 'expectedMtdIpdPercentage',
            header: ({ column }) => <HeaderFilter title="IPD %" column={column} type="numberRange" />,
            cell: info => <div className="min-w-[80px] text-center text-cyan-600 dark:text-cyan-400 font-semibold">{info.getValue()}%</div>,
            meta: { headerClassName: scrollableHeaderL2Class, cellClassName: scrollableCellClass }
          }),
        ]
      }),

      // Actual-MTD Group
      columnHelper.group({
        id: 'actualMtd',
        header: 'Actual-MTD',
        meta: { headerClassName: scrollableHeaderL1Class },
        columns: [
          columnHelper.accessor('actualMtd.ipdAverageJan25', {
            id: 'actualMtdIpdAverage',
            header: ({ column }) => <HeaderFilter title="IPD Average" column={column} type="numberRange" />,
            cell: info => <div className="min-w-[140px] text-center">{info.getValue()}</div>,
            meta: { headerClassName: scrollableHeaderL2Class, cellClassName: scrollableCellClass }
          }),
          columnHelper.accessor('actualMtd.startDate', {
            id: 'actualMtdStartDate',
            header: ({ column }) => <HeaderFilter title="Start Date" column={column} type="dateRange" />,
            cell: info => <div className="min-w-[100px] text-center text-slate-500">{info.getValue()}</div>,
            meta: { headerClassName: scrollableHeaderL2Class, cellClassName: scrollableCellClass }
          }),
          columnHelper.accessor('actualMtd.opdDone', {
            id: 'actualMtdOpdDone',
            header: ({ column }) => <HeaderFilter title="OPD Done" column={column} type="numberRange" />,
            cell: info => <div className="min-w-[100px] text-center">{info.getValue()}</div>,
            meta: { headerClassName: scrollableHeaderL2Class, cellClassName: scrollableCellClass }
          }),
          columnHelper.accessor('actualMtd.endDate', {
            id: 'actualMtdEndDate',
            header: ({ column }) => <HeaderFilter title="End Date" column={column} type="dateRange" />,
            cell: info => <div className="min-w-[100px] text-center text-slate-500">{info.getValue()}</div>,
            meta: { headerClassName: scrollableHeaderL2Class, cellClassName: scrollableCellClass }
          }),
          columnHelper.accessor('actualMtd.costPerIpdSalary', {
            id: 'actualMtdCostPerIpdSalary',
            header: ({ column }) => <HeaderFilter title="Cost Per IPD (Salary)" column={column} type="numberRange" />,
            cell: info => <div className="min-w-[150px] text-right">₹{info.getValue().toLocaleString('en-IN')}</div>,
            meta: { headerClassName: scrollableHeaderL2Class, cellClassName: scrollableCellClass }
          }),
          columnHelper.accessor('actualMtd.costPerIpdSalarySeat', {
            id: 'actualMtdCostPerIpdSalarySeat',
            header: ({ column }) => <HeaderFilter title="Cost (Salary+Seat)" column={column} type="numberRange" />,
            cell: info => <div className="min-w-[180px] text-right">₹{info.getValue().toLocaleString('en-IN')}</div>,
            meta: { headerClassName: scrollableHeaderL2Class, cellClassName: scrollableCellClass }
          }),
          columnHelper.accessor('actualMtd.salary', {
            id: 'actualMtdSalary',
            header: ({ column }) => <HeaderFilter title="Salary" column={column} type="numberRange" />,
            cell: info => <div className="min-w-[100px] text-right">₹{info.getValue().toLocaleString('en-IN')}</div>,
            meta: { headerClassName: scrollableHeaderL2Class, cellClassName: scrollableCellClass }
          }),
          columnHelper.accessor('actualMtd.seatCost', {
            id: 'actualMtdSeatCost',
            header: ({ column }) => <HeaderFilter title="Seat Cost" column={column} type="numberRange" />,
            cell: info => <div className="min-w-[100px] text-right">₹{info.getValue().toLocaleString('en-IN')}</div>,
            meta: { headerClassName: scrollableHeaderL2Class, cellClassName: scrollableCellClass }
          }),
        ]
      }),

      // COST Group
      columnHelper.group({
        id: 'cost',
        header: 'COST',
        meta: { headerClassName: scrollableHeaderL1Class },
        columns: [
          columnHelper.accessor('cost.incentive', {
            id: 'costIncentive',
            header: ({ column }) => <HeaderFilter title="Incentive" column={column} type="numberRange" />,
            cell: info => <div className="min-w-[100px] text-right">₹{info.getValue().toLocaleString('en-IN')}</div>,
            meta: { headerClassName: scrollableHeaderL2Class, cellClassName: scrollableCellClass }
          }),
          columnHelper.accessor('cost.marketingCost', {
            id: 'costMarketingCost',
            header: ({ column }) => <HeaderFilter title="Marketing Cost" column={column} type="numberRange" />,
            cell: info => <div className="min-w-[120px] text-right">₹{info.getValue().toLocaleString('en-IN')}</div>,
            meta: { headerClassName: scrollableHeaderL2Class, cellClassName: scrollableCellClass }
          }),
          columnHelper.accessor('cost.totalSpend', {
            id: 'costTotalSpend',
            header: ({ column }) => <HeaderFilter title="TOTAL SPEND" column={column} type="numberRange" />,
            cell: info => <div className="min-w-[120px] font-bold text-right text-slate-900 dark:text-slate-100">₹{info.getValue().toLocaleString('en-IN')}</div>,
            meta: { headerClassName: scrollableHeaderL2Class, cellClassName: scrollableCellClass }
          }),
        ]
      }),

      // Net-Profit Group
      columnHelper.group({
        id: 'netProfit',
        header: 'Net-Profit',
        meta: { headerClassName: scrollableHeaderL1Class },
        columns: [
          columnHelper.accessor('netProfit.actual', {
            id: 'netProfitActual',
            header: ({ column }) => <HeaderFilter title="Actual" column={column} type="numberRange" />,
            cell: info => <div className="min-w-[120px] text-right text-emerald-600 dark:text-emerald-400 font-bold">₹{info.getValue().toLocaleString('en-IN')}</div>,
            meta: { headerClassName: scrollableHeaderL2Class, cellClassName: scrollableCellClass }
          }),
          columnHelper.accessor('netProfit.achievement', {
            id: 'netProfitAchievement',
            header: ({ column }) => <HeaderFilter title="Achievement" column={column} type="numberRange" />,
            cell: info => <div className="min-w-[100px] text-center font-bold text-cyan-600 dark:text-cyan-400">{info.getValue()}%</div>,
            meta: { headerClassName: scrollableHeaderL2Class, cellClassName: scrollableCellClass }
          }),
        ]
      }),

      // Target Group
      columnHelper.group({
        id: 'targetGroup',
        header: 'Target',
        meta: { headerClassName: scrollableHeaderL1Class },
        columns: [
          columnHelper.accessor('targetGroup.revenueTarget', {
            id: 'targetGroupRevenueTarget',
            header: ({ column }) => <HeaderFilter title="Revenue Target" column={column} type="numberRange" />,
            cell: info => <div className="min-w-[140px] text-right">₹{info.getValue().toLocaleString('en-IN')}</div>,
            meta: { headerClassName: scrollableHeaderL2Class, cellClassName: scrollableCellClass }
          }),
          columnHelper.accessor('targetGroup.ats', {
            id: 'targetGroupAts',
            header: ({ column }) => <HeaderFilter title="ATS" column={column} type="numberRange" />,
            cell: info => <div className="min-w-[100px] text-right">₹{info.getValue().toLocaleString('en-IN')}</div>,
            meta: { headerClassName: scrollableHeaderL2Class, cellClassName: scrollableCellClass }
          }),
        ]
      }),

      // IPD Done Group
      columnHelper.group({
        id: 'ipdDone',
        header: 'IPD Done',
        meta: { headerClassName: scrollableHeaderL1Class },
        columns: [
          columnHelper.accessor('ipdDone.jan25', {
            id: 'ipdDoneJan25',
            header: ({ column }) => <HeaderFilter title="Month Count" column={column} type="numberRange" />,
            cell: info => <div className="min-w-[80px] text-center font-bold">{info.getValue()}</div>,
            meta: { headerClassName: scrollableHeaderL2Class, cellClassName: scrollableCellClass }
          }),
        ]
      }),

      // Revenue and Bill Group
      columnHelper.group({
        id: 'revenueAndBill',
        header: 'Revenue and Bill',
        meta: { headerClassName: scrollableHeaderL1Class },
        columns: [
          columnHelper.accessor('revenueAndBill.settledRevenue', {
            id: 'revenueAndBillSettledRevenue',
            header: ({ column }) => <HeaderFilter title="Settled Revenue" column={column} type="numberRange" />,
            cell: info => <div className="min-w-[140px] text-right">₹{info.getValue().toLocaleString('en-IN')}</div>,
            meta: { headerClassName: scrollableHeaderL2Class, cellClassName: scrollableCellClass }
          }),
          columnHelper.accessor('revenueAndBill.revenueAchievements', {
            id: 'revenueAndBillRevenueAchievements',
            header: ({ column }) => <HeaderFilter title="Achievements" column={column} type="numberRange" />,
            cell: info => <div className="min-w-[160px] text-center text-cyan-600 dark:text-cyan-400 font-semibold">{info.getValue()}%</div>,
            meta: { headerClassName: scrollableHeaderL2Class, cellClassName: scrollableCellClass }
          }),
          columnHelper.accessor('revenueAndBill.ats1', {
            id: 'revenueAndBillAts1',
            header: ({ column }) => <HeaderFilter title="ATS" column={column} type="numberRange" />,
            cell: info => <div className="min-w-[100px] text-right">₹{info.getValue().toLocaleString('en-IN')}</div>,
            meta: { headerClassName: scrollableHeaderL2Class, cellClassName: scrollableCellClass }
          }),
          columnHelper.accessor('revenueAndBill.billRevenue', {
            id: 'revenueAndBillBillRevenue',
            header: ({ column }) => <HeaderFilter title="Bill Revenue" column={column} type="numberRange" />,
            cell: info => <div className="min-w-[120px] text-right">₹{info.getValue().toLocaleString('en-IN')}</div>,
            meta: { headerClassName: scrollableHeaderL2Class, cellClassName: scrollableCellClass }
          }),
          columnHelper.accessor('revenueAndBill.achievement', {
            id: 'revenueAndBillAchievement',
            header: ({ column }) => <HeaderFilter title="Achievement" column={column} type="numberRange" />,
            cell: info => <div className="min-w-[100px] text-center text-cyan-600 dark:text-cyan-400 font-semibold">{info.getValue()}%</div>,
            meta: { headerClassName: scrollableHeaderL2Class, cellClassName: scrollableCellClass }
          }),
          columnHelper.accessor('revenueAndBill.ats2', {
            id: 'revenueAndBillAts2',
            header: ({ column }) => <HeaderFilter title="ATS" column={column} type="numberRange" />,
            cell: info => <div className="min-w-[100px] text-right">₹{info.getValue().toLocaleString('en-IN')}</div>,
            meta: { headerClassName: scrollableHeaderL2Class, cellClassName: scrollableCellClass }
          }),
        ]
      }),

      // DEDUCTIONS Group
      columnHelper.group({
        id: 'deductions',
        header: 'DEDUCTIONS',
        meta: { headerClassName: scrollableHeaderL1Class },
        columns: [
          columnHelper.accessor('deductions.netTotal', {
            id: 'deductionsNetTotal',
            header: ({ column }) => <HeaderFilter title="NetTotal" column={column} type="numberRange" />,
            cell: info => <div className="min-w-[100px] text-right text-rose-500 font-semibold">-₹{info.getValue().toLocaleString('en-IN')}</div>,
            meta: { headerClassName: scrollableHeaderL2Class, cellClassName: scrollableCellClass }
          }),
        ]
      }),

      // MediEND Group
      columnHelper.group({
        id: 'mediend',
        header: 'MediEND',
        meta: { headerClassName: scrollableHeaderL1Class },
        columns: [
          columnHelper.accessor('mediend.share', {
            id: 'mediendShare',
            header: ({ column }) => <HeaderFilter title="Share" column={column} type="numberRange" />,
            cell: info => <div className="min-w-[120px] text-right">₹{info.getValue().toLocaleString('en-IN')}</div>,
            meta: { headerClassName: scrollableHeaderL2Class, cellClassName: scrollableCellClass }
          }),
          columnHelper.accessor('mediend.profit', {
            id: 'mediendProfit',
            header: ({ column }) => <HeaderFilter title="Profit" column={column} type="numberRange" />,
            cell: info => <div className="min-w-[120px] font-bold text-right text-emerald-600 dark:text-emerald-400">₹{info.getValue().toLocaleString('en-IN')}</div>,
            meta: { headerClassName: scrollableHeaderL2Class, cellClassName: scrollableCellClass }
          }),
        ]
      }),

      // Previous Months MTD Group
      columnHelper.group({
        id: 'previousMonths',
        header: 'Previous Months-MTD',
        meta: { headerClassName: scrollableHeaderL1Class },
        columns: [
          columnHelper.accessor('previousMonths.mar25', {
            id: 'previousMonthsMar25',
            header: ({ column }) => <HeaderFilter title="Mar25" column={column} type="numberRange" />,
            cell: info => <div className="min-w-[80px] text-center text-slate-500">{info.getValue()}%</div>,
            meta: { headerClassName: scrollableHeaderL2Class, cellClassName: scrollableCellClass }
          }),
          columnHelper.accessor('previousMonths.jun25', {
            id: 'previousMonthsJun25',
            header: ({ column }) => <HeaderFilter title="Jun25" column={column} type="numberRange" />,
            cell: info => <div className="min-w-[80px] text-center text-slate-500">{info.getValue()}%</div>,
            meta: { headerClassName: scrollableHeaderL2Class, cellClassName: scrollableCellClass }
          }),
          columnHelper.accessor('previousMonths.nov24', {
            id: 'previousMonthsNov24',
            header: ({ column }) => <HeaderFilter title="Nov24" column={column} type="numberRange" />,
            cell: info => <div className="min-w-[80px] text-center text-slate-500">{info.getValue()}%</div>,
            meta: { headerClassName: scrollableHeaderL2Class, cellClassName: scrollableCellClass }
          }),
        ]
      }),

      // Required Rate Group
      columnHelper.group({
        id: 'requiredRate',
        header: 'Required Rate',
        meta: { headerClassName: scrollableHeaderL1Class },
        columns: [
          columnHelper.accessor('requiredRate.surgeryShortMtd', {
            id: 'requiredRateSurgeryShortMtd',
            header: ({ column }) => <HeaderFilter title="Surgery Short MTD" column={column} type="numberRange" />,
            cell: info => <div className="min-w-[140px] text-center text-rose-600 dark:text-rose-400 font-semibold">{info.getValue()}</div>,
            meta: { headerClassName: scrollableHeaderL2Class, cellClassName: scrollableCellClass }
          }),
          columnHelper.accessor('requiredRate.weeklySurgeriesRequiredCurrent', {
            id: 'requiredRateWeeklySurgeriesRequiredCurrent',
            header: ({ column }) => <HeaderFilter title="Weekly Current" column={column} type="numberRange" />,
            cell: info => <div className="min-w-[180px] text-center">{info.getValue()}</div>,
            meta: { headerClassName: scrollableHeaderL2Class, cellClassName: scrollableCellClass }
          }),
          columnHelper.accessor('requiredRate.weeklySurgeriesRequiredNext', {
            id: 'requiredRateWeeklySurgeriesRequiredNext',
            header: ({ column }) => <HeaderFilter title="Weekly Next" column={column} type="numberRange" />,
            cell: info => <div className="min-w-[180px] text-center">{info.getValue()}</div>,
            meta: { headerClassName: scrollableHeaderL2Class, cellClassName: scrollableCellClass }
          }),
        ]
      }),

      // Expected Group
      columnHelper.group({
        id: 'expected',
        header: 'Expected',
        meta: { headerClassName: scrollableHeaderL1Class },
        columns: [
          columnHelper.accessor('expected.mtd', {
            id: 'expectedMtd',
            header: ({ column }) => <HeaderFilter title="Expected MTD" column={column} type="numberRange" />,
            cell: info => <div className="min-w-[120px] text-center font-bold text-slate-800 dark:text-white">{info.getValue()}</div>,
            meta: { headerClassName: scrollableHeaderL2Class, cellClassName: scrollableCellClass }
          }),
        ]
      })
    ]

    // Recursive helper to filter column tree based on RBAC permissions
    const filterColumns = (cols: any[]): any[] => {
      return cols
        .map((col) => {
          if (col.columns) {
            return {
              ...col,
              columns: filterColumns(col.columns),
            }
          }
          return col
        })
        .filter((col) => {
          if (col.columns) {
            return col.columns.length > 0
          }
          const colId = col.id
          if (!colId) return true
          const resourceKey = `sales.blueprint_dashboard.table.blueprint.column.${colId}`
          if (permissions && resourceKey in permissions) {
            return hasAccess(resourceKey, 'READ')
          }
          return true
        })
    }

    return filterColumns(rawColumns)
  }, [columnVisibility, permissions, hasAccess])

  const handleMonthsMenuOpenChange = (open: boolean) => {
    setMonthsMenuOpen(open)
    if (open) {
      setTempSelectedMonths(selectedMonths)
      setMonthsSearchQuery('')
    }
  }

  // Client side filtering logic
  const filteredData = useMemo(() => {
    return mockData.filter(row => {
      // 1. Month filter
      if (selectedMonths.length > 0 && !selectedMonths.includes(row.month)) {
        return false
      }
      
      // 2. Custom column filters
      for (const filter of columnFilters) {
        const { id, value } = filter
        if (id === 'name') {
          if (!row.name.toLowerCase().includes(String(value).toLowerCase())) return false
        }
        if (id === 'team') {
          const arr = value as string[]
          if (arr.length > 0 && !arr.includes(row.team)) return false
        }
        if (id === 'teamSize') {
          const val = value as { min: number | null; max: number | null }
          if (val.min !== null && row.teamSize < val.min) return false
          if (val.max !== null && row.teamSize > val.max) return false
        }
        if (id === 'targetSalaryMin') {
          const val = value as { min: number | null; max: number | null }
          if (val.min !== null && row.targetSalaryMin < val.min) return false
          if (val.max !== null && row.targetSalaryMin > val.max) return false
        }
        if (id === 'target') {
          const val = value as { min: number | null; max: number | null }
          if (val.min !== null && row.target < val.min) return false
          if (val.max !== null && row.target > val.max) return false
        }
        if (id === 'expectedMtdIpdAchievement') {
          const val = value as { min: number | null; max: number | null }
          if (val.min !== null && row.expectedMtdIpd.achievement < val.min) return false
          if (val.max !== null && row.expectedMtdIpd.achievement > val.max) return false
        }
        if (id === 'expectedMtdIpdPercentage') {
          const val = value as { min: number | null; max: number | null }
          if (val.min !== null && row.expectedMtdIpd.percentage < val.min) return false
          if (val.max !== null && row.expectedMtdIpd.percentage > val.max) return false
        }
      }
      return true
    })
  }, [selectedMonths, columnFilters])

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = columnFilters.length
    if (selectedMonths.length !== 1 || selectedMonths[0] !== currentMonthKey()) {
      count++
    }
    return count
  }, [columnFilters, selectedMonths])

  const clearFilters = () => {
    setColumnFilters([])
    setSelectedMonths([currentMonthKey()])
  }

  const toggleCol = (id: string) => {
    setColumnVisibility(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const handleExport = () => {
    const headers = [
      'Name', 'Team', 'Team Size', 'Target (Salary Min)', 'Target',
      'IPD Achievement', 'IPD %', 'IPD Average', 'Start Date', 'OPD Done',
      'End Date', 'Cost Per IPD (Salary)', 'Cost Per IPD (Salary+Seat)', 'Salary', 'Seat Cost',
      'Incentive', 'Marketing Cost', 'TOTAL SPEND', 'Actual Profit', 'Achievement %',
      'Revenue Target', 'ATS', 'IPD Done Jan25', 'Settled Revenue', 'Revenue Achievements',
      'ATS Settled', 'Bill Revenue', 'Achievement Bill', 'ATS Bill', 'NetTotal Deductions',
      'MediEnd Share', 'MediEnd Profit', 'Mar25 %', 'Jun25 %', 'Nov24 %',
      'Surgery Short MTD', 'Weekly Surgeries Required Current', 'Weekly Surgeries Required Next', 'Expected MTD'
    ]
    
    const rows = filteredData.map(row => [
      row.name, row.team, row.teamSize, row.targetSalaryMin, row.target,
      row.expectedMtdIpd.achievement, row.expectedMtdIpd.percentage, row.actualMtd.ipdAverageJan25, row.actualMtd.startDate, row.actualMtd.opdDone,
      row.actualMtd.endDate, row.actualMtd.costPerIpdSalary, row.actualMtd.costPerIpdSalarySeat, row.actualMtd.salary, row.actualMtd.seatCost,
      row.cost.incentive, row.cost.marketingCost, row.cost.totalSpend, row.netProfit.actual, row.netProfit.achievement,
      row.targetGroup.revenueTarget, row.targetGroup.ats, row.ipdDone.jan25, row.revenueAndBill.settledRevenue, row.revenueAndBill.revenueAchievements,
      row.revenueAndBill.ats1, row.revenueAndBill.billRevenue, row.revenueAndBill.achievement, row.revenueAndBill.ats2, row.deductions.netTotal,
      row.mediend.share, row.mediend.profit, row.previousMonths.mar25, row.previousMonths.jun25, row.previousMonths.nov24,
      row.requiredRate.surgeryShortMtd, row.requiredRate.weeklySurgeriesRequiredCurrent, row.requiredRate.weeklySurgeriesRequiredNext, row.expected.mtd
    ])
    
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.join(','))].join('\n')
      
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", "blueprint-dashboard.csv")
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="w-full space-y-4">
      {/* Top Header Filters Panel */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between px-6 py-4 bg-slate-50/50 border-b border-slate-200 dark:border-[#283150] dark:bg-[#191D2E]/40">
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500 dark:text-[#c7c6cd]/80 font-medium">
            {filteredData.length} of {mockData.length} entries matching
          </span>
        </div>
        
        {/* Right Controls Group */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Reset Button */}
          {activeFilterCount > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 text-rose-600 dark:text-rose-400 hover:text-rose-700 hover:bg-rose-500/10 font-semibold"
              onClick={clearFilters}
            >
              <X className="h-4 w-4" />
              Reset ({activeFilterCount})
            </Button>
          )}

          {/* Month selector dropdown checklist */}
          <DropdownMenu open={monthsMenuOpen} onOpenChange={handleMonthsMenuOpenChange}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="gap-2 border-slate-300 bg-background/90 dark:border-[#283150] hover:bg-slate-100 dark:hover:bg-[#191D2E]"
              >
                <Calendar className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                Months {selectedMonths.length > 0 && `(${selectedMonths.length})`}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 p-2 z-50">
              <div className="flex flex-col gap-2">
                <Input
                  type="text"
                  placeholder="Search months..."
                  value={monthsSearchQuery}
                  onChange={(e) => setMonthsSearchQuery(e.target.value)}
                  className="h-8 text-xs px-2"
                />
                <div className="max-h-48 overflow-y-auto border rounded-md dark:border-[#283150]">
                  <DropdownMenuCheckboxItem
                    checked={tempSelectedMonths.length === MONTH_OPTIONS.length}
                    onCheckedChange={(checked) => {
                      if (checked) setTempSelectedMonths(MONTH_OPTIONS.map((m) => m.key))
                      else setTempSelectedMonths([])
                    }}
                    onSelect={(e) => e.preventDefault()}
                  >
                    All
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuSeparator />
                  {MONTH_OPTIONS.filter((m) =>
                    m.label.toLowerCase().includes(monthsSearchQuery.toLowerCase())
                  ).map((m) => (
                    <DropdownMenuCheckboxItem
                      key={m.key}
                      checked={tempSelectedMonths.includes(m.key)}
                      onCheckedChange={(checked) => {
                        setTempSelectedMonths((prev) =>
                          checked ? [...prev, m.key] : prev.filter((k) => k !== m.key)
                        )
                      }}
                      onSelect={(e) => e.preventDefault()}
                    >
                      {m.label}
                    </DropdownMenuCheckboxItem>
                  ))}
                </div>
                <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t dark:border-[#283150]">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setTempSelectedMonths([])
                      setSelectedMonths([])
                      setMonthsMenuOpen(false)
                    }}
                    className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                  >
                    Clear
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      setSelectedMonths(tempSelectedMonths)
                      setMonthsMenuOpen(false)
                    }}
                    className="h-7 px-2.5 text-xs font-medium"
                  >
                    Apply
                  </Button>
                </div>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Columns Visibility dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="gap-2 border-slate-300 bg-background/90 dark:border-[#283150] hover:bg-slate-100 dark:hover:bg-[#191D2E]"
              >
                <Settings2 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 max-h-[min(70vh,420px)] overflow-y-auto z-50">
              <DropdownMenuLabel>Visible Columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem checked disabled>
                Name (always on)
              </DropdownMenuCheckboxItem>
              {[
                ['team', 'Team'],
                ['teamSize', 'Team Size'],
                ['targetSalaryMin', 'Target (Salary Min)'],
                ['target', 'Target'],
                ['expectedMtdIpdAchievement', 'IPD Achievement'],
                ['expectedMtdIpdPercentage', 'IPD %'],
                ['actualMtdIpdAverage', 'IPD AVERAGE (Jan25)'],
                ['actualMtdStartDate', 'Start Date'],
                ['actualMtdOpdDone', 'OPD Done'],
                ['actualMtdEndDate', 'End Date'],
                ['actualMtdCostPerIpdSalary', 'Cost Per IPD (Salary)'],
                ['actualMtdCostPerIpdSalarySeat', 'Cost Per IPD (Salary+Seat)'],
                ['actualMtdSalary', 'Salary'],
                ['actualMtdSeatCost', 'Seat Cost'],
                ['costIncentive', 'Incentive'],
                ['costMarketingCost', 'Marketing Cost'],
                ['costTotalSpend', 'TOTAL SPEND'],
                ['netProfitActual', 'Actual Net Profit'],
                ['netProfitAchievement', 'Net Profit Achievement'],
                ['targetGroupRevenueTarget', 'Revenue Target'],
                ['targetGroupAts', 'ATS Target'],
                ['ipdDoneJan25', 'IPD Done Jan25'],
                ['revenueAndBillSettledRevenue', 'Settled Revenue'],
                ['revenueAndBillRevenueAchievements', 'Revenue Achievements'],
                ['revenueAndBillAts1', 'ATS Settled'],
                ['revenueAndBillBillRevenue', 'Bill Revenue'],
                ['revenueAndBillAchievement', 'Bill Achievement'],
                ['revenueAndBillAts2', 'ATS Bill'],
                ['deductionsNetTotal', 'Deductions NetTotal'],
                ['mediendShare', 'MediEnd Share'],
                ['mediendProfit', 'MediEnd Profit'],
                ['previousMonthsMar25', 'Mar25 MTD'],
                ['previousMonthsJun25', 'Jun25 MTD'],
                ['previousMonthsNov24', 'Nov24 MTD'],
                ['requiredRateSurgeryShortMtd', 'Surgery Short MTD'],
                ['requiredRateWeeklySurgeriesRequiredCurrent', 'Weekly Surgeries Req (Current)'],
                ['requiredRateWeeklySurgeriesRequiredNext', 'Weekly Surgeries Req (Next)'],
                ['expectedMtd', 'Expected MTD'],
              ].map(([id, label]) => (
                <DropdownMenuCheckboxItem
                  key={id}
                  checked={columnVisibility[id] ?? false}
                  onCheckedChange={() => toggleCol(id)}
                >
                  {label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Export to CSV */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            className="h-8 gap-2 border-indigo-200 hover:bg-indigo-50/50 dark:border-[#283150] dark:hover:bg-[#191D2E] text-indigo-700 dark:text-indigo-400 font-semibold"
          >
            <Download className="h-4 w-4" />
            <span>Export CSV</span>
          </Button>
        </div>
      </div>

      {/* Main Table Content wrapper using DataTable */}
      <div className="bg-white dark:bg-[#0b0e1b] rounded-b-xl overflow-hidden p-3">
        <DataTable
          columns={columns as any}
          data={filteredData}
          columnVisibility={columnVisibility}
          onColumnVisibilityChange={setColumnVisibility as any}
        />
      </div>
    </div>
  )
}
