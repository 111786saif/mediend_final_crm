import { NextRequest } from 'next/server'
import { SessionUser } from '@/lib/auth'
import { getSessionFromRequest } from '@/lib/session'

const DOCTOR_ADMIN_ALLOWED_ROLES = new Set(['EXECUTIVE_ASSISTANT', 'ADMIN', 'MD', 'TESTER'])

export function getDoctorAdminUser(request: NextRequest): SessionUser | null {
  const user = getSessionFromRequest(request)
  if (!user) {
    return null
  }

  if (!DOCTOR_ADMIN_ALLOWED_ROLES.has(user.role)) {
    return null
  }

  return user
}

export function isDoctorAdminRole(role: string | undefined | null) {
  return !!role && DOCTOR_ADMIN_ALLOWED_ROLES.has(role)
}
