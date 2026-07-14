/**
 * IPD target assignment rules based on employee tenure and salary slab.
 *
 * Tenure ≤ 1 year → target from salary slab
 * Tenure > 1 year  → target from tenure bracket
 */

export interface IpdTargetInput {
  joinDate: Date | string | null | undefined
  salary: number | null | undefined
  monthlyGross?: number | null | undefined
  asOf?: Date
}

export interface IpdTargetResult {
  suggestedTarget: number
  basis: 'salary_slab' | 'tenure'
  tenureYears: number
  salaryUsed: number | null
  label: string
}

/** Monthly gross salary slabs → monthly IPD target (tenure ≤ 1 year) */
const SALARY_SLAB_TARGETS: Array<{ maxSalary: number; target: number; label: string }> = [
  { maxSalary: 25_000, target: 4, label: 'Up to ₹25K' },
  { maxSalary: 40_000, target: 6, label: '₹25K – ₹40K' },
  { maxSalary: 60_000, target: 8, label: '₹40K – ₹60K' },
  { maxSalary: Infinity, target: 10, label: 'Above ₹60K' },
]

/** Tenure brackets → monthly IPD target (tenure > 1 year) */
const TENURE_TARGETS: Array<{ maxYears: number; target: number; label: string }> = [
  { maxYears: 2, target: 8, label: '1–2 years' },
  { maxYears: 3, target: 10, label: '2–3 years' },
  { maxYears: 5, target: 12, label: '3–5 years' },
  { maxYears: Infinity, target: 15, label: '5+ years' },
]

const ONE_YEAR_MS = 365.25 * 24 * 60 * 60 * 1000

export function resolveMonthlySalary(input: IpdTargetInput): number | null {
  const salary = input.monthlyGross ?? input.salary
  if (salary == null || salary <= 0) return null
  return salary
}

export function computeTenureYears(
  joinDate: Date | string | null | undefined,
  asOf: Date = new Date()
): number {
  if (!joinDate) return 0
  const joined = typeof joinDate === 'string' ? new Date(joinDate) : joinDate
  if (Number.isNaN(joined.getTime())) return 0
  return Math.max(0, (asOf.getTime() - joined.getTime()) / ONE_YEAR_MS)
}

function targetFromSalarySlab(salary: number): { target: number; label: string } {
  for (const slab of SALARY_SLAB_TARGETS) {
    if (salary <= slab.maxSalary) {
      return { target: slab.target, label: slab.label }
    }
  }
  return { target: 10, label: 'Above ₹60K' }
}

function targetFromTenure(tenureYears: number): { target: number; label: string } {
  for (const bracket of TENURE_TARGETS) {
    if (tenureYears <= bracket.maxYears) {
      return { target: bracket.target, label: bracket.label }
    }
  }
  return { target: 15, label: '5+ years' }
}

export function resolveSuggestedIpdTarget(input: IpdTargetInput): IpdTargetResult {
  const asOf = input.asOf ?? new Date()
  const tenureYears = computeTenureYears(input.joinDate, asOf)
  const salaryUsed = resolveMonthlySalary(input)

  if (tenureYears <= 1) {
    const salary = salaryUsed ?? 0
    const { target, label } = salary > 0 ? targetFromSalarySlab(salary) : { target: 4, label: 'Default (no salary)' }
    return {
      suggestedTarget: target,
      basis: 'salary_slab',
      tenureYears,
      salaryUsed: salaryUsed ?? null,
      label: `Salary slab: ${label}`,
    }
  }

  const { target, label } = targetFromTenure(tenureYears)
  return {
    suggestedTarget: target,
    basis: 'tenure',
    tenureYears,
    salaryUsed: salaryUsed ?? null,
    label: `Tenure: ${label}`,
  }
}
