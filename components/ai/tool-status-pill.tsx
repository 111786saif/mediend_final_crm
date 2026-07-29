'use client'

import { Loader2 } from 'lucide-react'

const LABELS: Record<string, string> = {
  getMyTargetProgress: 'Checking your target…',
  getMyTargetTrend: 'Loading target trend…',
  getMyIpdCount: 'Counting your IPDs…',
  getMyLeaveBalance: 'Checking leave balance…',
  getMyLeaveHistory: 'Loading leave history…',
  getMyAttendance: 'Loading attendance…',
  getMyAttendanceStats: 'Computing attendance stats…',
  getMyIncentive: 'Looking up incentive…',
  getMyLeads: 'Querying your leads…',
  searchKnowledgeBase: 'Searching knowledge base…',
  getTeamAttendanceSummary: 'Checking team attendance…',
  getTeamLeaveBalances: 'Loading team leave balances…',
  getTeamLeaveRequests: 'Loading team leave requests…',
  getTeamMemberSnapshot: 'Building team member snapshot…',
  getTeamTargetProgress: 'Checking team targets…',
  getTeamIpdLeaderboard: 'Ranking team IPD…',
  getOrgSalesKpis: 'Fetching org sales KPIs…',
  getOrgHrKpis: 'Fetching org HR KPIs…',
  getOrgIpdLeaderboard: 'Ranking org IPD…',
  getIpdBreakdown: 'Breaking down IPD…',
  searchEmployeeDirectory: 'Searching employees…',
}

export function ToolStatusPill({ toolName }: { toolName: string }) {
  const label = LABELS[toolName] || `Running ${toolName}…`
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full border bg-muted/60 px-2.5 py-1 text-[11px] text-muted-foreground">
      <Loader2 className="size-3 animate-spin" />
      {label}
    </div>
  )
}
