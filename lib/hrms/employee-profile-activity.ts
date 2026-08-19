import { prisma } from '@/lib/prisma'
import type { Prisma } from '@/generated/prisma/client'

export const HR_RESET_PASSWORD = '12345678'

export const EMPLOYEE_PROFILE_ACTIONS = {
  NAME_CHANGED: 'NAME_CHANGED',
  PASSWORD_RESET: 'PASSWORD_RESET',
} as const

export type EmployeeProfileAction =
  (typeof EMPLOYEE_PROFILE_ACTIONS)[keyof typeof EMPLOYEE_PROFILE_ACTIONS]

export async function logEmployeeProfileActivity(params: {
  employeeId: string
  actorUserId: string
  action: EmployeeProfileAction
  summary: string
  metadata?: Prisma.InputJsonValue
}) {
  await prisma.employeeProfileActivityLog.create({
    data: {
      employeeId: params.employeeId,
      actorUserId: params.actorUserId,
      action: params.action,
      summary: params.summary,
      metadata: params.metadata,
    },
  })
}
