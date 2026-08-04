/** BD, TL, CM, ACM, Sales Head, Project Head (EA), plus admin/monitoring roles. */
export const SALES_OPD_MONITORING_ROLES = new Set<string>([
  'SUPER_ADMIN',
  'ADMIN',
  'MD',
  'EXECUTIVE_ASSISTANT',
  'TESTER',
  'BD',
  'TEAM_LEAD',
  'ASSISTANT_CATEGORY_MANAGER',
  'CATEGORY_MANAGER',
  'SALES_HEAD',
] as const)

export function canAccessSalesOpdMonitoring(role: string | null | undefined): boolean {
  return !!role && SALES_OPD_MONITORING_ROLES.has(role)
}
