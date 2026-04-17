/** Canonical P&L department keys (revenue + expense scope) */
export const PNL_DEPARTMENT_KEYS = ['SURGERY', 'IT', 'LOAN_DEMAT', 'GOOGLE_ADS'] as const
export type PnlDepartmentKey = (typeof PNL_DEPARTMENT_KEYS)[number]

export const PNL_EXPENSE_SOURCE_KEYS = ['SALARY', 'SEAT_COST', 'MARKETING', 'FREELANCERS', 'MISC'] as const

export const TARGET_PNL_SOURCE_KEYS = ['REVENUE', ...PNL_EXPENSE_SOURCE_KEYS] as const
export type TargetPnlSourceKey = (typeof TARGET_PNL_SOURCE_KEYS)[number]
