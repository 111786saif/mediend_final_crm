export type SalesTeamCostRoleType = 'salesHead' | 'catManager' | 'tl' | 'bd'

export interface SalesTeamCostRole {
  id: string
  userId: string
  name: string
  type: SalesTeamCostRoleType
  count: number
  salaryPerHead: number
  /** Approved incentive total for the selected month (from Incentive module). */
  incentiveAmount: number
  /** Approved seating cost for the selected month (from Seating & Misc Cost module). */
  seatingAmount: number
  /** Approved misc cost for the selected month (from Seating & Misc Cost module). */
  miscAmount: number
  marketingCost?: number
  children: SalesTeamCostRole[]
}

export interface SalesTeamCostRollup {
  salary: number
  incentives: number
  seating: number
  misc: number
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

export const SALES_TEAM_COST_ROLE_LABEL: Record<SalesTeamCostRoleType, string> = {
  salesHead: 'Sales Head',
  catManager: 'Category Manager',
  tl: 'Team Leader',
  bd: 'Business Developer',
}
