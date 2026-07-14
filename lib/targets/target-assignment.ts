import { UserRole } from '@/generated/prisma/client'
import { SessionUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const TEAM_TARGET_ROLES: UserRole[] = [
  UserRole.SALES_HEAD,
  UserRole.EXECUTIVE_ASSISTANT,
  UserRole.MD,
  UserRole.ADMIN,
]

export async function validateTargetAssignment(
  user: SessionUser,
  targetType: 'BD' | 'TEAM',
  targetForId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (targetType === 'TEAM') {
    if (!TEAM_TARGET_ROLES.includes(user.role as UserRole)) {
      return { ok: false, message: 'Only Sales Head can assign team targets to Team Leaders' }
    }

    const teamLead = await prisma.employee.findUnique({
      where: { id: targetForId },
      select: { user: { select: { role: true, name: true } } },
    })

    if (!teamLead || teamLead.user.role !== UserRole.TEAM_LEAD) {
      return { ok: false, message: 'Team targets must be assigned to a Team Leader' }
    }

    return { ok: true }
  }

  if (user.role !== UserRole.TEAM_LEAD) {
    return { ok: false, message: 'Only Team Leaders can assign targets to Business Development Executives' }
  }

  const manager = await prisma.employee.findUnique({
    where: { userId: user.id },
    select: {
      subordinates: {
        where: { userId: targetForId },
        select: { userId: true },
      },
    },
  })

  const isSelf = targetForId === user.id
  const isSubordinate = (manager?.subordinates.length ?? 0) > 0

  if (!isSelf && !isSubordinate) {
    return { ok: false, message: 'You can only assign targets to BDs on your team' }
  }

  const bdUser = await prisma.user.findUnique({
    where: { id: targetForId },
    select: { role: true },
  })

  if (!bdUser || (bdUser.role !== UserRole.BD && bdUser.role !== UserRole.TEAM_LEAD)) {
    return { ok: false, message: 'BD targets must be assigned to a Business Development Executive' }
  }

  return { ok: true }
}
