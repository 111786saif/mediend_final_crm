import { prisma } from '@/lib/prisma'

type StatusValue = 'PENDING' | 'PARTIAL' | 'PAID'

function statusFor(expected: number, paid: number): StatusValue {
  if (paid <= 0) return 'PENDING'
  if (paid + 0.0001 < expected) return 'PARTIAL'
  return 'PAID'
}

/**
 * Recompute outstanding pending amounts and payout statuses from the current
 * installment ledger. Called after every installment write/delete.
 *
 * Expected amounts come from the latest PLRecord (hospital + doctor shares,
 * MediEND share / net profit). Pending = max(expected − paid, 0).
 */
export async function recomputeOutstandingFromInstallments(leadId: string) {
  const pl = await prisma.pLRecord.findUnique({
    where: { leadId },
    select: {
      hospitalShareAmount: true,
      doctorCharges: true,
      mediendShareAmount: true,
      mediendNetProfit: true,
    },
  })
  if (!pl) return

  const installments = await prisma.paymentInstallment.findMany({
    where: { leadId },
    select: { recipient: true, amount: true },
  })

  const totals = { HOSPITAL: 0, DOCTOR: 0, MEDIEND: 0 } as Record<
    'HOSPITAL' | 'DOCTOR' | 'MEDIEND',
    number
  >
  for (const inst of installments) {
    totals[inst.recipient] += inst.amount
  }

  const hospitalExpected = pl.hospitalShareAmount ?? 0
  const doctorExpected = pl.doctorCharges ?? 0
  const mediendExpected = pl.mediendShareAmount ?? pl.mediendNetProfit ?? 0

  const hospitalPending = Math.max(hospitalExpected - totals.HOSPITAL, 0)
  const doctorPending = Math.max(doctorExpected - totals.DOCTOR, 0)

  await prisma.pLRecord.update({
    where: { leadId },
    data: {
      hospitalAmountPending: hospitalPending,
      doctorAmountPending: doctorPending,
      hospitalPayoutStatus: statusFor(hospitalExpected, totals.HOSPITAL),
      doctorPayoutStatus: statusFor(doctorExpected, totals.DOCTOR),
      mediendInvoiceStatus: statusFor(mediendExpected, totals.MEDIEND),
    },
  })

  // Mirror "paymentReceived = true" on OutstandingCase if MediEND is fully paid,
  // so existing filters and badges stay in sync.
  const oc = await prisma.outstandingCase.findUnique({ where: { leadId } })
  if (oc) {
    const fullyPaid = totals.MEDIEND > 0 && totals.MEDIEND + 0.0001 >= mediendExpected
    if (oc.paymentReceived !== fullyPaid) {
      await prisma.outstandingCase.update({
        where: { leadId },
        data: { paymentReceived: fullyPaid },
      })
    }
  }
}
