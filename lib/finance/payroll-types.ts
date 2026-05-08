export interface Department {
  id: string
  name: string
}

export interface Employee {
  id: string
  employeeCode: string
  joinDate: string | null
  salary: number | null
  designation: string | null
  panNumber: string | null
  bankAccountNumber: string | null
  ifscCode: string | null
  uanNumber: string | null
  user: { id: string; name: string; email: string; role: string }
  department: { id: string; name: string } | null
}

export interface SalaryStructure {
  id: string
  employeeId: string
  annualCtc: number
  monthlyGross: number
  basicSalary: number
  hraAllowance: number
  medicalAllowance: number
  conveyanceAllowance: number
  otherAllowance: number
  specialAllowance: number
  insuranceDeduction: number
  applyPf?: boolean
  applyTds: boolean
  tdsMonthly: number
  tdsRatePercent: number | null
  effectiveFrom: string
  effectiveTo: string | null
  createdAt?: string
  updatedAt?: string
  employee?: { id: string; employeeCode: string; user: { name: string }; department: { name: string } | null }
}

export interface MonthlyPayroll {
  id: string
  employeeId: string
  month: number
  year: number
  status: string
  adjustedGross: number
  netPayable: number
  payableDays?: number
  totalDaysInMonth?: number
  unpaidLeaves?: number
  adjustedBasic?: number
  adjustedHra?: number
  adjustedMedical?: number
  adjustedConveyance?: number
  adjustedOther?: number
  adjustedSpecial?: number
  epfEmployee?: number
  applyEsic?: boolean
  esicAmount?: number
  applyTds?: boolean
  tdsAmount?: number
  insurance?: number
  lateFines?: number
  totalDeductions?: number
  paidLeaves?: number
  employee?: { id: string; employeeCode: string; user: { name: string }; department: { name: string } | null }
}

export interface AttendanceSummary {
  totalDaysInMonth: number
  fullDays: number
  halfDays: number
  paidLeaves: number
  unpaidLeaves: number
  payableDays: number
  lateFines: number
  normalizedDays?: number
}

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.round(amount))
}
