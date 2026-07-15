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
      paymentCollectedAt: true,
      lead: {
        select: {
          flowType: true,
          collectedByHospital: true,
          collectedByMediend: true,
        },
      },
      dischargeSheet: {
        select: {
          collectedByHospital: true,
          collectedByMediend: true,
        },
      },
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
    if (inst.recipient in totals) {
      totals[inst.recipient] += inst.amount
    }
  }

  const hospitalExpected = pl.hospitalShareAmount ?? 0
  const doctorExpected = pl.doctorCharges ?? 0
  const mediendExpected = pl.mediendShareAmount ?? pl.mediendNetProfit ?? 0

  // Detect who collected the cash/insurance approved amount
  let isHospitalCollector = pl.lead?.flowType === 'INSURANCE'
  if (pl.lead?.flowType === 'CASH') {
    if (pl.paymentCollectedAt === 'HOSPITAL') {
      isHospitalCollector = true
    } else if (pl.paymentCollectedAt === 'MEDIEND') {
      isHospitalCollector = false
    } else {
      const collectedByHospital = pl.dischargeSheet?.collectedByHospital ?? pl.lead?.collectedByHospital ?? 0
      const collectedByMediend = pl.dischargeSheet?.collectedByMediend ?? pl.lead?.collectedByMediend ?? 0
      if (collectedByHospital > 0 && collectedByHospital >= collectedByMediend) {
        isHospitalCollector = true
      } else if (collectedByMediend > 0) {
        isHospitalCollector = false
      } else {
        // Fallback default
        isHospitalCollector = true
      }
    }
  }

  let hospitalPending = 0
  let hospitalPayoutStatus: StatusValue = 'PENDING'

  if (isHospitalCollector) {
    // Hospital collected the money. They owe MediEND.
    // Outstanding amount is what MediEND is waiting to receive (recipient MEDIEND):
    hospitalPending = Math.max(mediendExpected - totals.MEDIEND, 0)
    hospitalPayoutStatus = statusFor(mediendExpected, totals.MEDIEND)
  } else {
    // MediEND collected the money. MediEND owes Hospital.
    // Outstanding amount is what MediEND needs to pay the Hospital (recipient HOSPITAL):
    hospitalPending = Math.max(hospitalExpected - totals.HOSPITAL, 0)
    hospitalPayoutStatus = statusFor(hospitalExpected, totals.HOSPITAL)
  }

  const doctorPending = Math.max(doctorExpected - totals.DOCTOR, 0)

  await prisma.pLRecord.update({
    where: { leadId },
    data: {
      hospitalAmountPending: hospitalPending,
      doctorAmountPending: doctorPending,
      hospitalPayoutStatus,
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
