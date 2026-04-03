import type { ITResourcePaymentType, ITResourceType } from '@/generated/prisma/enums'

export type ResourceCostInput = {
  resourceType: ITResourceType
  allocationPercent: number
  paymentType: ITResourcePaymentType
  monthlyCost: number
  oneTimeCost: number
  startDate: Date | null
  endDate: Date | null
  isActive: boolean
  employeeSalary: number | null
  seatCostApplied?: boolean
}

/** Month is 1-12, year is full year */
export function isActiveInMonth(
  month: number,
  year: number,
  startDate: Date | null,
  endDate: Date | null
): boolean {
  const start = startDate ? new Date(startDate) : null
  const end = endDate ? new Date(endDate) : null
  const periodStart = new Date(year, month - 1, 1)
  const periodEnd = new Date(year, month, 0, 23, 59, 59, 999)
  if (start && periodEnd < start) return false
  if (end && periodStart > end) return false
  return true
}

export function monthlyCostForResource(
  input: ResourceCostInput,
  month: number,
  year: number,
  seatCostPerEmployee: number = 25000
): number {
  if (!input.isActive) return 0
  if (!isActiveInMonth(month, year, input.startDate, input.endDate)) return 0

  let total = 0

  if (input.resourceType === 'SALARIED') {
    if (input.monthlyCost > 0) {
      // New style: flat monthly cost
      total = input.monthlyCost
    } else {
      // Legacy: salary × allocationPercent / 100
      const sal = input.employeeSalary ?? 0
      total = (sal * (input.allocationPercent || 0)) / 100
    }
  } else {
    // Freelance
    if (input.paymentType === 'MONTHLY' || input.paymentType === 'BOTH') {
      total += input.monthlyCost || 0
    }
    if (input.paymentType === 'ONE_TIME') {
      const sd = input.startDate ? new Date(input.startDate) : new Date(year, month - 1, 1)
      if (sd.getMonth() + 1 === month && sd.getFullYear() === year) {
        total += input.oneTimeCost || 0
      }
    } else if (input.paymentType === 'BOTH') {
      const sd = input.startDate ? new Date(input.startDate) : null
      if (sd && sd.getMonth() + 1 === month && sd.getFullYear() === year) {
        total += input.oneTimeCost || 0
      }
    }
  }

  if (input.seatCostApplied) {
    total += seatCostPerEmployee
  }

  return total
}
