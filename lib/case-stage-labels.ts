import { CaseStage } from '@/generated/prisma/enums'

/**
 * Shared case stage display config. Used by insurance dashboard and BD KYP page
 * so statuses are consistent across the app.
 */
export const CASE_STAGE_CONFIG: Record<CaseStage, { className: string; label: string }> = {
  [CaseStage.NEW_LEAD]: { className: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300', label: 'New Lead' },
  [CaseStage.KYP_BASIC_PENDING]: { className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300', label: 'Card Details Pending' },
  [CaseStage.KYP_BASIC_COMPLETE]: { className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300', label: 'Card Details Added' },
  [CaseStage.KYP_DETAILED_PENDING]: { className: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300', label: 'Detailed Form Pending' },
  [CaseStage.KYP_DETAILED_COMPLETE]: { className: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300', label: 'Detailed Form Complete' },
  [CaseStage.KYP_PENDING]: { className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300', label: 'Card Details Pending' },
  [CaseStage.KYP_COMPLETE]: { className: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300', label: 'Card Details Added' },
  [CaseStage.HOSPITALS_SUGGESTED]: { className: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300', label: 'Hospitals Suggested' },
  [CaseStage.PREAUTH_RAISED]: { className: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300', label: 'Pre-Auth Raised' },
  [CaseStage.PREAUTH_COMPLETE]: { className: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300', label: 'Pre-Auth Approved' },
  [CaseStage.INITIATED]: { className: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300', label: 'IPD Details Added' },
  [CaseStage.ADMITTED]: { className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300', label: 'IPD Marked' },
  [CaseStage.DISCHARGED]: { className: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300', label: 'Discharged' },
  [CaseStage.IPD_DONE]: { className: 'bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300', label: 'IPD Done' },
  [CaseStage.PL_PENDING]: { className: 'bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300', label: 'PL Pending' },
  [CaseStage.OUTSTANDING]: { className: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300', label: 'Outstanding' },
  [CaseStage.CASH_IPD_PENDING]: { className: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300', label: 'Cash IPD Pending' },
  [CaseStage.CASH_IPD_SUBMITTED]: { className: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300', label: 'Cash IPD Submitted' },
  [CaseStage.CASH_APPROVED]: { className: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300', label: 'Cash Approved' },
  [CaseStage.CASH_ON_HOLD]: { className: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300', label: 'Cash On Hold' },
  [CaseStage.CASH_IPD_DONE]: { className: 'bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300', label: 'Cash IPD Done' },
  [CaseStage.CASH_DISCHARGED]: { className: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300', label: 'Cash Discharged' },
}

export function getCaseStageLabel(stage: string): string {
  const config = CASE_STAGE_CONFIG[stage as CaseStage]
  return config?.label ?? stage.replace(/_/g, ' ')
}

export function getCaseStageBadgeConfig(stage: string): { className: string; label: string } {
  const config = CASE_STAGE_CONFIG[stage as CaseStage]
  return config ?? { className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300', label: stage.replace(/_/g, ' ') }
}
