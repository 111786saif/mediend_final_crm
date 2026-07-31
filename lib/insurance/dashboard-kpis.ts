import { resolvePlRow } from '@/lib/pl/resolve-pl-row'

export type InsuranceAmountPaidKpis = {
  caseCount: number
  totalAmountPaid: number
  ats: number | null
}

/** ATS = average amount paid per case (approved + patient deduction), P&L Ledger formula. */
export function computeInsuranceAmountPaidKpis(
  leads: Array<Record<string, unknown>>,
): InsuranceAmountPaidKpis {
  let totalAmountPaid = 0
  let caseCount = 0

  for (const lead of leads) {
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
