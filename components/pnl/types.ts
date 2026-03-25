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
