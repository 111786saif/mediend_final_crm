import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@/generated/prisma/client'
import { getManagerGroups } from '@/lib/hierarchy'
import { canonicalSalesCompletedWhere } from '@/lib/analytics/ipd-filters'

/**
 * Detects BD and Team rank changes (by IPD Done this month) and fires a
 * RANK_IMPROVED notification when someone moves up.
 *
 * Recipients on improvement:
 *  - BD rank up  → the BD themself, their Team Lead, and all Sales Heads
 *  - Team rank up → that Team Lead, and all Sales Heads
 *
 * Run every 15-30 min via cron, same pattern as the other /api/cron/* jobs.
 * First run for a given month just records a baseline snapshot (no
 * notification), so rollout doesn't spam everyone.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const expectedSecret = process.env.CRON_SECRET
  if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startTime = Date.now()
  const jobName = 'rank_check'
  const metric = 'IPD_DONE'

  try {
    const now = new Date()
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    // Full calendar month — matches the dashboard's own "this month" definition,
    // which includes future-dated IPDs scheduled later in the same month (e.g.
    // a surgery already booked for the 17th when today is the 9th). Cutting off
    // at `now` instead of month-end silently excluded those and under-counted.
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
    const dateFilter: Prisma.DateTimeFilter = { gte: monthStart, lte: monthEnd }

    const salesHeads = await prisma.user.findMany({
      where: { role: 'SALES_HEAD' },
      select: { id: true },
    })
    const salesHeadIds = salesHeads.map((s) => s.id)

    let notified = 0

    // ── BD leaderboard ────────────────────────────────────────────────
    const completedWhere = canonicalSalesCompletedWhere(dateFilter)
    const [completedStats, closedStats] = await Promise.all([
      prisma.lead.groupBy({ by: ['bdId'], where: completedWhere, _count: { id: true } }),
      prisma.lead.groupBy({
        by: ['bdId'],
        where: { status: { in: ['13', '25', '30', '31', '32'] }, leadEntryDate: dateFilter },
        _count: { id: true },
      }),
    ])
    const closedMap = new Map(closedStats.map((s) => [s.bdId, s._count.id]))
    const bdIds = [...new Set(completedStats.map((s) => s.bdId).filter((id): id is string => !!id))]

    const bds = await prisma.user.findMany({
      where: { id: { in: bdIds }, role: 'BD' },
      select: {
        id: true,
        name: true,
        employee: { select: { manager: { select: { user: { select: { id: true } } } } } },
      },
    })
    const bdRanking = completedStats
      .filter((s) => s.bdId && bds.some((b) => b.id === s.bdId))
      .map((s) => ({ bdId: s.bdId as string, ipdDone: s._count.id, closed: closedMap.get(s.bdId) ?? 0 }))
      .sort((a, b) => b.ipdDone - a.ipdDone || b.closed - a.closed)

    for (let i = 0; i < bdRanking.length; i++) {
      const rank = i + 1
      const entityId = bdRanking[i].bdId
      const prevSnapshot = await prisma.rankSnapshot.findUnique({
        where: { entityType_entityId_metric_month: { entityType: 'BD', entityId, metric, month } },
      })

      if (prevSnapshot && rank < prevSnapshot.rank) {
        const bd = bds.find((b) => b.id === entityId)
        const teamLeadUserId = bd?.employee?.manager?.user?.id ?? null
        const recipientIds = new Set<string>([entityId, ...salesHeadIds])
        if (teamLeadUserId) recipientIds.add(teamLeadUserId)

        await prisma.notification.createMany({
          data: [...recipientIds].map((userId) => ({
            userId,
            type: 'RANK_IMPROVED' as const,
            title: userId === entityId ? `You moved up to #${rank}!` : `${bd?.name ?? 'A BD'} moved up to #${rank}`,
            message:
              userId === entityId
                ? `You're now ranked #${rank} on the IPD leaderboard this month.`
                : `${bd?.name ?? 'A BD'} is now ranked #${rank} on the IPD leaderboard this month.`,
            link: '/home',
            relatedId: entityId,
          })),
        })
        notified += recipientIds.size
      }

      await prisma.rankSnapshot.upsert({
        where: { entityType_entityId_metric_month: { entityType: 'BD', entityId, metric, month } },
        create: { entityType: 'BD', entityId, metric, month, rank },
        update: { rank },
      })
    }

    // ── Team leaderboard (manager groups) ───────────────────────────────
    const managerGroups = await getManagerGroups()
    const teamRanking = managerGroups
      .map((group) => {
        const groupUserIds = new Set([group.managerUserId, ...group.subordinates.map((s) => s.userId)])
        let ipdDone = 0
        let closed = 0
        for (const s of completedStats) {
          if (s.bdId && groupUserIds.has(s.bdId)) ipdDone += s._count.id
        }
        for (const s of closedStats) {
          if (s.bdId && groupUserIds.has(s.bdId)) closed += s._count.id ?? 0
        }
        return { managerId: group.managerId, managerUserId: group.managerUserId, managerName: group.managerName, ipdDone, closed }
      })
      .filter((t) => t.ipdDone > 0 || t.closed > 0)
      .sort((a, b) => b.ipdDone - a.ipdDone || b.closed - a.closed)

    for (let i = 0; i < teamRanking.length; i++) {
      const rank = i + 1
      const team = teamRanking[i]
      const entityId = team.managerId
      const prevSnapshot = await prisma.rankSnapshot.findUnique({
        where: { entityType_entityId_metric_month: { entityType: 'TEAM', entityId, metric, month } },
      })

      if (prevSnapshot && rank < prevSnapshot.rank) {
        const recipientIds = new Set<string>([team.managerUserId, ...salesHeadIds])
        await prisma.notification.createMany({
          data: [...recipientIds].map((userId) => ({
            userId,
            type: 'RANK_IMPROVED' as const,
            title: userId === team.managerUserId ? `Your team moved up to #${rank}!` : `${team.managerName}'s team moved up to #${rank}`,
            message:
              userId === team.managerUserId
                ? `Your team is now ranked #${rank} on the team leaderboard this month.`
                : `${team.managerName}'s team is now ranked #${rank} on the team leaderboard this month.`,
            link: '/home',
            relatedId: entityId,
          })),
        })
        notified += recipientIds.size
      }

      await prisma.rankSnapshot.upsert({
        where: { entityType_entityId_metric_month: { entityType: 'TEAM', entityId, metric, month } },
        create: { entityType: 'TEAM', entityId, metric, month, rank },
        update: { rank },
      })
    }

    const durationMs = Date.now() - startTime
    await prisma.cronJobLog.create({    
      data: {
        jobName,
        status: 'success',
        durationMs,
        recordsProcessed: bdRanking.length + teamRanking.length,
        message: `Checked ${bdRanking.length} BDs, ${teamRanking.length} teams; sent ${notified} notifications`,
      },
    })

    return NextResponse.json({ success: true, jobName, durationMs, bdsChecked: bdRanking.length, teamsChecked: teamRanking.length, notificationsSent: notified })
  } catch (error) {
    const durationMs = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    await prisma.cronJobLog.create({
      data: { jobName, status: 'error', durationMs, recordsProcessed: 0, message: 'Cron job failed', error: errorMessage },
    })
    return NextResponse.json({ error: errorMessage, jobName, durationMs }, { status: 500 })
  }
}