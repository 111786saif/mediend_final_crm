export const CASE_STATUS_COLORS: Record<string, string> = {
  ADMITTED: 'bg-blue-500/10 text-blue-700 border-blue-500/20 dark:text-blue-400 dark:border-blue-500/30',
  DISCHARGED: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30',
  CASH_DISCHARGED: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30',
  IPD_DONE: 'bg-cyan-500/10 text-cyan-700 border-cyan-500/20 dark:text-cyan-400 dark:border-cyan-500/30',
  CASH_IPD_DONE: 'bg-cyan-500/10 text-cyan-700 border-cyan-500/20 dark:text-cyan-400 dark:border-cyan-500/30',
  OUTSTANDING: 'bg-rose-500/10 text-rose-700 border-rose-500/20 dark:text-rose-400 dark:border-rose-500/30',
  PL_PENDING: 'bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-400 dark:border-amber-500/30',
  DRAFT: 'bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-400 dark:border-amber-500/30',
  NEW: 'bg-blue-500/10 text-blue-700 border-blue-500/20 dark:text-blue-400 dark:border-blue-500/30',
}

export const PAYOUT_STATUS_COLORS: Record<string, string> = {
  PAID: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30',
  PARTIAL: 'bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-400 dark:border-amber-500/30',
  PENDING: 'bg-slate-500/10 text-slate-700 border-slate-500/20 dark:text-slate-400 dark:border-slate-500/30',
  SENT: 'bg-blue-500/10 text-blue-700 border-blue-500/20 dark:text-blue-400 dark:border-blue-500/30',
}

export function getStatusBadgeClass(status: string | null | undefined, type: 'case' | 'payout'): string {
  if (!status) return 'bg-slate-500/10 text-slate-700 border-slate-500/20 dark:text-slate-400 dark:border-slate-500/30'
  const key = status.toUpperCase().trim()
  const map = type === 'case' ? CASE_STATUS_COLORS : PAYOUT_STATUS_COLORS
  return map[key] || 'bg-slate-500/10 text-slate-700 border-slate-500/20 dark:text-slate-400 dark:border-slate-500/30'
}
