/**
 * BD users no longer have User.team; team lives on Employee → DepartmentTeam.
 * Helpers keep API responses compatible where clients expect bd.team + bd.team.salesHead.
 */

import type { Prisma } from '@/generated/prisma/client'

export const prismaBdEmployeeTeamSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  phoneNumber: true,
  profilePicture: true,
  employee: {
    select: {
      manager: {
        select: {
          user: { select: { id: true, name: true } },
        },
      },
      team: {
        select: {
          id: true,
          name: true,
          department: {
            select: {
              head: { select: { id: true, name: true } },
            },
          },
          teamLead: {
            select: {
              user: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.UserSelect

type BdPayload = Prisma.UserGetPayload<{ select: typeof prismaBdEmployeeTeamSelect }>

export type LegacyBdTeam = {
  id: string
  name: string
  salesHead: { id: string; name: string } | null
} | null

/** Strip employee and expose legacy `team` (department head ≈ former salesHead) + manager. */
export function toLegacyBdShape(bd: BdPayload | null): Omit<BdPayload, 'employee'> & { team: LegacyBdTeam; manager: { id: string; name: string } | null } | null {
  if (!bd) return null
  const { employee, ...rest } = bd
  const t = employee?.team
  const mgr = employee?.manager?.user ?? null
  if (!t) {
    return { ...rest, team: null, manager: mgr }
  }
  return {
    ...rest,
    team: {
      id: t.id,
      name: t.name,
      salesHead: t.department?.head ?? null,
    },
    manager: mgr ?? t.teamLead?.user ?? null,
  }
}
