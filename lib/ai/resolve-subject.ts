import { prisma } from '@/lib/prisma'
import type { AiActor } from '@/lib/ai/actor'
import { headcountEmployeeWhere } from '@/lib/hrms/headcount'

export type ResolveSubjectResult =
  | {
      ok: true
      employeeId: string
      userId: string
      name: string
      email: string
      role: string
      isSelf: boolean
    }
  | {
      ok: false
      error: 'OUT_OF_SCOPE' | 'NOT_FOUND' | 'AMBIGUOUS'
      message: string
    }

/**
 * Resolve a person by name (or "me"/"myself") to an employee the actor may see.
 * Never accept raw employee IDs from the model — only names, resolved server-side.
 */
export async function resolveSubject(
  actor: AiActor,
  personName: string
): Promise<ResolveSubjectResult> {
  const raw = personName.trim()
  if (!raw) {
    return { ok: false, error: 'NOT_FOUND', message: 'No person name provided.' }
  }

  const lower = raw.toLowerCase()
  if (lower === 'me' || lower === 'myself' || lower === 'my' || lower === 'i') {
    if (!actor.employeeId) {
      return {
        ok: false,
        error: 'NOT_FOUND',
        message: 'You do not have an employee record linked to your account.',
      }
    }
    return {
      ok: true,
      employeeId: actor.employeeId,
      userId: actor.user.id,
      name: actor.user.name,
      email: actor.user.email,
      role: actor.user.role,
      isSelf: true,
    }
  }

  // Build allowed employee ID set: self + subordinates (or everyone if global)
  const allowedEmployeeIds = new Set<string>(actor.subordinateEmployeeIds)
  if (actor.employeeId) allowedEmployeeIds.add(actor.employeeId)

  const candidates = await prisma.employee.findMany({
    where: {
      ...headcountEmployeeWhere,
      ...(actor.isGlobal ? {} : { id: { in: [...allowedEmployeeIds] } }),
      user: {
        name: { contains: raw, mode: 'insensitive' },
      },
    },
    select: {
      id: true,
      userId: true,
      user: { select: { name: true, email: true, role: true } },
    },
    take: 10,
  })

  if (candidates.length === 0) {
    // Check if the person exists at all (for a clearer OUT_OF_SCOPE vs NOT_FOUND)
    const existsAnywhere = await prisma.employee.findFirst({
      where: { user: { name: { contains: raw, mode: 'insensitive' } } },
      select: { id: true },
    })
    if (existsAnywhere && !actor.isGlobal) {
      return {
        ok: false,
        error: 'OUT_OF_SCOPE',
        message: `You do not have access to information about "${raw}". You can only look up yourself and your direct/indirect reports.`,
      }
    }
    return {
      ok: false,
      error: 'NOT_FOUND',
      message: `No employee matching "${raw}" was found.`,
    }
  }

  if (candidates.length > 1) {
    const exact = candidates.filter(
      (c) => c.user.name.toLowerCase() === lower
    )
    if (exact.length === 1) {
      const c = exact[0]
      return {
        ok: true,
        employeeId: c.id,
        userId: c.userId,
        name: c.user.name,
        email: c.user.email,
        role: c.user.role,
        isSelf: c.userId === actor.user.id,
      }
    }
    return {
      ok: false,
      error: 'AMBIGUOUS',
      message: `Multiple people match "${raw}": ${candidates
        .map((c) => c.user.name)
        .join(', ')}. Please be more specific.`,
    }
  }

  const c = candidates[0]
  if (!actor.isGlobal && !allowedEmployeeIds.has(c.id)) {
    return {
      ok: false,
      error: 'OUT_OF_SCOPE',
      message: `You do not have access to information about "${c.user.name}".`,
    }
  }

  return {
    ok: true,
    employeeId: c.id,
    userId: c.userId,
    name: c.user.name,
    email: c.user.email,
    role: c.user.role,
    isSelf: c.userId === actor.user.id,
  }
}
