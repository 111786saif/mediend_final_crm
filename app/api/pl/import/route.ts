import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionWithFreshUser } from '@/lib/session'
import { hasPlOrFinanceWrite } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'

type ImportRow = Record<string, unknown>
const normalizedHeader = (header: string) => header.trim().replace(/\s+/g, ' ').toLowerCase()
const value = (row: ImportRow, ...keys: string[]) => {
  const acceptedHeaders = new Set(keys.map(normalizedHeader))
  for (const [header, candidate] of Object.entries(row)) {
    if (acceptedHeaders.has(normalizedHeader(header)) && candidate != null && String(candidate).trim() !== '') {
      return candidate
    }
  }
  return undefined
}
const text = (row: ImportRow, ...keys: string[]) => {
  const candidate = value(row, ...keys)
  return candidate == null ? undefined : String(candidate).trim()
}
const number = (row: ImportRow, ...keys: string[]) => {
  const candidate = value(row, ...keys)
  if (candidate == null) return undefined
  const parsed = Number(candidate)
  return Number.isFinite(parsed) ? parsed : undefined
}
const date = (row: ImportRow, ...keys: string[]) => {
  const candidate = value(row, ...keys)
  if (candidate == null) return undefined
  const parsed = new Date(candidate as string)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed
}

const outstandingStatus = (row: ImportRow) => {
  const status = text(row, 'P&L Status')?.toUpperCase()
  return status === 'NEW' || status === 'DRAFT' || status === 'OUTSTANDING' ? status : undefined
}

const paidBy = (row: ImportRow, ...keys: string[]) => {
  const party = text(row, ...keys)?.toUpperCase()
  return party === 'MEDIEND' || party === 'HOSPITAL' ? party : undefined
}

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionWithFreshUser()
    if (!user) return unauthorizedResponse()
    if (!hasPlOrFinanceWrite(user)) return errorResponse('Forbidden', 403)
    const body = await request.json() as { rows?: ImportRow[] }
    const rows = Array.isArray(body.rows) ? body.rows.slice(0, 1000) : []
    if (!rows.length) return errorResponse('No import rows supplied', 400)
    const result = { imported: 0, unmatched: [] as string[], invalid: [] as string[] }
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index]
      const leadRef = text(row, 'Lead ref', 'Lead Ref')
      if (!leadRef) { result.invalid.push(`Row ${index + 2}: Lead ref is required`); continue }
      const lead = await prisma.lead.findUnique({ where: { leadRef }, select: { id: true } })
      if (!lead) { result.unmatched.push(leadRef); continue }
      const plData: Record<string, unknown> = {
        month: date(row, 'Month'),
        admissionDate: date(row, 'Admission', 'Admission Date', 'Arrival Date'),
        surgeryDate: date(row, 'Surgery', 'Surgery Date'),
        managerName: text(row, 'Manager', 'ATL/TL/ACM/CM/SCM'),
        bdmName: text(row, 'BDM'),
        patientName: text(row, 'Patient', 'P. Name'),
        category: text(row, 'Category'),
        treatment: text(row, 'Treatment'),
        circle: text(row, 'Circle'),
        doctorName: text(row, 'Doctor', 'Doctors'),
        hospitalName: text(row, 'Hospital', 'Hospitals'),
        paymentType: text(row, 'Payment', 'Payment Type'),
        outstandingStatus: outstandingStatus(row),
        status: text(row, 'Status'),
        totalAmount: number(row, 'Approved amount', 'Approved Amount', 'Total'),
        billAmount: number(row, 'Total bill', 'Total Bill', 'Bill Amount'),
        cashOrDedPaid: number(row, 'Deduction Paid by Patient', 'Cash/Ded. Paid'),
        referralAmount: number(row, 'Referral', 'Referral Amount'),
        cabCharges: number(row, 'Cab', 'Cab Charges'),
        dcCharges: number(row, 'D&C'),
        implantCost: number(row, 'Implant', 'Implant Cost'),
        implantPaidBy: paidBy(row, 'Implant by', 'Implant By'),
        instrumentsCost: number(row, 'Instrument', 'Instuments Charges'),
        instrumentsPaidBy: paidBy(row, 'Instr. by', 'Instrument By'),
        actualImplantCost: number(row, 'Actual Implant'),
        actualInstrumentCost: number(row, 'Actual Instrument'),
        hospitalRecoverAmount: number(row, 'Hospital Recover'),
        hospitalSharePct: number(row, 'MediEND %', 'Hospital Share %'),
        hospitalShareAmount: number(row, 'MediEND share', 'MediEND Share', 'Hospital Share'),
        doctorCharges: number(row, 'Doctor fee', 'Doctor Fee', 'Doctor Charges'),
        mediendSharePct: number(row, 'MediEND Net %', 'MediEND Share %'),
        mediendShareAmount: number(row, 'MediEND Net', 'MediEND Share'),
        mediendNetProfit: number(row, 'Net profit', 'Net Profit', 'MediEND Net-Profit'),
        finalProfit: number(row, 'Net profit', 'Net Profit', 'MediEND Net-Profit'),
        remarks: text(row, 'Remarks'),
        hospitalPayoutStatus: text(row, 'MediEND payout', 'MediEND Payout'),
        doctorPayoutStatus: text(row, 'Dr payout', 'Doctor Payout', 'Doctor Payment Status'),
        mediendInvoiceStatus: text(row, 'Invoice', 'Invoice Status', 'MediEND Payment Status'),
      }
      const compact = Object.fromEntries(Object.entries(plData).filter(([, value]) => value !== undefined))
      const totalDeduction = number(row, 'Total Deduction')
      const deductionPaidByPatient = number(row, 'Deduction Paid by Patient', 'Cash/Ded. Paid')
      const waivedOff = number(row, 'Waived Off', 'Wavied off')
      await prisma.$transaction([
        prisma.lead.update({
          where: { id: lead.id },
          data: {
            source: text(row, 'Lead Source'),
            insuranceName: text(row, 'Insurance Company'),
            tpa: text(row, 'TPA'),
            deduction: totalDeduction,
            copay: deductionPaidByPatient,
          },
        }),
        prisma.dischargeSheet.updateMany({
          where: { leadId: lead.id },
          data: {
            deductionAmount: totalDeduction,
            cashOrDedPaid: deductionPaidByPatient,
            waivedOffAmount: waivedOff,
          },
        }),
        prisma.pLRecord.upsert({ where: { leadId: lead.id }, create: { leadId: lead.id, ...compact, handledById: user.id } as any, update: compact as any }),
      ])
      result.imported += 1
    }
    return successResponse(result)
  } catch (error) { console.error('P&L import failed', error); return errorResponse('P&L import failed', 500) }
}
