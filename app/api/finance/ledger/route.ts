import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { TransactionType, LedgerStatus, LedgerAuditAction, Prisma } from '@/generated/prisma/client'
import { generateSerialNumber, updatePaymentModeBalance, getPaymentModeBalance } from '@/lib/finance'

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
    const transactionType = searchParams.get('transactionType') as TransactionType | null
    const status = searchParams.get('status') as LedgerStatus | null
    const editRequestStatus = searchParams.get('editRequestStatus') as LedgerStatus | null
    const deleteRequestStatus = searchParams.get('deleteRequestStatus') as LedgerStatus | null
    const partyId = searchParams.get('partyId')
    const headId = searchParams.get('headId')
    const paymentModeId = searchParams.get('paymentModeId')
    const paymentTypeId = searchParams.get('paymentTypeId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const search = searchParams.get('search')
    const componentFilter = searchParams.get('componentFilter') // 'all', 'aOnly', 'bOnly', 'both'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10000')

    const where: Prisma.LedgerEntryWhereInput = {
      isDeleted: false, // Exclude deleted entries by default
    }

    if (transactionType) {
      where.transactionType = transactionType
    }

    if (status) {
      where.status = status
    }

    if (editRequestStatus) {
      where.editRequestStatus = editRequestStatus
    }

    if (deleteRequestStatus) {
      where.deleteRequestStatus = deleteRequestStatus
    }

    if (partyId) {
      where.partyId = partyId
    }

    if (headId) {
      where.headId = headId
    }

    if (paymentModeId) {
      where.paymentModeId = paymentModeId
    }

    if (paymentTypeId) {
      where.paymentTypeId = paymentTypeId
    }

    if (startDate || endDate) {
      where.transactionDate = {}
      if (startDate) {
        // Parse date string as UTC to match database storage
        // Date string format: YYYY-MM-DD - treat as UTC date
        const start = new Date(`${startDate}T00:00:00.000Z`)
        where.transactionDate.gte = start
      }
      if (endDate) {
        // Parse date string as UTC and set to end of day
        // Date string format: YYYY-MM-DD - treat as UTC date
        const end = new Date(`${endDate}T23:59:59.999Z`)
        where.transactionDate.lte = end
      }
    }

    // Component filter logic
    if (componentFilter && componentFilter !== 'all') {
      if (componentFilter === 'aOnly') {
        // Only A and 0 B
        where.componentA = { gt: 0 }
        where.AND = [
          {
            OR: [
              { componentB: 0 },
              { componentB: null },
            ],
          },
        ]
      } else if (componentFilter === 'bOnly') {
        // 0 A and only B
        where.AND = [
          {
            OR: [
              { componentA: 0 },
              { componentA: null },
            ],
          },
        ]
        where.componentB = { gt: 0 }
      } else if (componentFilter === 'both') {
        // Both A and B
        where.componentA = { gt: 0 }
        where.componentB = { gt: 0 }
      }
    }

    if (search) {
      const searchConditions: Prisma.LedgerEntryWhereInput[] = [
        { serialNumber: { contains: search, mode: Prisma.QueryMode.insensitive } },
        { description: { contains: search, mode: Prisma.QueryMode.insensitive } },
        { party: { name: { contains: search, mode: Prisma.QueryMode.insensitive } } },
      ]
      
      if (where.OR) {
        // Combine with existing OR conditions
        const existingAND: Prisma.LedgerEntryWhereInput[] = where.AND 
          ? Array.isArray(where.AND) 
            ? where.AND 
            : [where.AND]
          : []
        where.AND = [
          ...existingAND,
          { OR: searchConditions },
        ]
      } else {
        where.OR = searchConditions
      }
    }

    const [entries, total] = await Promise.all([
      prisma.ledgerEntry.findMany({
        where,
        include: {
          party: {
            select: {
              id: true,
              name: true,
              partyType: true,
            },
          },
          head: {
            select: {
              id: true,
              name: true,
              department: true,
            },
          },
          paymentType: {
            select: {
              id: true,
              name: true,
              paymentType: true,
            },
          },
          paymentMode: {
            select: {
              id: true,
              name: true,
            },
          },
          fromPaymentMode: {
            select: {
              id: true,
              name: true,
            },
          },
          toPaymentMode: {
            select: {
              id: true,
              name: true,
            },
          },
          editRequestedBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          deleteRequestedBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          approvedBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { transactionDate: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.ledgerEntry.count({ where }),
    ])

    return successResponse({
      data: entries,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Error fetching ledger entries:', error)
    return errorResponse('Failed to fetch ledger entries', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) {
      return unauthorizedResponse()
    }

    if (!hasPermission(user, 'finance:write')) {
      return errorResponse('Forbidden', 403)
    }

    const body = await request.json()
    const {
      transactionType,
      transactionDate,
      partyId,
      description,
      headId,
      paymentTypeId,
      paymentAmount,
      componentA,
      componentB,
      receivedAmount,
      paymentModeId,
      fromPaymentModeId,
      toPaymentModeId,
      transferAmount,
      attachments,
    } = body

    if (!transactionType || !description) {
      return errorResponse('Missing required fields', 400)
    }

    if (!Object.values(TransactionType).includes(transactionType)) {
      return errorResponse('Invalid transaction type', 400)
    }

    const isSelfTransfer = transactionType === TransactionType.SELF_TRANSFER

    // Validate fields based on transaction type
    if (isSelfTransfer) {
      // For SELF_TRANSFER, validate transfer-specific fields
      if (!fromPaymentModeId || !toPaymentModeId || !transferAmount) {
        return errorResponse('From payment mode, to payment mode, and transfer amount are required for self transfers', 400)
      }
      if (fromPaymentModeId === toPaymentModeId) {
        return errorResponse('From and to payment modes must be different', 400)
      }
      if (transferAmount <= 0) {
        return errorResponse('Transfer amount must be greater than 0', 400)
      }
    } else {
      // For CREDIT/DEBIT, validate standard fields
      if (!partyId || !headId || !paymentTypeId || !paymentModeId) {
        return errorResponse('Missing required fields', 400)
      }
    }

    // Validate amount based on transaction type
    if (transactionType === TransactionType.CREDIT) {
      if (!receivedAmount || receivedAmount <= 0) {
        return errorResponse('Received amount is required for credit transactions', 400)
      }
    } else if (transactionType === TransactionType.DEBIT) {
      // Component A is required for expense entries, but 0 for NON_EXPENSE entries
      const componentAValue = componentA ?? 0
      if (componentAValue < 0) {
        return errorResponse('Component A cannot be negative', 400)
      }
      // componentB is optional, defaults to 0 if not provided
      const componentBValue = componentB || 0
      if (componentBValue < 0) {
        return errorResponse('Component B (claimable amount) cannot be negative', 400)
      }
      // Total payment must be positive (A + B > 0)
      const calculatedPaymentAmount = componentAValue + componentBValue
      if (calculatedPaymentAmount <= 0) {
        return errorResponse('Total payment amount (Component A + Component B) must be greater than 0', 400)
      }
      // If paymentAmount is provided, validate it matches; otherwise use calculated value
      if (paymentAmount && Math.abs(paymentAmount - calculatedPaymentAmount) > 0.01) {
        return errorResponse('Payment amount must equal Component A + Component B', 400)
      }
    }

    // Validate payment modes for self transfer
    let fromPaymentMode = null
    let toPaymentMode = null
    if (isSelfTransfer) {
      const [fromMode, toMode] = await Promise.all([
        prisma.paymentModeMaster.findUnique({ where: { id: fromPaymentModeId } }),
        prisma.paymentModeMaster.findUnique({ where: { id: toPaymentModeId } }),
      ])
      if (!fromMode || !fromMode.isActive) {
        return errorResponse('Invalid or inactive from payment mode', 400)
      }
      if (!toMode || !toMode.isActive) {
        return errorResponse('Invalid or inactive to payment mode', 400)
      }
      fromPaymentMode = fromMode
      toPaymentMode = toMode
    }

    // Validate that party exists and is active (only for CREDIT/DEBIT)
    let party = null
    if (!isSelfTransfer) {
      party = await prisma.partyMaster.findUnique({
        where: { id: partyId },
      })
      if (!party || !party.isActive) {
        return errorResponse('Invalid or inactive party', 400)
      }
    }

    // Validate head exists and is active (only for CREDIT/DEBIT)
    let head = null
    if (!isSelfTransfer) {
      head = await prisma.headMaster.findUnique({
        where: { id: headId },
      })
      if (!head || !head.isActive) {
        return errorResponse('Invalid or inactive head', 400)
      }
    }

    // Validate payment type exists and is active (only for CREDIT/DEBIT)
    let paymentTypeRecord = null
    if (!isSelfTransfer) {
      paymentTypeRecord = await prisma.paymentTypeMaster.findUnique({
        where: { id: paymentTypeId },
      })
      if (!paymentTypeRecord || !paymentTypeRecord.isActive) {
        return errorResponse('Invalid or inactive payment type', 400)
      }
    }

    // Validate payment mode exists and is active (only for CREDIT/DEBIT)
    let paymentMode = null
    if (!isSelfTransfer) {
      paymentMode = await prisma.paymentModeMaster.findUnique({
        where: { id: paymentModeId },
      })
      if (!paymentMode || !paymentMode.isActive) {
        return errorResponse('Invalid or inactive payment mode', 400)
      }
    }

    // Generate serial number
    const serialNumber = await generateSerialNumber(transactionType)

    // Determine status and calculate balance
    // CREDIT: Auto-approve, update balance immediately
    // DEBIT: Pending, balance unchanged until approved
    // SELF_TRANSFER: Auto-approve, update balances for both modes immediately
    const isCredit = transactionType === TransactionType.CREDIT
    const isDebit = transactionType === TransactionType.DEBIT
    
    let finalPaymentAmount: number | null = null
    let finalComponentA: number | null = null
    let finalComponentB: number | null = null
    let openingBalance = 0
    let currentBalance = 0
    let fromOpeningBalance = 0
    let fromCurrentBalance = 0
    let toOpeningBalance = 0
    let toCurrentBalance = 0
    
    if (isSelfTransfer) {
      // For self transfers, get balances for both payment modes
      fromOpeningBalance = await getPaymentModeBalance(fromPaymentModeId)
      toOpeningBalance = await getPaymentModeBalance(toPaymentModeId)
      
      // Update balances for both modes
      fromCurrentBalance = await updatePaymentModeBalance(fromPaymentModeId, TransactionType.DEBIT, transferAmount)
      toCurrentBalance = await updatePaymentModeBalance(toPaymentModeId, TransactionType.CREDIT, transferAmount)
      
      // Use from mode balance for the entry
      openingBalance = fromOpeningBalance
      currentBalance = fromCurrentBalance
    } else if (isCredit) {
      // For credits, no components
      finalPaymentAmount = null
      finalComponentA = null
      finalComponentB = null
      openingBalance = await getPaymentModeBalance(paymentModeId)
      currentBalance = await updatePaymentModeBalance(paymentModeId, transactionType, receivedAmount)
    } else {
      // For debits, calculate payment amount from components (componentA can be 0 for NON_EXPENSE)
      const componentBValue = componentB || 0
      const componentAValue = componentA ?? 0
      finalComponentA = componentAValue
      finalComponentB = componentBValue
      finalPaymentAmount = componentAValue + componentBValue
      openingBalance = await getPaymentModeBalance(paymentModeId)
      currentBalance = openingBalance // Balance unchanged until approved
    }
    
    const amount = isCredit ? receivedAmount : (isSelfTransfer ? transferAmount : finalPaymentAmount)
    const status = (isCredit || isSelfTransfer) ? LedgerStatus.APPROVED : LedgerStatus.PENDING

    // Create the ledger entry
    const entry = await prisma.ledgerEntry.create({
      data: {
        serialNumber,
        transactionType,
        transactionDate: transactionDate ? new Date(transactionDate) : new Date(),
        partyId: isSelfTransfer ? null : partyId,
        description,
        headId: isSelfTransfer ? null : headId,
        paymentTypeId: isSelfTransfer ? null : paymentTypeId,
        paymentAmount: finalPaymentAmount,
        componentA: finalComponentA,
        componentB: finalComponentB,
        receivedAmount: isCredit ? receivedAmount : null,
        paymentModeId: isSelfTransfer ? fromPaymentModeId : paymentModeId,
        fromPaymentModeId: isSelfTransfer ? fromPaymentModeId : null,
        toPaymentModeId: isSelfTransfer ? toPaymentModeId : null,
        transferAmount: isSelfTransfer ? transferAmount : null,
        attachments: attachments || null,
        openingBalance,
        currentBalance,
        status,
        createdById: user.id,
        approvedById: (isCredit || isSelfTransfer) ? user.id : null, // Auto-approved for credits and self transfers
        approvedAt: (isCredit || isSelfTransfer) ? new Date() : null,
      },
      include: {
        party: true,
        head: true,
        paymentType: true,
        paymentMode: true,
        fromPaymentMode: true,
        toPaymentMode: true,
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    // Create audit log
    await prisma.ledgerAuditLog.create({
      data: {
        ledgerEntryId: entry.id,
        action: LedgerAuditAction.CREATED,
        newData: {
          serialNumber,
          transactionType,
          amount,
          status,
          ...(isSelfTransfer ? {
            fromPaymentModeName: entry.fromPaymentMode?.name || fromPaymentMode!.name,
            toPaymentModeName: entry.toPaymentMode?.name || toPaymentMode!.name,
          } : {
            partyName: party?.name,
            headName: head?.name,
            paymentModeName: paymentMode?.name,
          }),
        },
        performedById: user.id,
      },
    })

    const message = isCredit
      ? 'Credit entry created and approved automatically'
      : isSelfTransfer
      ? 'Self transfer entry created and approved automatically'
      : 'Debit entry created and pending MD approval'

    return successResponse(entry, message)
  } catch (error) {
    console.error('Error creating ledger entry:', error)
    return errorResponse('Failed to create ledger entry', 500)
  }
}

