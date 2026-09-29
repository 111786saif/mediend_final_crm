export type PlFinancialInput = {
  actualFinalAmount?: number | string | null
  dcCharges?: number | string | null
  implantCost?: number | string | null
  instrumentsCost?: number | string | null
  hospitalSharePct?: number | string | null
  mediendSharePct?: number | string | null
  implantPaidBy?: string | null
  instrumentsPaidBy?: string | null
  actualImplantCost?: number | string | null
  actualInstrumentCost?: number | string | null
  doctorCharges?: number | string | null
  cabCharges?: number | string | null
  referralAmount?: number | string | null
  hospitalRecoverAmount?: number | string | null
}

const amount = (value: number | string | null | undefined) => {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value ?? '')
  return Number.isFinite(parsed) ? parsed : 0
}

/**
 * Shared P&L calculation used by the ledger editor.
 * Existing blank payer values remain treated as MediEND-paid so existing records
 * retain their established calculation until a payer is selected.
 */
export function calculatePlFinancials(input: PlFinancialInput) {
  const actualFinalAmount = amount(input.actualFinalAmount)
  const dcCharges = amount(input.dcCharges)
  const implantCost = amount(input.implantCost)
  const instrumentsCost = amount(input.instrumentsCost)
  const hospitalSharePct = amount(input.hospitalSharePct)
  const mediendSharePct = amount(input.mediendSharePct)
  const implantPaidByHospital = input.implantPaidBy === 'HOSPITAL'
  const instrumentsPaidByHospital = input.instrumentsPaidBy === 'HOSPITAL'

  const revenueBase = actualFinalAmount - dcCharges - implantCost - instrumentsCost
  const hospitalShare =
    (revenueBase * hospitalSharePct) / 100 +
    (implantPaidByHospital ? implantCost : 0) +
    (instrumentsPaidByHospital ? instrumentsCost : 0)
  const mediendShare =
    (revenueBase * mediendSharePct) / 100 +
    (!implantPaidByHospital ? implantCost : 0) +
    (!instrumentsPaidByHospital ? instrumentsCost : 0)

  const mediendCosts =
    amount(input.doctorCharges) +
    amount(input.cabCharges) +
    amount(input.referralAmount) +
    amount(input.hospitalRecoverAmount) +
    (!implantPaidByHospital ? amount(input.actualImplantCost) : 0) +
    (!instrumentsPaidByHospital ? amount(input.actualInstrumentCost) : 0)
  const mediendNetProfit = mediendShare - mediendCosts
  const mediendProfit = mediendNetProfit - (mediendShare * 0.1)

  return {
    revenueBase,
    hospitalShare,
    mediendShare,
    mediendNetProfit,
    mediendProfit,
  }
}
