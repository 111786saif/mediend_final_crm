import type { Prisma } from '@/generated/prisma/client'

export async function logInvoiceRequestActivity(
  prisma: {
    invoiceRequestActivity: {
      create: (args: {
        data: {
          requestId: string
          action: string
          message: string
          remarks?: string | null
          actorId: string
        }
      }) => Promise<unknown>
    }
  },
  data: {
    requestId: string
    action: string
    message: string
    remarks?: string | null
    actorId: string
  }
) {
  await prisma.invoiceRequestActivity.create({
    data: {
      requestId: data.requestId,
      action: data.action,
      message: data.message,
      remarks: data.remarks ?? null,
      actorId: data.actorId,
    },
  })
}

export const invoiceActivityInclude = {
  actor: { select: { id: true, name: true, email: true } },
  request: {
    select: {
      id: true,
      invoiceAmount: true,
      status: true,
      lead: { select: { hospitalName: true, leadRef: true, patientName: true } },
    },
  },
} satisfies Prisma.InvoiceRequestActivityInclude
