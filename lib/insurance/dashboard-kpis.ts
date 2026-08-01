import { resolvePlRow } from '@/lib/pl/resolve-pl-row'
import { CaseStage } from '@/generated/prisma/enums'

export type InsuranceAmountPaidKpis = {
  caseCount: number
  totalAmountPaid: number
  ats: number | null
}

/** Patient has been marked discharged (insurance discharge step), not merely IPD done. */
export function isInsuranceDischargedLead(lead: Record<string, unknown>): boolean {
  const caseStage = lead.caseStage as CaseStage | undefined
  const dischargeSheet = lead.dischargeSheet as {
    dischargeDate?: unknown
    markedAt?: unknown
  } | null | undefined

  if (dischargeSheet?.dischargeDate != null || dischargeSheet?.markedAt != null) {
    return true
  }

  if (
    caseStage === CaseStage.DISCHARGED ||
    caseStage === CaseStage.CASH_DISCHARGED
  ) {
    return true
  }

  if (caseStage === CaseStage.PL_PENDING || caseStage === CaseStage.OUTSTANDING) {
    return resolvePlRow(lead).discharge != null
  }

  return false
}

/** ATS = average amount paid per discharged case (approved + patient deduction), P&L Ledger formula. */
export function computeInsuranceAmountPaidKpis(
  leads: Array<Record<string, unknown>>,
): InsuranceAmountPaidKpis {
  let totalAmountPaid = 0
  let caseCount = 0

  for (const lead of leads) {
    if (!isInsuranceDischargedLead(lead)) continue

    const resolved = resolvePlRow(lead)
    const amountPaid = (resolved.approvedAmount ?? 0) + (resolved.deductionPaidByPatient ?? 0)
    if (amountPaid <= 0) continue
    totalAmountPaid += amountPaid
    caseCount += 1
  }

  return {
    caseCount,
    totalAmountPaid,
    ats: caseCount > 0 ? Math.round(totalAmountPaid / caseCount) : null,
  }
}
