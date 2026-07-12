import type { SessionUser } from '@/lib/auth'

/** Keep in sync with Chat item in lib/sidebar-nav.ts */
export const CHAT_ALLOWED_ROLES = [
  'BD',
  'TEAM_LEAD',
  'INSURANCE',
  'INSURANCE_HEAD',
  'PL_HEAD',
  'PL_ENTRY',
  'PL_VIEWER',
  'ACCOUNTS',
  'ADMIN',
  'TESTER',
  'EXECUTIVE_ASSISTANT',
  'COMPLIANCE_HEAD',
  'DIGITAL_MARKETING_HEAD',
] as const

export type ChatAllowedRole = (typeof CHAT_ALLOWED_ROLES)[number]

export function canAccessChat(user: SessionUser | null): boolean {
  if (!user) return false
  return (CHAT_ALLOWED_ROLES as readonly string[]).includes(user.role)
}
