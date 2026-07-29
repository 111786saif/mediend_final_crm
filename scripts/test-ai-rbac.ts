/**
 * Smoke-test role-scoped AI tool registration + subject resolution.
 *
 * Usage: bun scripts/test-ai-rbac.ts
 *
 * Requires DATABASE_URL. Does not call the LLM gateway.
 */

import '@/lib/ai/tools'
import { prisma } from '@/lib/prisma'
import { UserRole } from '@/generated/prisma/client'
import { buildAiActorFromUser } from '@/lib/ai/actor'
import { listToolNamesForActor } from '@/lib/ai/registry'
import { resolveSubject } from '@/lib/ai/resolve-subject'
import type { SessionUser } from '@/lib/auth'

const GLOBAL_TOOLS = new Set([
  'getOrgSalesKpis',
  'getOrgIpdLeaderboard',
  'getIpdBreakdown',
])

const TEAM_TOOLS = new Set([
  'getTeamAttendanceSummary',
  'getTeamIpdLeaderboard',
  'getTeamMemberSnapshot',
])

async function userForRole(role: UserRole): Promise<SessionUser | null> {
  const row = await prisma.user.findFirst({
    where: { role },
    select: { id: true, email: true, name: true, role: true },
  })
  if (!row) return null
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
  }
}

async function main() {
  const rolesToCheck: UserRole[] = [
    UserRole.BD,
    UserRole.TEAM_LEAD,
    UserRole.CATEGORY_MANAGER,
    UserRole.SALES_HEAD,
    UserRole.MD,
    UserRole.HR_HEAD,
    UserRole.EXECUTIVE_ASSISTANT,
  ]

  console.log('=== Tool set snapshots by role ===\n')

  const snapshots: Record<string, string[]> = {}

  for (const role of rolesToCheck) {
    const user = await userForRole(role)
    if (!user) {
      console.log(`[skip] No user with role ${role}`)
      continue
    }
    const actor = await buildAiActorFromUser(user)
    const tools = listToolNamesForActor(actor).sort()
    snapshots[role] = tools
    console.log(`${role} (${user.name}):`)
    console.log(`  teamSize=${actor.subordinateUserIds.length} isGlobal=${actor.isGlobal}`)
    console.log(`  tools (${tools.length}): ${tools.join(', ')}\n`)
  }

  // Assertions
  let failures = 0

  const bdTools = snapshots[UserRole.BD]
  if (bdTools) {
    for (const t of GLOBAL_TOOLS) {
      if (bdTools.includes(t)) {
        console.error(`FAIL: BD must not have ${t}`)
        failures++
      }
    }
    for (const t of TEAM_TOOLS) {
      if (bdTools.includes(t)) {
        console.error(`FAIL: BD must not have ${t}`)
        failures++
      }
    }
    if (!bdTools.includes('getMyLeaveBalance')) {
      console.error('FAIL: BD must have getMyLeaveBalance')
      failures++
    }
    if (!bdTools.includes('searchKnowledgeBase')) {
      console.error('FAIL: BD must have searchKnowledgeBase')
      failures++
    }
  }

  const mdTools = snapshots[UserRole.MD]
  if (mdTools) {
    for (const t of GLOBAL_TOOLS) {
      if (!mdTools.includes(t)) {
        console.error(`FAIL: MD must have ${t}`)
        failures++
      }
    }
  }

  // OUT_OF_SCOPE peer lookup for BD
  console.log('=== resolveSubject OUT_OF_SCOPE check ===\n')
  const bdUser = await userForRole(UserRole.BD)
  if (bdUser) {
    const actor = await buildAiActorFromUser(bdUser)
    // Find another BD who is not self and not a subordinate
    const peer = await prisma.user.findFirst({
      where: {
        role: UserRole.BD,
        id: { not: bdUser.id },
        employee: {
          id: { notIn: actor.subordinateEmployeeIds.length ? actor.subordinateEmployeeIds : ['__none__'] },
        },
      },
      select: { name: true, id: true },
    })
    if (peer) {
      const result = await resolveSubject(actor, peer.name)
      console.log(`BD "${bdUser.name}" looking up peer "${peer.name}":`, result)
      if (result.ok) {
        console.error('FAIL: peer lookup should be OUT_OF_SCOPE or NOT_FOUND for BD')
        failures++
      } else if (result.error !== 'OUT_OF_SCOPE' && result.error !== 'NOT_FOUND') {
        console.error(`FAIL: unexpected error ${result.error}`)
        failures++
      } else {
        console.log('OK: peer lookup denied\n')
      }

      // Self should work
      const self = await resolveSubject(actor, 'me')
      if (!self.ok) {
        console.error('FAIL: resolveSubject("me") should succeed for BD with employee record')
        failures++
      } else {
        console.log('OK: resolveSubject("me") →', self.name, '\n')
      }
    } else {
      console.log('[skip] No peer BD found for OUT_OF_SCOPE test\n')
    }
  }

  if (failures > 0) {
    console.error(`\n${failures} assertion(s) failed`)
    process.exit(1)
  }

  console.log('\nAll RBAC smoke checks passed.')
  await prisma.$disconnect()
}

main().catch(async (err) => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
})
