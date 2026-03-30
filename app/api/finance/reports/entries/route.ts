import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { TransactionType, LedgerStatus } from '@/generated/prisma/client'

/** Ledger lines for MD finance detail drawer: by calendar day (UTC date key) or expense head. */
export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) {
      return unauthorizedResponse()
    }

    if (!hasPermission(user, 'finance:read')) {
      return errorResponse('Forbidden', 403)
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const periodFilter: { gte?: Date; lte?: Date } = {}
    if (startDate) periodFilter.gte = new Date(startDate)
    if (endDate) periodFilter.lte = new Date(endDate)

    if (type === 'day') {
      const dateKey = searchParams.get('date')
      if (!dateKey || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
        return errorResponse('Missing or invalid date (YYYY-MM-DD)', 400)
      }

      const dayStart = new Date(`${dateKey}T00:00:00.000Z`)
      const dayEnd = new Date(`${dateKey}T23:59:59.999Z`)

      let rangeGte = dayStart
      let rangeLte = dayEnd
      if (periodFilter.gte && periodFilter.gte > rangeGte) rangeGte = periodFilter.gte
      if (periodFilter.lte && periodFilter.lte < rangeLte) rangeLte = periodFilter.lte

      const entries =
        rangeGte > rangeLte
          ? []
          : await prisma.ledgerEntry.findMany({
              where: {
                isDeleted: false,
                status: LedgerStatus.APPROVED,
                transactionType: {
                  in: [TransactionType.CREDIT, TransactionType.DEBIT],
                },
                transactionDate: {
                  gte: rangeGte,
                  lte: rangeLte,
                },
                OR: [
                  { transactionType: TransactionType.DEBIT },
                  {
                    transactionType: TransactionType.CREDIT,
                    paymentType: {
                      paymentType: { not: 'RECEIPT' },
                    },
                    paymentTypeId: { not: null },
                  },
                ],
              },
              orderBy: { transactionDate: 'desc' },
              include: {
                party: { select: { name: true } },
                head: { select: { name: true } },
                paymentMode: { select: { name: true } },
              },
              take: 500,
            })

      const data = entries.map((t) => ({
        id: t.id,
        serialNumber: t.serialNumber,
        transactionDate: t.transactionDate,
        transactionType: t.transactionType,
        partyName: t.party?.name || '',
        headName: t.head?.name || '',
        paymentModeName: t.paymentMode?.name || '',
        amount:
          t.transactionType === TransactionType.CREDIT
            ? t.receivedAmount || 0
            : t.paymentAmount || 0,
        description: t.description ?? '',
      }))

      return successResponse({ type: 'day', data })
    }

    if (type === 'head') {
      const headId = searchParams.get('headId')
      if (!headId) {
        return errorResponse('Missing headId', 400)
      }

      const entries = await prisma.ledgerEntry.findMany({
        where: {
          isDeleted: false,
          status: LedgerStatus.APPROVED,
          transactionType: TransactionType.DEBIT,
          headId,
          componentA: { gt: 0 },
          ...(Object.keys(periodFilter).length > 0 && {
            transactionDate: periodFilter,
          }),
        },
        orderBy: { transactionDate: 'desc' },
        include: {
          party: { select: { name: true } },
          head: { select: { name: true } },
          paymentMode: { select: { name: true } },
        },
        take: 500,
      })

      const data = entries.map((t) => ({
        id: t.id,
        serialNumber: t.serialNumber,
        transactionDate: t.transactionDate,
        transactionType: t.transactionType,
        partyName: t.party?.name || '',
        headName: t.head?.name || '',
        paymentModeName: t.paymentMode?.name || '',
        amount: t.componentA || t.paymentAmount || 0,
        description: t.description ?? '',
      }))

      return successResponse({ type: 'head', data })
    }

    return errorResponse('Invalid type (use day or head)', 400)
  } catch (error) {
    console.error('Error fetching finance report entries:', error)
    return errorResponse('Failed to fetch entries', 500)
  }
}
