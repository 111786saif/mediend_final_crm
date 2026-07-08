export type SalesTeamCostRoleType = 'salesHead' | 'catManager' | 'tl' | 'bd'

export interface SalesTeamCostEntryRecord {
  id: string
  amount: number
  date: string
  note: string | null
  addedBy: string
  addedAt: string
}

export interface SalesTeamCostRole {
  id: string
  userId: string
  name: string
  type: SalesTeamCostRoleType
  count: number
  salaryPerHead: number
  incentives: SalesTeamCostEntryRecord[]
  seatingCosts: SalesTeamCostEntryRecord[]
  miscCosts: SalesTeamCostEntryRecord[]
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
}

export const SALES_TEAM_COST_ROLE_LABEL: Record<SalesTeamCostRoleType, string> = {
  salesHead: 'Sales Head',
  catManager: 'Category Manager',
  tl: 'Team Leader',
  bd: 'Business Developer',
}

/** Incentives only apply at Sales Head (Project Head if ever added to tree). */
export function canReceiveIncentive(type: SalesTeamCostRoleType): boolean {
  return type === 'salesHead'
}
