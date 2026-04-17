export type PnlCategoryRow = {
  categoryId: string
  name: string
  type: string
  sourceKey: string | null
  departmentKey: string | null
  isSystem: boolean
  amounts: Record<string, number>
  isAutoFilled: Record<string, boolean>
}

export type PnlExpenseCategoryDetail = {
  categoryId: string
  name: string
  sourceKey: string | null
  departmentKey: string | null
  isSystem: boolean
  amounts: Record<string, number>
  isAutoFilled: Record<string, boolean>
  seatCostHint?: Record<string, number>
  salaryHint?: Record<string, number>
}

export type PnlDepartmentOverview = {
  key: string
  name: string
  revenueByMonth: Record<string, number>
  expensesByMonth: Record<string, number>
  netByMonth: Record<string, number>
  totalRevenue: number
  totalExpenses: number
  netPnL: number
  marginPct: number
  headcount: number
  expenseCategories: PnlExpenseCategoryDetail[]
}

export type PnlOverviewData = {
  months: { month: number; year: number }[]
  monthKeys: string[]
  categories: PnlCategoryRow[]
  revenueCategories: PnlCategoryRow[]
  departments: PnlDepartmentOverview[]
  revenueByDepartment: Record<string, Record<string, number>>
  itSalaryHintByMonth: Record<string, number>
  seatCostPerEmployee: number
  headcountByDepartment: Record<string, number>
  seatCostHintsByDepartment: Record<string, Record<string, number>>
  totals: { totalRevenue: number; totalExpenses: number; netPnL: number }
  chartSeries: {
    monthKey: string
    month: number
    year: number
    revenue: number
    expenses: number
    net: number
  }[]
}

/* ── Targeted PnL types ────────────────────────────── */

export type TargetPnlExpenseCategory = {
  sourceKey: string
  name: string
  amounts: Record<string, number>
  hints: Record<string, number>
}

export type TargetPnlDepartmentData = {
  key: string
  name: string
  revenueByMonth: Record<string, number>
  revenueHints: Record<string, number>
  expenseCategories: TargetPnlExpenseCategory[]
  totalRevenue: number
  totalExpenses: number
  netPnL: number
}

export type TargetPnlOverviewData = {
  months: { month: number; year: number }[]
  monthKeys: string[]
  departments: TargetPnlDepartmentData[]
  totals: { totalRevenue: number; totalExpenses: number; netPnL: number }
  savedKeys: string[]
}

export type TargetVsActualRow = {
  sourceKey: string
  name: string
  targeted: Record<string, number>
  actual: Record<string, number>
  variance: Record<string, number>
  variancePct: Record<string, number>
  totalTargeted: number
  totalActual: number
  totalVariance: number
  totalVariancePct: number
}

export type TargetVsActualDepartment = {
  key: string
  name: string
  revenue: TargetVsActualRow
  expenses: TargetVsActualRow[]
  net: {
    targeted: Record<string, number>
    actual: Record<string, number>
    variance: Record<string, number>
    totalTargeted: number
    totalActual: number
    totalVariance: number
  }
}

export type TargetVsActualData = {
  months: { month: number; year: number }[]
  monthKeys: string[]
  departments: TargetVsActualDepartment[]
  totals: {
    targetedRevenue: number
    actualRevenue: number
    targetedExpenses: number
    actualExpenses: number
    targetedNet: number
    actualNet: number
  }
}
