export type DischargeSheetFillStatus = 'NOT_STARTED' | 'PENDING' | 'FILLED'

export function getDischargeSheetFillStatus(lead: {
  dischargeSheet?: { id?: string; isFinalized?: boolean | null } | null
}): DischargeSheetFillStatus {
  if (!lead.dischargeSheet) return 'NOT_STARTED'
  if (lead.dischargeSheet.isFinalized === true) return 'FILLED'
  return 'PENDING'
}

export function getDischargeSheetFillStatusLabel(status: DischargeSheetFillStatus): string {
  switch (status) {
    case 'NOT_STARTED':
      return 'Not started'
    case 'PENDING':
      return 'Pending'
    case 'FILLED':
      return 'Filled'
  }
}

export function getDischargeSheetFillStatusBadgeClass(status: DischargeSheetFillStatus): string {
  switch (status) {
    case 'NOT_STARTED':
      return 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700'
    case 'PENDING':
      return 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-800'
    case 'FILLED':
      return 'bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-900/40 dark:text-teal-200 dark:border-teal-800'
  }
}
