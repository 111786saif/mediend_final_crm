export type SalesTeamCostRoleType = 'salesHead' | 'catManager' | 'tl' | 'bd'

export interface SalesTeamCostRole {
  id: string
  userId: string
  name: string
  type: SalesTeamCostRoleType
  count: number
  /** Displayed salary (override if set, otherwise payroll). */
  salaryPerHead: number
  /** Raw payroll salary for this employee (never modified by overrides). */
  payrollSalary: number
  /** True when a Sales Team Cost salary override is active for the period. */
  salaryIsOverride: boolean
  /** Approved incentive total for the selected month (from Incentive module). */
  incentiveAmount: number
  /** Seating cost for the selected month (monthly approved or master seating). */
  seatingAmount: number
  /** Misc cost for the selected month (from Sales Team Cost bulk entry). */
  miscAmount: number
  /** Other cost for the selected month (from Sales Team Cost bulk entry). */
  otherAmount: number
  marketingCost?: number
  children: SalesTeamCostRole[]
}

export interface SalesTeamCostRollup {
  salary: number
  incentives: number
  seating: number
  misc: number
  other: number
  marketing: number
  total: number
}

export interface SalesTeamCostSummary {
  headcount: number
  grandTotal: number
  rollup: SalesTeamCostRollup
}

export interface SalesTeamCostResponse {
  roots: SalesTeamCostRole[]
  summary: SalesTeamCostSummary
  month: number
  year: number
}

export interface SalaryOverrideHistoryEntry {
  id: string
  employeeId: string
  employeeName: string
  month: number
  year: number
  previousSalary: number
  updatedSalary: number
  difference: number
  reason: string
  updatedBy: string
  updatedAt: string
}

export const SALES_TEAM_COST_ROLE_LABEL: Record<SalesTeamCostRoleType, string> = {
  salesHead: 'Sales Head',
  catManager: 'Category Manager',
  tl: 'Team Leader',
  bd: 'Business Developer',
}
